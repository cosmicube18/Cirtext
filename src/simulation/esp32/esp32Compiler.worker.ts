import { commands, Exit, type Tree } from '@yowasp/clang';
import { ARDUINO_HEADER_CONTENT } from './arduinoShim';

interface CompileMessage {
  type: 'COMPILE';
  code: string;
}

interface CompileAndRunMessage {
  type: 'COMPILE_AND_RUN';
  code: string;
}

interface CompileErrorMessage {
  type: 'COMPILE_ERROR';
  error: string;
}

interface CompiledMessage {
  type: 'COMPILED';
  success: boolean;
  wasmBytes?: ArrayBuffer;
  errors?: string;
}

interface PinWriteMessage {
  type: 'PIN_WRITE';
  gpio: number;
  value: number;
}

interface PinToneMessage {
  type: 'PIN_TONE';
  gpio: number;
  frequencyHz: number;
}

interface SerialOutMessage {
  type: 'SERIAL_OUT';
  text: string;
}

interface RunMessage {
  type: 'RUN';
}

interface StopMessage {
  type: 'STOP';
}

interface PinStateSyncMessage {
  type: 'PIN_STATE_SYNC';
  gpio: number;
  value: number;
  analogValue?: number;
}

interface I2cBusSyncMessage {
  type: 'I2C_BUS_SYNC';
  devices: Array<{ address: number; type: string; online: boolean }>;
  env: { temperature: number; humidity: number; lightLux: number; co2Ppm: number };
}

type WorkerMessage = CompileMessage | CompileAndRunMessage | RunMessage | StopMessage | PinStateSyncMessage | I2cBusSyncMessage;

let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;
let isRunning = false;
// Resolved entrypoints. Kept here because the host looks them up by name and a
// WASM module may expose them under an export_name, a C name, or a C++ mangled
// name depending on how the sketch/shim was compiled.
let wasmSetupFn: Function | null = null;
let wasmLoopFn: Function | null = null;

// Virtual clock driven by the sketch's delay(). `delay(ms)` no longer busy-waits;
// it advances `virtualTimeMs` so all output performed during a single wasm_loop()
// pass is timestamped and replayed over real time afterwards. This keeps a
// HIGH -> delay(500) -> LOW sequence visible as HIGH for a full 500ms instead of
// batching both writes into one React/Zustand render frame.
let virtualTimeMs = 0;
let loopBaseTimeMs = 0;
let runGeneration = 0;
let queuedMessages: QueuedMessage[] = [];

interface QueuedMessage {
  delayMs: number;
  message: PinWriteMessage | PinToneMessage | SerialOutMessage;
}

function enqueueMessage(message: PinWriteMessage | PinToneMessage | SerialOutMessage): void {
  queuedMessages.push({
    delayMs: Math.max(0, virtualTimeMs - loopBaseTimeMs),
    message,
  });
}

function replayQueuedMessages(
  messages: QueuedMessage[],
  totalVirtualMs: number,
  generation: number
): Promise<void> {
  // Always wait out the loop's virtual duration so real time and virtual time stay
  // in lockstep and the next wasm_loop() pass does not race ahead of the UI.
  const waitMs = Math.max(0, totalVirtualMs);
  if (messages.length === 0) {
    return new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const ordered = [...messages].sort((a, b) => a.delayMs - b.delayMs);
  let lastDelay = 0;
  return new Promise((resolve) => {
    for (const item of ordered) {
      lastDelay = Math.max(lastDelay, item.delayMs);
      setTimeout(() => {
        if (generation !== runGeneration) return;
        self.postMessage(item.message);
      }, item.delayMs);
    }
    setTimeout(resolve, Math.max(waitMs, lastDelay));
  });
}

// =====================================================================
// I2C bus simulation state. Devices only ACK when the host has marked them
// `online` (properly powered and wired to GPIO21/GPIO22). Sensor reads return
// the live simulated environment values; the LCD is buffered per address.
// =====================================================================
interface I2cDeviceInfo {
  address: number;
  type: string;
  online: boolean;
}

let i2cDevices = new Map<number, I2cDeviceInfo>();
let envState = { temperature: 25.0, humidity: 50.0, lightLux: 350, co2Ppm: 420 };

let i2cTxAddr = 0;
let i2cTxBuf: number[] = [];
let i2cReadBuf: number[] = [];
let i2cReadPos = 0;

interface LcdBuffer {
  row0: string[];
  row1: string[];
  col: number;
  row: number;
  backlight: boolean;
}
const lcdBuffers = new Map<number, LcdBuffer>();

function blankRow(): string[] {
  return new Array(16).fill(' ');
}

function isDeviceOnline(address: number): boolean {
  const device = i2cDevices.get(address);
  return Boolean(device && device.online);
}

function postLcdUpdate(address: number): void {
  const buf = lcdBuffers.get(address);
  if (!buf) return;
  self.postMessage({
    type: 'LCD_UPDATE',
    address,
    row0: buf.row0.join(''),
    row1: buf.row1.join(''),
    backlight: buf.backlight,
  });
}

function blankLcd(address: number): void {
  lcdBuffers.set(address, {
    row0: blankRow(),
    row1: blankRow(),
    col: 0,
    row: 0,
    backlight: false,
  });
  postLcdUpdate(address);
}

function ensureLcd(address: number): LcdBuffer {
  let buf = lcdBuffers.get(address);
  if (!buf) {
    buf = { row0: blankRow(), row1: blankRow(), col: 0, row: 0, backlight: false };
    lcdBuffers.set(address, buf);
  }
  return buf;
}

function generateReadBytes(address: number, len: number): number[] {
  const device = i2cDevices.get(address);
  const type = device?.type;
  const out: number[] = [];

  if (type === 'BH1750') {
    const lux = Math.max(0, Math.round(envState.lightLux)) & 0xffff;
    out.push((lux >> 8) & 0xff, lux & 0xff);
  } else if (type === 'SHT31') {
    const tRaw = Math.round(((envState.temperature + 45) / 175) * 65535) & 0xffff;
    const hRaw = Math.round((envState.humidity / 100) * 65535) & 0xffff;
    out.push((tRaw >> 8) & 0xff, tRaw & 0xff, 0, (hRaw >> 8) & 0xff, hRaw & 0xff, 0);
  } else if (type === 'SCD41') {
    const co2 = Math.max(0, Math.round(envState.co2Ppm)) & 0xffff;
    const tRaw = Math.round(((envState.temperature + 45) / 175) * 65535) & 0xffff;
    const hRaw = Math.round((envState.humidity / 100) * 65535) & 0xffff;
    out.push((co2 >> 8) & 0xff, co2 & 0xff, 0, (tRaw >> 8) & 0xff, tRaw & 0xff, 0, (hRaw >> 8) & 0xff, hRaw & 0xff, 0);
  }

  const result: number[] = [];
  for (let i = 0; i < len; i++) result.push(out[i] ?? 0);
  return result;
}

function createImports() {
  const imports = {
    env: {
      js_pin_mode: (_pin: number, _mode: number) => {
      },
      js_digital_write: (pin: number, val: number) => {
        if (!wasmMemory) return;
        enqueueMessage({ type: 'PIN_WRITE', gpio: pin, value: val });
      },
      js_digital_read: (_pin: number): number => {
        return 0;
      },
      js_analog_read: (_pin: number): number => {
        return 0;
      },
      js_ledc_tone: (pin: number, frequencyHz: number) => {
        if (frequencyHz > 0) {
          enqueueMessage({ type: 'PIN_TONE', gpio: pin, frequencyHz });
        }
      },
      js_serial_print: (ptr: number, len: number) => {
        if (!wasmMemory) return;
        if (ptr < 0 || len < 0) return;
        const byteLen = wasmMemory.buffer.byteLength;
        if (ptr + len > byteLen) return;
        const bytes = new Uint8Array(wasmMemory.buffer, ptr, len);
        const text = new TextDecoder().decode(bytes);
        enqueueMessage({ type: 'SERIAL_OUT', text });
      },
      js_millis: (): number => {
        return Date.now();
      },
      js_delay: (ms: number) => {
        // Advance the virtual clock instead of blocking the worker thread. The
        // queued PIN_WRITE / SERIAL_OUT messages are replayed over real time by
        // replayQueuedMessages() once wasm_loop() returns.
        if (ms > 0) {
          virtualTimeMs += ms;
        }
      },

      // ---------------- I2C (Wire) ----------------
      js_i2c_begin_transmission: (address: number) => {
        i2cTxAddr = address & 0xff;
        i2cTxBuf = [];
      },
      js_i2c_write: (data: number) => {
        i2cTxBuf.push(data & 0xff);
      },
      js_i2c_end_transmission: (): number => {
        // Non-zero return means the device did not ACK (missing/miswired).
        return isDeviceOnline(i2cTxAddr) ? 0 : 2;
      },
      js_i2c_request_from: (address: number, len: number): number => {
        if (!isDeviceOnline(address)) {
          i2cReadBuf = [];
          i2cReadPos = 0;
          return 0;
        }
        i2cReadBuf = generateReadBytes(address, Math.max(0, len));
        i2cReadPos = 0;
        return i2cReadBuf.length;
      },
      js_i2c_read: (): number => {
        if (i2cReadPos >= i2cReadBuf.length) return 0;
        return i2cReadBuf[i2cReadPos++];
      },
      js_i2c_available: (): number => {
        return i2cReadBuf.length - i2cReadPos;
      },
      js_i2c_device_online: (address: number): number => {
        return isDeviceOnline(address) ? 1 : 0;
      },
      js_sensor_value: (address: number, metric: number): number => {
        if (!isDeviceOnline(address)) return 0;
        switch (metric) {
          case 0: return envState.temperature;
          case 1: return envState.humidity;
          case 2: return envState.lightLux;
          case 3: return envState.co2Ppm;
          default: return 0;
        }
      },

      // ---------------- LiquidCrystal_I2C ----------------
      js_lcd_init: (address: number) => {
        if (!isDeviceOnline(address)) return;
        blankLcd(address);
      },
      js_lcd_clear: (address: number) => {
        if (!isDeviceOnline(address)) return;
        const buf = ensureLcd(address);
        buf.row0 = blankRow();
        buf.row1 = blankRow();
        buf.col = 0;
        buf.row = 0;
        postLcdUpdate(address);
      },
      js_lcd_set_cursor: (address: number, col: number, row: number) => {
        if (!isDeviceOnline(address)) return;
        const buf = ensureLcd(address);
        buf.col = col;
        buf.row = row;
      },
      js_lcd_backlight: (address: number, on: number) => {
        if (!isDeviceOnline(address)) return;
        const buf = ensureLcd(address);
        buf.backlight = on !== 0;
        postLcdUpdate(address);
      },
      js_lcd_print: (address: number, ptr: number, len: number) => {
        if (!isDeviceOnline(address) || !wasmMemory) return;
        if (ptr < 0 || len < 0) return;
        if (ptr + len > wasmMemory.buffer.byteLength) return;
        const buf = ensureLcd(address);
        const bytes = new Uint8Array(wasmMemory.buffer, ptr, len);
        const text = new TextDecoder().decode(bytes);
        for (const ch of text) {
          if (buf.col > 15) {
            buf.col = 0;
            buf.row = buf.row === 0 ? 1 : 0;
          }
          const rowArr = buf.row === 0 ? buf.row0 : buf.row1;
          rowArr[buf.col] = ch;
          buf.col++;
        }
        postLcdUpdate(address);
      },
    },
  };
  return imports;
}

interface RunToolResult {
  result: Tree | null;
  stderrText: string;
  stdoutText: string;
  error: Error | null;
}

async function runTool(
  fn: (args: string[], files: Tree, options: { stderr?: (bytes: Uint8Array | null) => void; stdout?: (bytes: Uint8Array | null) => void; decodeASCII?: boolean }) => Tree | Promise<Tree> | undefined,
  args: string[],
  files: Tree
): Promise<RunToolResult> {
  const decoder = new TextDecoder();
  let stderrText = '';
  let stdoutText = '';

  try {
    const result = await fn(args, files, {
      stderr: (bytes: Uint8Array | null) => {
        if (bytes) stderrText += decoder.decode(bytes, { stream: true });
      },
      stdout: (bytes: Uint8Array | null) => {
        if (bytes) stdoutText += decoder.decode(bytes, { stream: true });
      },
      decodeASCII: true,
    });
    return { result: result ?? null, stderrText, stdoutText, error: null };
  } catch (error) {
    return { result: null, stderrText, stdoutText, error: error as Error };
  }
}

function extractError(stderrText: string, stdoutText: string, error: Error | null): string {
  if (error instanceof Exit) {
    const parts: string[] = [];
    if (stderrText.trim()) parts.push(stderrText.trim());
    if (stdoutText.trim()) parts.push(stdoutText.trim());
    if (parts.length === 0 && error.message) parts.push(error.message);
    return parts.join('\n');
  }
  if (error instanceof Error) return error.message;
  return error ? String(error) : 'Unknown error';
}

function getFile(result: Tree | null, path: string): Uint8Array | undefined {
  if (result) {
    const file = result[path];
    if (file instanceof Uint8Array) return file;
  }
  return undefined;
}

async function compileAndInstantiate(code: string): Promise<{ success: boolean; wasmBytes?: ArrayBuffer; errors?: string }> {
  const fullCode = `#include "Arduino.h"\n${code}`;

  const files: Tree = {
    'sketch.cpp': fullCode,
    'Arduino.h': ARDUINO_HEADER_CONTENT,
  };

  // Every library header simply pulls in Arduino.h, which already defines the
  // Wire / LiquidCrystal_I2C / sensor classes. This lets sketches include any of
  // the common I2C library names without shipping separate implementations.
  for (const header of [
    'Wire.h',
    'LiquidCrystal_I2C.h',
    'SHT31.h',
    'Adafruit_SHT31.h',
    'BH1750.h',
    'Adafruit_BH1750.h',
    'SensirionI2CScd4x.h',
    'SensirionI2CSCD4x.h',
    'SCD41.h',
    'Adafruit_Sensor.h',
  ]) {
    files[header] = '#include "Arduino.h"\n';
  }

  let sketchObj: Uint8Array | undefined;
  const compileResult = await runTool(
    commands['clang++'],
    ['-target', 'wasm32-unknown-unknown', '-ffreestanding', '-nostdlib', '-O2', '-fno-exceptions', '-fno-rtti', '-I.', '-c', 'sketch.cpp', '-o', 'sketch.o'],
    files
  );
  if (compileResult.error) {
    return { success: false, errors: extractError(compileResult.stderrText, compileResult.stdoutText, compileResult.error) };
  }
  sketchObj = getFile(compileResult.result, 'sketch.o');
  if (!sketchObj) {
    return { success: false, errors: 'No object file generated' };
  }

  let wasmBytes: Uint8Array | undefined;
  const linkResult = await runTool(
    commands['wasm-ld'],
    ['--no-entry', '--allow-undefined', '--export-memory', '--export=wasm_setup', '--export=wasm_loop', 'sketch.o', '-o', 'sketch.wasm'],
    { 'sketch.o': sketchObj }
  );
  if (linkResult.error) {
    return { success: false, errors: extractError(linkResult.stderrText, linkResult.stdoutText, linkResult.error) };
  }
  wasmBytes = getFile(linkResult.result, 'sketch.wasm');
  if (!wasmBytes) {
    return { success: false, errors: 'No WASM output generated' };
  }

  try {
    const imports = createImports();
    const instantiated = await WebAssembly.instantiate(wasmBytes.buffer, imports);
    const instance = ('instance' in instantiated ? instantiated.instance : instantiated) as WebAssembly.Instance;
    const exports = instance.exports as Record<string, any>;
    const memory = exports.memory as WebAssembly.Memory | undefined;

    console.log('[ESP32 Worker] Exports:', Object.keys(instance.exports));

    wasmInstance = instance;
    wasmMemory = memory ?? null;

    if (!wasmMemory) {
      wasmSetupFn = null;
      wasmLoopFn = null;
      return { success: false, errors: 'WASM module does not export memory' };
    }

    const setupFn = (exports.wasm_setup || exports._Z5setupv || exports.setup) as Function | undefined;
    const loopFn = (exports.wasm_loop || exports._Z4loopv || exports.loop) as Function | undefined;
    wasmSetupFn = setupFn ?? null;
    wasmLoopFn = loopFn ?? null;

    if (!loopFn) {
      const error = 'Missing wasm_loop export: ' + Object.keys(instance.exports).join(', ');
      const message: CompileErrorMessage = { type: 'COMPILE_ERROR', error };
      self.postMessage(message);
      return { success: false, errors: error };
    }

    return { success: true, wasmBytes: wasmBytes.buffer as ArrayBuffer };
  } catch (error) {
    wasmSetupFn = null;
    wasmLoopFn = null;
    return { success: false, errors: extractError('', '', error as Error) };
  }
}

async function runWasm() {
  if (!wasmInstance || !wasmLoopFn || isRunning) return;
  isRunning = true;
  const generation = ++runGeneration;

  try {
    const setup = wasmSetupFn;
    const loop = wasmLoopFn;

    virtualTimeMs = 0;

    // Run setup() once, replaying any delayed output it produced.
    loopBaseTimeMs = virtualTimeMs;
    queuedMessages = [];
    if (setup) {
      setup();
    }
    await replayQueuedMessages(queuedMessages, virtualTimeMs - loopBaseTimeMs, generation);

    while (isRunning && generation === runGeneration) {
      loopBaseTimeMs = virtualTimeMs;
      queuedMessages = [];
      if (loop) {
        loop();
      }
      // wasm_loop() returned synchronously; replay the timestamped PIN_WRITE /
      // SERIAL_OUT messages over real time before running the next pass.
      await replayQueuedMessages(queuedMessages, virtualTimeMs - loopBaseTimeMs, generation);
    }
  } catch (error) {
    console.error('WASM runtime error:', error);
  }
}

function stopWasm() {
  isRunning = false;
  runGeneration++;
  wasmInstance = null;
  wasmMemory = null;
  wasmSetupFn = null;
  wasmLoopFn = null;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'COMPILE' || message.type === 'COMPILE_AND_RUN') {
    const result = await compileAndInstantiate(message.code);
    const response: CompiledMessage = {
      type: 'COMPILED',
      success: result.success,
      wasmBytes: result.wasmBytes,
      errors: result.errors,
    };
    self.postMessage(response);

    // COMPILE_AND_RUN must not wait for a separate START/RUN message: run
    // setup() and the loop as soon as compilation produced a valid module.
    if (message.type === 'COMPILE_AND_RUN' && result.success) {
      await runWasm();
    }
  } else if (message.type === 'RUN') {
    await runWasm();
  } else if (message.type === 'STOP') {
    stopWasm();
  } else if (message.type === 'PIN_STATE_SYNC') {
  } else if (message.type === 'I2C_BUS_SYNC') {
    i2cDevices = new Map();
    for (const device of message.devices) {
      i2cDevices.set(device.address, device);
    }
    if (message.env) {
      envState = { ...envState, ...message.env };
    }
    // Blank any LCD that is no longer powered/wired.
    for (const address of lcdBuffers.keys()) {
      if (!isDeviceOnline(address)) {
        blankLcd(address);
      }
    }
  }
};