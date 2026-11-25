import type { CircuitGraph } from '../../types/circuit.ts';
import type { SimulationResult, Esp32GpioStates } from '../../utils/simulation.ts';

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

interface CompileErrorMessage {
  type: 'COMPILE_ERROR';
  error: string;
}

type WorkerResponse = CompiledMessage | PinWriteMessage | PinToneMessage | SerialOutMessage | CompileErrorMessage;

interface Esp32PinState {
  gpio: number;
  digitalValue: 0 | 1;
  analogValue: number;
}

export class Esp32RuntimeManager {
  private worker: Worker | null = null;
  private esp32ComponentId: string | null = null;
  private isRunning = false;
  private pinStates: Map<number, Esp32PinState> = new Map();
  private serialBuffer: string[] = [];
  private currentCode: string = '';
  private onSerialOutput: ((text: string) => void) | null = null;
  private onPinUpdate: ((gpio: number, value: number) => void) | null = null;
  private onToneUpdate: ((gpio: number, frequencyHz: number) => void) | null = null;
  private onSimulationTrigger: (gpioStates: Esp32GpioStates) => void = () => {};
  private compilePromise: Promise<{ success: boolean; errors?: string }> | null = null;
  private compileResolve: ((value: { success: boolean; errors?: string }) => void) | null = null;
  private autoRunRequested = false;

  constructor() {}

  setEsp32ComponentId(componentId: string) {
    this.esp32ComponentId = componentId;
  }

  setSerialCallback(callback: (text: string) => void) {
    this.onSerialOutput = callback;
  }

  setPinUpdateCallback(callback: (gpio: number, value: number) => void) {
    this.onPinUpdate = callback;
  }

  setToneUpdateCallback(callback: (gpio: number, frequencyHz: number) => void) {
    this.onToneUpdate = callback;
  }

  setSimulationTrigger(callback: (gpioStates: Esp32GpioStates) => void) {
    this.onSimulationTrigger = callback;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getSerialBuffer(): string {
    return this.serialBuffer.join('');
  }

  getCurrentCode(): string {
    return this.currentCode;
  }

  setCurrentCode(code: string) {
    this.currentCode = code;
  }

  clearSerialBuffer(): void {
    this.serialBuffer = [];
  }

  async compile(code: string, autoRun: boolean = true): Promise<{ success: boolean; errors?: string }> {
    if (this.worker) {
      this.worker.terminate();
    }

    this.currentCode = code;
    this.autoRunRequested = autoRun;

    this.worker = new Worker(
      new URL('./esp32Compiler.worker.ts', import.meta.url),
      { type: 'module' }
    );

    return new Promise((resolve) => {
      this.compileResolve = resolve;

      this.worker!.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        console.debug('[ESP32]', message.type, message);

        if (message.type === 'COMPILED') {
          // COMPILE_AND_RUN auto-starts the sketch inside the worker right after
          // it reports success, so mirror that state here instead of requiring a
          // separate start() call to flip isRunning.
          if (message.success && this.autoRunRequested) {
            this.isRunning = true;
          }
          if (this.compileResolve) {
            this.compileResolve({ success: message.success, errors: message.errors });
            this.compileResolve = null;
          }
        } else if (message.type === 'COMPILE_ERROR') {
          console.error('[ESP32] COMPILE_ERROR:', message.error);
          if (this.compileResolve) {
            this.compileResolve({ success: false, errors: message.error });
            this.compileResolve = null;
          }
        } else if (message.type === 'PIN_WRITE') {
          this.handlePinWrite(message.gpio, message.value);
        } else if (message.type === 'PIN_TONE') {
          this.handlePinTone(message.gpio, message.frequencyHz);
        } else if (message.type === 'SERIAL_OUT') {
          this.handleSerialOut(message.text);
        }
      };

      this.worker!.postMessage(autoRun ? { type: 'COMPILE_AND_RUN', code } : { type: 'COMPILE', code });
    });
  }

  async start(): Promise<void> {
    if (!this.worker || this.isRunning) return;
    this.isRunning = true;
    this.worker.postMessage({ type: 'RUN' });
  }

  stop(): void {
    if (this.worker && this.isRunning) {
      this.isRunning = false;
      this.worker.postMessage({ type: 'STOP' });
    }
  }

  reset(): void {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pinStates.clear();
    this.serialBuffer = [];
    this.currentCode = '';
    this.isRunning = false;
  }

  private handlePinWrite(gpio: number, value: number): void {
    const state = this.pinStates.get(gpio) || { gpio, digitalValue: 0, analogValue: 0 };
    state.digitalValue = value as 0 | 1;
    this.pinStates.set(gpio, state);

    if (this.onPinUpdate) {
      this.onPinUpdate(gpio, value);
    }

    // Trigger circuit simulation update with current GPIO states
    if (this.esp32ComponentId && this.onSimulationTrigger) {
      const gpioStates: Esp32GpioStates = {};
      gpioStates[this.esp32ComponentId] = {};
      for (const [gpioNum, pinState] of this.pinStates.entries()) {
        // Find the pin name from the GPIO number
        const pinName = this.gpioToPinName(gpioNum);
        if (pinName) {
          gpioStates[this.esp32ComponentId!][pinName] = pinState.digitalValue;
        }
      }
      this.onSimulationTrigger(gpioStates);
    }
  }

  private handlePinTone(gpio: number, frequencyHz: number): void {
    if (this.onToneUpdate) {
      this.onToneUpdate(gpio, frequencyHz);
    }
  }

  private handleSerialOut(text: string): void {
    this.serialBuffer.push(text);
    if (this.onSerialOutput) {
      this.onSerialOutput(text);
    }
  }

  private gpioToPinName(gpio: number): string | null {
    const pinMap: Record<number, string> = {
      2: 'D2', 4: 'D4', 5: 'D5', 12: 'D12', 13: 'D13', 14: 'D14', 15: 'D15',
      18: 'D18', 19: 'D19', 21: 'D21', 22: 'D22', 23: 'D23', 25: 'D25',
      26: 'D26', 27: 'D27', 32: 'D32', 33: 'D33', 34: 'D34', 35: 'D35',
      3: 'RX0', 1: 'TX0', 16: 'RX2', 17: 'TX2', 36: 'VP', 39: 'VN'
    };
    return pinMap[gpio] ?? null;
  }

  syncPinStatesFromCircuit(graph: CircuitGraph, simulationResult: SimulationResult): void {
    if (!this.esp32ComponentId || !this.worker) return;

    const meta = graph.components.find(c => c.id === this.esp32ComponentId);
    if (!meta) return;

    const esp32Pins = [
      'D2', 'D4', 'D5', 'D12', 'D13', 'D14', 'D15', 'D18', 'D19', 'D21',
      'D22', 'D23', 'D25', 'D26', 'D27', 'D32', 'D33', 'D34', 'D35',
      'RX0', 'TX0', 'RX2', 'TX2', 'GPIO21', 'GPIO22', 'VP', 'VN'
    ];

    for (const pinName of esp32Pins) {
      const pinId = `${this.esp32ComponentId}.${pinName}`;
      const digitalValue = simulationResult.pinStates[pinId] ?? 0;
      const isGrounded = simulationResult.isGrounded[pinId] ?? false;

      let analogValue = 0;
      if (!isGrounded && digitalValue === 1) {
        analogValue = 4095;
      } else if (!isGrounded && digitalValue === 0) {
        analogValue = 0;
      }

      const gpio = this.pinNameToGpio(pinName);
      if (gpio >= 0) {
        const state = this.pinStates.get(gpio) || { gpio, digitalValue: 0, analogValue: 0 };
        state.digitalValue = digitalValue;
        state.analogValue = analogValue;
        this.pinStates.set(gpio, state);
      }
    }
  }

  private pinNameToGpio(pinName: string): number {
    const pinMap: Record<string, number> = {
      'D2': 2, 'D4': 4, 'D5': 5, 'D12': 12, 'D13': 13, 'D14': 14, 'D15': 15,
      'D18': 18, 'D19': 19, 'D21': 21, 'D22': 22, 'D23': 23, 'D25': 25,
      'D26': 26, 'D27': 27, 'D32': 32, 'D33': 33, 'D34': 34, 'D35': 35,
      'RX0': 3, 'TX0': 1, 'RX2': 16, 'TX2': 17, 'GPIO21': 21, 'GPIO22': 22,
      'VP': 36, 'VN': 39
    };
    return pinMap[pinName] ?? -1;
  }

  getSerialOutput(): string {
    return this.serialBuffer.join('');
  }

  clearSerialOutput(): void {
    this.serialBuffer = [];
  }

  getPinState(gpio: number): Esp32PinState | undefined {
    return this.pinStates.get(gpio);
  }

  isCompiling(): boolean {
    return this.compilePromise !== null;
  }

  isActive(): boolean {
    return this.isRunning && this.worker !== null;
  }
}

export const esp32RuntimeManager = new Esp32RuntimeManager();