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

type WorkerMessage = CompileMessage | CompileAndRunMessage | RunMessage | StopMessage | PinStateSyncMessage;

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
  }
};