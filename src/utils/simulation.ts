import type { CircuitGraph } from '../types/circuit.ts';
import { COMPONENT_METADATA } from '../types/circuit.ts';

export interface FlipFlopState {
  q: boolean;
  prevClk: boolean;
}

export type FlipFlopStates = Record<string, FlipFlopState>;

// ESP32 GPIO states: componentId -> pinId -> 0 | 1
export type Esp32GpioStates = Record<string, Record<string, 0 | 1>>;

export type I2cDeviceType = 'SHT31' | 'BH1750' | 'SCD41' | 'LCD_I2C';

/**
 * Strict electrical + I2C bus validity for an I2C device.
 * `online` is true ONLY when VCC sits on a live power rail, GND is grounded,
 * and SDA/SCL are wired to the ESP32 I2C pins (GPIO21/GPIO22).
 */
export interface I2cDeviceState {
  componentId: string;
  type: I2cDeviceType;
  address: number;
  powered: boolean;
  wired: boolean;
  online: boolean;
}

export const I2C_ADDRESSES: Record<I2cDeviceType, number> = {
  SHT31: 0x44,
  BH1750: 0x23,
  SCD41: 0x62,
  LCD_I2C: 0x27,
};

export interface InstrumentReading {
  display: string;
  rawValue: number | null;
  unit: string;
  status: 'ok' | 'open' | 'live_error';
}

export interface SimulationResult {
  pinStates: Record<string, 0 | 1>;
  isGrounded: Record<string, boolean>;
  ledStates: Record<string, boolean>;
  buzzerStates: Record<string, boolean>;
  edgeStates: Record<string, 0 | 1>;
  flipFlopStates: FlipFlopStates;
  i2cDevices: Record<string, I2cDeviceState>;
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  componentResistances: Record<string, number>;
  overCurrent: Record<string, boolean>;
  instrumentReadings: Record<string, InstrumentReading>;
}

const SI_PREFIX_EXP: Record<string, number> = {
  p: -12,
  n: -9,
  u: -6,
  '\u00b5': -6, // micro sign µ
  '\u03bc': -6, // Greek small letter mu μ
  m: -3,
  k: 3,
  K: 3,
  M: 6,
  G: 9,
};

/**
 * Parses an engineering value string with optional SI prefix and unit label
 * (e.g. "10k", "10k Ohm", "4.7M", "5V", "3.3V", "10uF") into a base SI number.
 */
export function parseComponentValue(rawValue: string | undefined, defaultValue: number): number {
  if (!rawValue) return defaultValue;
  const trimmed = rawValue.trim();
  if (!trimmed) return defaultValue;

  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/i);
  if (!match) return defaultValue;

  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return defaultValue;

  let rest = match[2].trim();
  // Strip trailing unit labels (Ohm, Ohms, Ω, V, A, F, H, case-insensitive)
  rest = rest.replace(/\s*(?:ohms?|Ω|ω|[vafh])$/i, '').trim();

  if (!rest) return num;

  let exp: number | undefined;
  if (rest.toLowerCase() === 'meg') {
    exp = 6;
  } else if (rest in SI_PREFIX_EXP) {
    exp = SI_PREFIX_EXP[rest];
  } else {
    return defaultValue;
  }

  return exp >= 0 ? num * 10 ** exp : num / 10 ** -exp;
}

/**
 * Solves the linear system A * x = b using Gaussian elimination with partial pivoting.
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (n === 0) return [];

  const M = A.map((row) => row.slice());
  const rhs = b.slice();

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = r;
      }
    }

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      [rhs[col], rhs[pivotRow]] = [rhs[pivotRow], rhs[col]];
    }

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-15) {
      continue;
    }

    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      M[r][col] = 0;
      for (let c = col + 1; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
      rhs[r] -= factor * rhs[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    const diag = M[r][r];
    if (Math.abs(diag) < 1e-15) {
      x[r] = 0;
      continue;
    }
    let sum = rhs[r];
    for (let c = r + 1; c < n; c++) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / diag;
  }

  return x;
}

/**
 * Solves DC logic propagation and digital gate evaluation across the circuit graph.
 * Enforces a closed-loop ground check:
 * - Net/pins are only marked as `isGrounded` if they have a conductive return path to
 *   a `Ground` component's pin `1` OR a `VoltageSource` component's `neg` pin.
 * - An `LED` ONLY lights up when its `anode` is HIGH (1) AND its `cathode` is GROUNDED.
 */
export function runCircuitSimulation(
  graph: CircuitGraph,
  switchStates: Record<string, boolean>,
  flipFlopStates: FlipFlopStates = {},
  clockHigh: boolean = false,
  esp32GpioStates: Esp32GpioStates = {}
): SimulationResult {
  const pinStates: Record<string, 0 | 1> = {};
  const isGrounded: Record<string, boolean> = {};
  // Full pin keys (e.g. `U1.D2`) that act as active voltage sources, so their HIGH
  // value propagates through nets exactly like a fixed 3.3V regulator output.
  const activeSourcePins = new Set<string>();

  // 1. Initialize fixed power sources, explicit ground nets, and default logic gate pins
  for (const comp of graph.components) {
    if (comp.type === 'VoltageSource') {
      pinStates[`${comp.id}.pos`] = 1;
      pinStates[`${comp.id}.neg`] = 0;
      isGrounded[`${comp.id}.neg`] = true;
    } else if (comp.type === 'Ground') {
      pinStates[`${comp.id}.1`] = 0;
      isGrounded[`${comp.id}.1`] = true;
    } else if (['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(comp.type)) {
      pinStates[`${comp.id}.A`] = 0;
      if (comp.type !== 'NOT') {
        pinStates[`${comp.id}.B`] = 0;
      }
      pinStates[`${comp.id}.Y`] = 0;
    } else if (comp.type === 'D_FlipFlop') {
      pinStates[`${comp.id}.D`] = 0;
      pinStates[`${comp.id}.CLK`] = 0;
      const saved = flipFlopStates[comp.id];
      pinStates[`${comp.id}.Q`] = saved?.q ? 1 : 0;
      pinStates[`${comp.id}.Q_BAR`] = saved?.q ? 0 : 1;
    } else if (comp.type === 'JK_FlipFlop') {
      pinStates[`${comp.id}.J`] = 0;
      pinStates[`${comp.id}.CLK`] = 0;
      pinStates[`${comp.id}.K`] = 0;
      const saved = flipFlopStates[comp.id];
      pinStates[`${comp.id}.Q`] = saved?.q ? 1 : 0;
      pinStates[`${comp.id}.Q_BAR`] = saved?.q ? 0 : 1;
    } else if (comp.type === 'Clock') {
      pinStates[`${comp.id}.OUT`] = clockHigh ? 1 : 0;
    } else if (comp.type === 'ESP32_30Pin') {
      pinStates[`${comp.id}.VIN`] = 0;
      pinStates[`${comp.id}.GND`] = 0;
      pinStates[`${comp.id}.GND2`] = 0;
      pinStates[`${comp.id}.3V3`] = 1; // 3V3 regulator output always HIGH when powered
      isGrounded[`${comp.id}.GND`] = true;
      isGrounded[`${comp.id}.GND2`] = true;
      // 3V3 is an active source: its HIGH value drives connected nets.
      activeSourcePins.add(`${comp.id}.3V3`);

      // Apply live ESP32 GPIO states from the runtime.
      // The runtime emits pin keys like `D2`; be lenient and also accept the
      // metadata `label`/`id` and aliases (`GPIO2`, `2`, `gpio2`).
      const gpioStates = esp32GpioStates[comp.id];
      if (gpioStates) {
        const esp32Meta = COMPONENT_METADATA.ESP32_30Pin;
        const resolvePinId = (key: string): string => {
          const lower = key.toLowerCase();
          const match = esp32Meta.pins.find(
            (p) =>
              p.id.toLowerCase() === lower ||
              p.label.toLowerCase() === lower ||
              (p.aliases ?? []).some((alias) => alias.toLowerCase() === lower)
          );
          return match ? match.id : key;
        };

        for (const [pinKey, value] of Object.entries(gpioStates)) {
          const fullPin = `${comp.id}.${resolvePinId(pinKey)}`;
          pinStates[fullPin] = value;
          // A HIGH GPIO pin behaves as an active 3.3V source so current can flow
          // through the connected load (e.g. U1.D2 -> R1 -> D1 -> U1.GND2).
          if (value === 1) {
            activeSourcePins.add(fullPin);
          }
        }
      }
    } else if (comp.type === 'TP4056') {
      pinStates[`${comp.id}.IN+`] = 0;
      pinStates[`${comp.id}.IN-`] = 0;
      pinStates[`${comp.id}.BAT+`] = 0;
      pinStates[`${comp.id}.BAT-`] = 0;
      isGrounded[`${comp.id}.IN-`] = true;
      isGrounded[`${comp.id}.BAT-`] = true;
    } else if (comp.type === 'Boost5V') {
      pinStates[`${comp.id}.VIN`] = 0;
      pinStates[`${comp.id}.GND`] = 0;
      pinStates[`${comp.id}.VOUT`] = 0;
      pinStates[`${comp.id}.GND2`] = 0;
      isGrounded[`${comp.id}.GND`] = true;
      isGrounded[`${comp.id}.GND2`] = true;
    }
  }

  // 2. Two-phase synchronous evaluation:
  //    Phase A: Settle combinational logic, switches, resistors, and nets with flip-flops holding pre-tick Q/Q_BAR.
  //    Phase B: Sample settled CLK/D/J/K once per tick and latch flip-flop states on active clock edges.
  //    Phase C: Re-propagate updated Q/Q_BAR through combinational logic and nets.
  const MAX_ITERATIONS = 16;
  const runCombinationalSettling = () => {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let changed = false;

      // A. Propagate through passive conductive components (Switch, Resistor, Ammeter)
      for (const comp of graph.components) {
        if (comp.type === 'Switch') {
          const isClosed = switchStates[comp.id] ?? false;
          if (isClosed) {
            const pin1 = `${comp.id}.1`;
            const pin2 = `${comp.id}.2`;

            // Bidirectional signal bridging
            if ((pinStates[pin1] === 1 || pinStates[pin2] === 1) && (!pinStates[pin1] || !pinStates[pin2])) {
              pinStates[pin1] = 1;
              pinStates[pin2] = 1;
              changed = true;
            }

            // Bidirectional ground bridging
            if (isGrounded[pin1] && !isGrounded[pin2]) {
              isGrounded[pin2] = true;
              changed = true;
            } else if (isGrounded[pin2] && !isGrounded[pin1]) {
              isGrounded[pin1] = true;
              changed = true;
            }
          }
        } else if (comp.type === 'Resistor' || comp.type === 'Ammeter') {
          const pin1 = comp.type === 'Ammeter' ? `${comp.id}.pos` : `${comp.id}.1`;
          const pin2 = comp.type === 'Ammeter' ? `${comp.id}.neg` : `${comp.id}.2`;

          // Bidirectional signal bridging
          if ((pinStates[pin1] === 1 || pinStates[pin2] === 1) && (!pinStates[pin1] || !pinStates[pin2])) {
            pinStates[pin1] = 1;
            pinStates[pin2] = 1;
            changed = true;
          }

          // Bidirectional ground bridging through current-limiting resistor / ammeter shunt
          if (isGrounded[pin1] && !isGrounded[pin2]) {
            isGrounded[pin2] = true;
            changed = true;
          } else if (isGrounded[pin2] && !isGrounded[pin1]) {
            isGrounded[pin1] = true;
            changed = true;
          }
        }
      }

      // Power component propagation: ESP32_30Pin, TP4056, Boost5V
      for (const comp of graph.components) {
        if (comp.type === 'ESP32_30Pin') {
          const vinPin = `${comp.id}.VIN`;
          const v33Pin = `${comp.id}.3V3`;
          const gndPin = `${comp.id}.GND`;
          const gnd2Pin = `${comp.id}.GND2`;

          if (pinStates[vinPin] === 1 && pinStates[v33Pin] !== 1) {
            pinStates[v33Pin] = 1;
            changed = true;
          }
          if (isGrounded[gndPin] && !isGrounded[gnd2Pin]) {
            isGrounded[gnd2Pin] = true;
            changed = true;
          } else if (isGrounded[gnd2Pin] && !isGrounded[gndPin]) {
            isGrounded[gndPin] = true;
            changed = true;
          }
        } else if (comp.type === 'TP4056') {
          const inPlusPin = `${comp.id}.IN+`;
          const inMinusPin = `${comp.id}.IN-`;
          const batPlusPin = `${comp.id}.BAT+`;
          const batMinusPin = `${comp.id}.BAT-`;

          const charging = pinStates[inPlusPin] === 1 && isGrounded[inMinusPin];
          if (charging && pinStates[batPlusPin] !== 1) {
            pinStates[batPlusPin] = 1;
            changed = true;
          }
          if (isGrounded[batMinusPin] && !isGrounded[inMinusPin]) {
            isGrounded[inMinusPin] = true;
            changed = true;
          }
        } else if (comp.type === 'Boost5V') {
          const vinPin = `${comp.id}.VIN`;
          const gndPin = `${comp.id}.GND`;
          const voutPin = `${comp.id}.VOUT`;
          const gnd2Pin = `${comp.id}.GND2`;

          const boosting = pinStates[vinPin] === 1 && isGrounded[gndPin];
          if (boosting && pinStates[voutPin] !== 1) {
            pinStates[voutPin] = 1;
            changed = true;
          }
          if (isGrounded[gndPin] && !isGrounded[gnd2Pin]) {
            isGrounded[gnd2Pin] = true;
            changed = true;
          } else if (isGrounded[gnd2Pin] && !isGrounded[gndPin]) {
            isGrounded[gndPin] = true;
            changed = true;
          }
        }
      }

      // B. Build nets (connected pin groups) and propagate signals through nets
      const pinAdjacency: Record<string, string[]> = {};
      for (const conn of graph.connections) {
        const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
        const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
        if (!pinAdjacency[srcPin]) pinAdjacency[srcPin] = [];
        if (!pinAdjacency[tgtPin]) pinAdjacency[tgtPin] = [];
        pinAdjacency[srcPin].push(tgtPin);
        pinAdjacency[tgtPin].push(srcPin);
      }

      for (const comp of graph.components) {
        if (comp.type === 'Resistor' || comp.type === 'Ammeter') {
          const pin1 = comp.type === 'Ammeter' ? `${comp.id}.pos` : `${comp.id}.1`;
          const pin2 = comp.type === 'Ammeter' ? `${comp.id}.neg` : `${comp.id}.2`;
          if (!pinAdjacency[pin1]) pinAdjacency[pin1] = [];
          if (!pinAdjacency[pin2]) pinAdjacency[pin2] = [];
          pinAdjacency[pin1].push(pin2);
          pinAdjacency[pin2].push(pin1);
        } else if (comp.type === 'Switch') {
          const isClosed = switchStates[comp.id] ?? false;
          if (isClosed) {
            const pin1 = `${comp.id}.1`;
            const pin2 = `${comp.id}.2`;
            if (!pinAdjacency[pin1]) pinAdjacency[pin1] = [];
            if (!pinAdjacency[pin2]) pinAdjacency[pin2] = [];
            pinAdjacency[pin1].push(pin2);
            pinAdjacency[pin2].push(pin1);
          }
        }
      }

      const visited = new Set<string>();
      const nets: string[][] = [];
      for (const pin of Object.keys(pinAdjacency)) {
        if (visited.has(pin)) continue;
        const net: string[] = [];
        const stack = [pin];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          net.push(current);
          for (const neighbor of pinAdjacency[current] || []) {
            if (!visited.has(neighbor)) stack.push(neighbor);
          }
        }
        nets.push(net);
      }

      const driverPinIds = new Set(['pos', 'Y', 'Q', 'Q_BAR', 'OUT', '3V3', 'BAT+', 'VOUT']);
      for (const net of nets) {
        let driverValue: 0 | 1 | null = null;
        let hasDriver = false;

        for (const pin of net) {
          const pinName = pin.split('.').pop() || '';
          if (driverPinIds.has(pinName) || activeSourcePins.has(pin)) {
            const val = pinStates[pin] ?? 0;
            if (!hasDriver) {
              driverValue = val;
              hasDriver = true;
            } else if (driverValue !== val) {
              hasDriver = false;
              break;
            }
          }
        }

        if (hasDriver && driverValue !== null) {
          for (const pin of net) {
            if (pinStates[pin] !== driverValue) {
              pinStates[pin] = driverValue;
              changed = true;
            }
          }
        }

        let netIsGrounded = false;
        for (const pin of net) {
          if (isGrounded[pin]) {
            netIsGrounded = true;
            break;
          }
        }
        if (netIsGrounded) {
          for (const pin of net) {
            if (!isGrounded[pin]) {
              isGrounded[pin] = true;
              changed = true;
            }
          }
        }
      }

      // C. Directional Logic Gate Evaluation (AND, OR, NOT, NAND, NOR, XOR, XNOR)
      for (const comp of graph.components) {
        const isGate = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(comp.type);
        if (isGate) {
          const inA = pinStates[`${comp.id}.A`] ?? 0;
          const inB = pinStates[`${comp.id}.B`] ?? 0;
          let outY: 0 | 1 = 0;

          switch (comp.type) {
            case 'AND':
              outY = inA === 1 && inB === 1 ? 1 : 0;
              break;
            case 'NAND':
              outY = !(inA === 1 && inB === 1) ? 1 : 0;
              break;
            case 'OR':
              outY = inA === 1 || inB === 1 ? 1 : 0;
              break;
            case 'NOR':
              outY = !(inA === 1 || inB === 1) ? 1 : 0;
              break;
            case 'XOR':
              outY = inA !== inB ? 1 : 0;
              break;
            case 'XNOR':
              outY = inA === inB ? 1 : 0;
              break;
            case 'NOT':
              outY = inA === 0 ? 1 : 0;
              break;
          }

          const yPin = `${comp.id}.Y`;
          if (pinStates[yPin] !== outY) {
            pinStates[yPin] = outY;
            changed = true;
          }
        }
      }

      if (!changed) break;
    }
  };

  // Phase A: Settle all combinational logic, switches, and nets before sampling clock edges
  runCombinationalSettling();

  // Phase B: Sequential Logic Evaluation (D_FlipFlop, JK_FlipFlop) once per tick
  let anyFlipFlopChanged = false;
  for (const comp of graph.components) {
    if (comp.type !== 'D_FlipFlop' && comp.type !== 'JK_FlipFlop') continue;

    const compId = comp.id;
    const currClk = (pinStates[`${compId}.CLK`] ?? 0) === 1;

    if (!flipFlopStates[compId]) {
      flipFlopStates[compId] = { q: false, prevClk: false };
    }
    const ffState = flipFlopStates[compId];

    const risingEdge = !ffState.prevClk && currClk;
    const fallingEdge = ffState.prevClk && !currClk;

    if (comp.type === 'D_FlipFlop' && risingEdge) {
      const inD = pinStates[`${compId}.D`] ?? 0;
      ffState.q = inD === 1;
    } else if (comp.type === 'JK_FlipFlop' && fallingEdge) {
      const inJ = pinStates[`${compId}.J`] ?? 0;
      const inK = pinStates[`${compId}.K`] ?? 0;

      if (inJ === 0 && inK === 1) {
        ffState.q = false;
      } else if (inJ === 1 && inK === 0) {
        ffState.q = true;
      } else if (inJ === 1 && inK === 1) {
        ffState.q = !ffState.q;
      }
    }

    ffState.prevClk = currClk;

    const outQ: 0 | 1 = ffState.q ? 1 : 0;
    const outQBar: 0 | 1 = ffState.q ? 0 : 1;

    if (pinStates[`${compId}.Q`] !== outQ) {
      pinStates[`${compId}.Q`] = outQ;
      anyFlipFlopChanged = true;
    }
    if (pinStates[`${compId}.Q_BAR`] !== outQBar) {
      pinStates[`${compId}.Q_BAR`] = outQBar;
      anyFlipFlopChanged = true;
    }
  }

  // Phase C: Re-propagate updated Q / Q_BAR through downstream combinational logic and nets
  if (anyFlipFlopChanged) {
    runCombinationalSettling();
  }

  // 3. DC Modified Nodal Analysis (MNA) Linear Solver
  // 3a. Group electrically wired pins into unified nets using Union-Find
  const ufParent = new Map<string, string>();
  const ufFind = (x: string): string => {
    let p = ufParent.get(x);
    if (p === undefined) {
      ufParent.set(x, x);
      return x;
    }
    while (p !== ufParent.get(p)!) {
      p = ufParent.get(p)!;
    }
    let cur = x;
    while (cur !== p) {
      const next = ufParent.get(cur)!;
      ufParent.set(cur, p);
      cur = next;
    }
    return p;
  };
  const ufUnion = (a: string, b: string): void => {
    const ra = ufFind(a);
    const rb = ufFind(b);
    if (ra !== rb) ufParent.set(rb, ra);
  };

  const allPins = new Set<string>();
  const groundPins: string[] = [];

  for (const comp of graph.components) {
    const meta = COMPONENT_METADATA[comp.type];
    if (meta) {
      for (const pin of meta.pins) {
        const key = `${comp.id}.${pin.id}`;
        allPins.add(key);
        ufFind(key);
      }
    }
    if (comp.type === 'Ground') {
      groundPins.push(`${comp.id}.1`);
    } else if (comp.type === 'VoltageSource') {
      groundPins.push(`${comp.id}.neg`);
    } else if (comp.type === 'ESP32_30Pin') {
      groundPins.push(`${comp.id}.GND`, `${comp.id}.GND2`);
    } else if (comp.type === 'TP4056') {
      groundPins.push(`${comp.id}.IN-`, `${comp.id}.BAT-`);
    } else if (comp.type === 'Boost5V') {
      groundPins.push(`${comp.id}.GND`, `${comp.id}.GND2`);
    }
  }

  for (const conn of graph.connections) {
    const src = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgt = `${conn.targetComponentId}.${conn.targetPinId}`;
    allPins.add(src);
    allPins.add(tgt);
    ufUnion(src, tgt);
  }

  for (let i = 1; i < groundPins.length; i++) {
    ufUnion(groundPins[0], groundPins[i]);
  }
  const groundRoot = groundPins.length > 0 ? ufFind(groundPins[0]) : null;

  const rootToNode = new Map<string, number>();
  let numNodes = 0;
  for (const pin of allPins) {
    const root = ufFind(pin);
    if (root === groundRoot) {
      rootToNode.set(root, 0);
    } else if (!rootToNode.has(root)) {
      numNodes++;
      rootToNode.set(root, numNodes);
    }
  }
  const getNode = (pin: string): number => rootToNode.get(ufFind(pin)) ?? 0;

  // Determine logic rail voltage (use VoltageSource value if present, else 3.3V for ESP32, else 5.0V)
  const firstVs = graph.components.find((c) => c.type === 'VoltageSource');
  const hasEsp32 = graph.components.some((c) => c.type === 'ESP32_30Pin');
  const logicRail = firstVs ? parseComponentValue(firstVs.value, 5.0) : hasEsp32 ? 3.3 : 5.0;

  interface MnaVoltageSource {
    compId: string;
    isPrimaryVs: boolean;
    pPin: string;
    nPin: string;
    p: number;
    n: number;
    V: number;
  }
  interface MnaPassive {
    compId: string;
    pin1: string;
    pin2: string;
    n1: number;
    n2: number;
    R: number;
  }
  interface MnaDiode {
    compId: string;
    aPin: string;
    kPin: string;
    a: number;
    k: number;
    Vf: number;
    R_on: number;
    R_off: number;
    kind: 'LED' | 'Buzzer';
  }

  const voltageSources: MnaVoltageSource[] = [];
  const passives: MnaPassive[] = [];
  const diodes: MnaDiode[] = [];

  for (const comp of graph.components) {
    if (comp.type === 'VoltageSource') {
      const pPin = `${comp.id}.pos`;
      const nPin = `${comp.id}.neg`;
      voltageSources.push({
        compId: comp.id,
        isPrimaryVs: true,
        pPin,
        nPin,
        p: getNode(pPin),
        n: getNode(nPin),
        V: parseComponentValue(comp.value, 5),
      });
    } else if (comp.type === 'ESP32_30Pin') {
      const p3v3 = `${comp.id}.3V3`;
      voltageSources.push({
        compId: comp.id,
        isPrimaryVs: false,
        pPin: p3v3,
        nPin: `${comp.id}.GND`,
        p: getNode(p3v3),
        n: 0,
        V: 3.3,
      });

      const gpioStates = esp32GpioStates[comp.id];
      if (gpioStates) {
        const esp32Meta = COMPONENT_METADATA.ESP32_30Pin;
        for (const [pinKey, value] of Object.entries(gpioStates)) {
          const lower = pinKey.toLowerCase();
          const match = esp32Meta.pins.find(
            (p) =>
              p.id.toLowerCase() === lower ||
              p.label.toLowerCase() === lower ||
              (p.aliases ?? []).some((alias) => alias.toLowerCase() === lower)
          );
          const resolvedId = match ? match.id : pinKey;
          const fullPin = `${comp.id}.${resolvedId}`;
          allPins.add(fullPin);
          voltageSources.push({
            compId: comp.id,
            isPrimaryVs: false,
            pPin: fullPin,
            nPin: `${comp.id}.GND`,
            p: getNode(fullPin),
            n: 0,
            V: value === 1 ? 3.3 : 0.0,
          });
        }
      }
    } else if (['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(comp.type)) {
      const yPin = `${comp.id}.Y`;
      voltageSources.push({
        compId: comp.id,
        isPrimaryVs: false,
        pPin: yPin,
        nPin: '',
        p: getNode(yPin),
        n: 0,
        V: pinStates[yPin] === 1 ? logicRail : 0.0,
      });
    } else if (comp.type === 'D_FlipFlop' || comp.type === 'JK_FlipFlop') {
      const qPin = `${comp.id}.Q`;
      const qBarPin = `${comp.id}.Q_BAR`;
      voltageSources.push(
        {
          compId: comp.id,
          isPrimaryVs: false,
          pPin: qPin,
          nPin: '',
          p: getNode(qPin),
          n: 0,
          V: pinStates[qPin] === 1 ? logicRail : 0.0,
        },
        {
          compId: comp.id,
          isPrimaryVs: false,
          pPin: qBarPin,
          nPin: '',
          p: getNode(qBarPin),
          n: 0,
          V: pinStates[qBarPin] === 1 ? logicRail : 0.0,
        }
      );
    } else if (comp.type === 'Clock') {
      const outPin = `${comp.id}.OUT`;
      voltageSources.push({
        compId: comp.id,
        isPrimaryVs: false,
        pPin: outPin,
        nPin: '',
        p: getNode(outPin),
        n: 0,
        V: pinStates[outPin] === 1 ? logicRail : 0.0,
      });
    } else if (comp.type === 'TP4056') {
      const batPlus = `${comp.id}.BAT+`;
      if (pinStates[batPlus] === 1) {
        voltageSources.push({
          compId: comp.id,
          isPrimaryVs: false,
          pPin: batPlus,
          nPin: `${comp.id}.BAT-`,
          p: getNode(batPlus),
          n: 0,
          V: 4.2,
        });
      }
    } else if (comp.type === 'Boost5V') {
      const vout = `${comp.id}.VOUT`;
      if (pinStates[vout] === 1) {
        voltageSources.push({
          compId: comp.id,
          isPrimaryVs: false,
          pPin: vout,
          nPin: `${comp.id}.GND2`,
          p: getNode(vout),
          n: 0,
          V: 5.0,
        });
      }
    } else if (comp.type === 'Resistor') {
      const pin1 = `${comp.id}.1`;
      const pin2 = `${comp.id}.2`;
      const R = Math.max(parseComponentValue(comp.value, 1000), 1e-6);
      passives.push({ compId: comp.id, pin1, pin2, n1: getNode(pin1), n2: getNode(pin2), R });
    } else if (comp.type === 'Switch') {
      const pin1 = `${comp.id}.1`;
      const pin2 = `${comp.id}.2`;
      const isClosed = switchStates[comp.id] ?? false;
      const R = isClosed ? 0.001 : 1e9;
      passives.push({ compId: comp.id, pin1, pin2, n1: getNode(pin1), n2: getNode(pin2), R });
    } else if (comp.type === 'Capacitor') {
      const pin1 = `${comp.id}.1`;
      const pin2 = `${comp.id}.2`;
      passives.push({ compId: comp.id, pin1, pin2, n1: getNode(pin1), n2: getNode(pin2), R: 1e9 });
    } else if (comp.type === 'Voltmeter') {
      const pin1 = `${comp.id}.pos`;
      const pin2 = `${comp.id}.neg`;
      passives.push({ compId: comp.id, pin1, pin2, n1: getNode(pin1), n2: getNode(pin2), R: 1e10 }); // 10 GΩ ideal input impedance
    } else if (comp.type === 'Ammeter') {
      const pin1 = `${comp.id}.pos`;
      const pin2 = `${comp.id}.neg`;
      passives.push({ compId: comp.id, pin1, pin2, n1: getNode(pin1), n2: getNode(pin2), R: 0.001 });
    } else if (comp.type === 'LED') {
      const aPin = `${comp.id}.anode`;
      const kPin = `${comp.id}.cathode`;
      diodes.push({
        compId: comp.id,
        aPin,
        kPin,
        a: getNode(aPin),
        k: getNode(kPin),
        Vf: 2.0,
        R_on: 10,
        R_off: 1e9,
        kind: 'LED',
      });
    } else if (comp.type === 'Buzzer') {
      const aPin = `${comp.id}.pos`;
      const kPin = `${comp.id}.neg`;
      diodes.push({
        compId: comp.id,
        aPin,
        kPin,
        a: getNode(aPin),
        k: getNode(kPin),
        Vf: 1.5,
        R_on: 50,
        R_off: 1e9,
        kind: 'Buzzer',
      });
    }
  }

  // 3b. 2-pass (up to diodes.length + 1) piecewise linear MNA solve
  const diodeOn = new Array<boolean>(diodes.length).fill(true);
  const mnaSize = numNodes + voltageSources.length;
  let solution = new Array<number>(mnaSize).fill(0);

  const maxDiodePasses = Math.max(2, diodes.length + 1);
  for (let pass = 0; pass < maxDiodePasses; pass++) {
    if (mnaSize === 0) break;

    const A: number[][] = Array.from({ length: mnaSize }, () => new Array<number>(mnaSize).fill(0));
    const b = new Array<number>(mnaSize).fill(0);

    // Tiny GMIN to ground prevents singular matrices on floating subcircuits
    for (let i = 0; i < numNodes; i++) {
      A[i][i] += 1e-12;
    }

    const stampConductance = (n1: number, n2: number, g: number) => {
      if (n1 > 0) A[n1 - 1][n1 - 1] += g;
      if (n2 > 0) A[n2 - 1][n2 - 1] += g;
      if (n1 > 0 && n2 > 0) {
        A[n1 - 1][n2 - 1] -= g;
        A[n2 - 1][n1 - 1] -= g;
      }
    };

    for (const p of passives) {
      stampConductance(p.n1, p.n2, 1 / p.R);
    }

    for (let dIdx = 0; dIdx < diodes.length; dIdx++) {
      const d = diodes[dIdx];
      if (diodeOn[dIdx]) {
        const g = 1 / d.R_on;
        stampConductance(d.a, d.k, g);
        const iEq = d.Vf * g;
        if (d.a > 0) b[d.a - 1] += iEq;
        if (d.k > 0) b[d.k - 1] -= iEq;
      } else {
        stampConductance(d.a, d.k, 1 / d.R_off);
      }
    }

    for (let vsIdx = 0; vsIdx < voltageSources.length; vsIdx++) {
      const vs = voltageSources[vsIdx];
      const row = numNodes + vsIdx;
      if (vs.p > 0) {
        A[vs.p - 1][row] += 1;
        A[row][vs.p - 1] += 1;
      }
      if (vs.n > 0) {
        A[vs.n - 1][row] -= 1;
        A[row][vs.n - 1] -= 1;
      }
      A[row][row] -= 1e-6;
      b[row] = vs.V;
    }

    solution = solveLinearSystem(A, b);

    let anyDiodeTurnedOff = false;
    for (let dIdx = 0; dIdx < diodes.length; dIdx++) {
      if (!diodeOn[dIdx]) continue;
      const d = diodes[dIdx];
      const va = d.a > 0 ? solution[d.a - 1] : 0;
      const vk = d.k > 0 ? solution[d.k - 1] : 0;
      const current = (va - vk - d.Vf) / d.R_on;
      if (current <= 0) {
        diodeOn[dIdx] = false;
        anyDiodeTurnedOff = true;
      }
    }

    if (!anyDiodeTurnedOff) break;
  }

  // 3c. Extract nodeVoltages, branchCurrents, componentResistances, ledStates, buzzerStates, overCurrent
  const nodeVoltages: Record<string, number> = {};
  for (const pin of allPins) {
    const nIdx = getNode(pin);
    nodeVoltages[pin] = nIdx > 0 ? solution[nIdx - 1] : 0;
  }

  const branchCurrents: Record<string, number> = {};
  const componentResistances: Record<string, number> = {};
  const overCurrent: Record<string, boolean> = {};
  const pinInCurrent: Record<string, number> = {};
  const addPinInCurrent = (pin: string, current: number) => {
    pinInCurrent[pin] = (pinInCurrent[pin] ?? 0) + current;
  };

  for (let vsIdx = 0; vsIdx < voltageSources.length; vsIdx++) {
    const vs = voltageSources[vsIdx];
    const iIntoPos = solution[numNodes + vsIdx] ?? 0;
    addPinInCurrent(vs.pPin, iIntoPos);
    if (vs.nPin) addPinInCurrent(vs.nPin, -iIntoPos);
    if (vs.isPrimaryVs) {
      branchCurrents[vs.compId] = -iIntoPos;
    }
  }

  for (const p of passives) {
    const v1 = p.n1 > 0 ? solution[p.n1 - 1] : 0;
    const v2 = p.n2 > 0 ? solution[p.n2 - 1] : 0;
    const current = (v1 - v2) / p.R;
    componentResistances[p.compId] = p.R;
    branchCurrents[p.compId] = current;
    addPinInCurrent(p.pin1, current);
    addPinInCurrent(p.pin2, -current);
  }

  const ledStates: Record<string, boolean> = {};
  const buzzerStates: Record<string, boolean> = {};

  for (let dIdx = 0; dIdx < diodes.length; dIdx++) {
    const d = diodes[dIdx];
    const va = d.a > 0 ? solution[d.a - 1] : 0;
    const vk = d.k > 0 ? solution[d.k - 1] : 0;
    const isOn = diodeOn[dIdx];
    const R_eff = isOn ? d.R_on : d.R_off;
    const current = isOn ? (va - vk - d.Vf) / d.R_on : (va - vk) / d.R_off;

    componentResistances[d.compId] = R_eff;
    branchCurrents[d.compId] = current;
    addPinInCurrent(d.aPin, current);
    addPinInCurrent(d.kPin, -current);

    const cathodeGrounded = Boolean(isGrounded[d.kPin]);
    const active = current > 0.0005 && cathodeGrounded;
    if (d.kind === 'LED') {
      ledStates[d.compId] = active;
    } else {
      buzzerStates[d.compId] = active;
    }
    if (current > 0.05) {
      overCurrent[d.compId] = true;
    }
  }

  // Compute wire (edge) branch currents from pin incidence
  const pinWireDegree: Record<string, number> = {};
  for (const conn of graph.connections) {
    const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
    pinWireDegree[srcPin] = (pinWireDegree[srcPin] ?? 0) + 1;
    pinWireDegree[tgtPin] = (pinWireDegree[tgtPin] ?? 0) + 1;
  }
  for (const conn of graph.connections) {
    const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
    if (pinWireDegree[srcPin] === 1 && pinInCurrent[srcPin] !== undefined) {
      branchCurrents[conn.id] = Math.abs(pinInCurrent[srcPin]);
    } else if (pinWireDegree[tgtPin] === 1 && pinInCurrent[tgtPin] !== undefined) {
      branchCurrents[conn.id] = Math.abs(pinInCurrent[tgtPin]);
    } else {
      branchCurrents[conn.id] = 0;
    }
  }

  // 3d. Compute Virtual Test Instrument Readings (Voltmeter, Ammeter, Ohmmeter)
  const instrumentReadings: Record<string, InstrumentReading> = {};

  const formatVoltageReading = (v: number): InstrumentReading => {
    if (Math.abs(v) < 1e-6) {
      return { display: '+0.00 V', rawValue: 0, unit: 'V', status: 'ok' };
    }
    const sign = v >= 0 ? '+' : '-';
    const abs = Math.abs(v);
    if (abs < 1) {
      return { display: `${sign}${(abs * 1000).toFixed(2)} mV`, rawValue: v, unit: 'mV', status: 'ok' };
    }
    return { display: `${sign}${abs.toFixed(2)} V`, rawValue: v, unit: 'V', status: 'ok' };
  };

  const formatCurrentReading = (i: number): InstrumentReading => {
    if (Math.abs(i) < 1e-9) {
      return { display: '+0.0 µA', rawValue: 0, unit: 'µA', status: 'ok' };
    }
    const sign = i >= 0 ? '+' : '-';
    const abs = Math.abs(i);
    if (abs < 1e-3) {
      return { display: `${sign}${(abs * 1e6).toFixed(1)} µA`, rawValue: i, unit: 'µA', status: 'ok' };
    }
    if (abs < 1) {
      return { display: `${sign}${(abs * 1000).toFixed(2)} mA`, rawValue: i, unit: 'mA', status: 'ok' };
    }
    return { display: `${sign}${abs.toFixed(2)} A`, rawValue: i, unit: 'A', status: 'ok' };
  };

  const formatResistanceReading = (r: number): InstrumentReading => {
    if (!Number.isFinite(r) || r > 1e8) {
      return { display: 'OL', rawValue: null, unit: 'Ω', status: 'open' };
    }
    if (r < 1000) {
      return { display: `${r.toFixed(2)} Ω`, rawValue: r, unit: 'Ω', status: 'ok' };
    }
    if (r < 1e6) {
      return { display: `${(r / 1000).toFixed(2)} kΩ`, rawValue: r, unit: 'kΩ', status: 'ok' };
    }
    return { display: `${(r / 1e6).toFixed(2)} MΩ`, rawValue: r, unit: 'MΩ', status: 'ok' };
  };

  const ohmmeters = graph.components.filter((c) => c.type === 'Ohmmeter');
  let liveReachable: Set<string> | null = null;
  const getLiveReachable = (): Set<string> => {
    if (liveReachable) return liveReachable;
    const adj: Record<string, string[]> = {};
    const addEdge = (a: string, b: string) => {
      (adj[a] ||= []).push(b);
      (adj[b] ||= []).push(a);
    };
    for (const conn of graph.connections) {
      addEdge(`${conn.sourceComponentId}.${conn.sourcePinId}`, `${conn.targetComponentId}.${conn.targetPinId}`);
    }
    for (const comp of graph.components) {
      if (comp.type === 'Resistor') {
        addEdge(`${comp.id}.1`, `${comp.id}.2`);
      } else if (comp.type === 'Switch' && (switchStates[comp.id] ?? false)) {
        addEdge(`${comp.id}.1`, `${comp.id}.2`);
      } else if (comp.type === 'Ammeter') {
        addEdge(`${comp.id}.pos`, `${comp.id}.neg`);
      } else if (comp.type === 'LED') {
        addEdge(`${comp.id}.anode`, `${comp.id}.cathode`);
      } else if (comp.type === 'Buzzer') {
        addEdge(`${comp.id}.pos`, `${comp.id}.neg`);
      }
    }

    const activeSources: string[] = [];
    for (const comp of graph.components) {
      if (comp.type === 'VoltageSource') {
        activeSources.push(`${comp.id}.pos`);
      } else if (comp.type === 'ESP32_30Pin') {
        activeSources.push(`${comp.id}.3V3`);
        if (pinStates[`${comp.id}.VIN`] === 1) activeSources.push(`${comp.id}.VIN`);
        for (const pKey of activeSourcePins) {
          if (pKey.startsWith(`${comp.id}.`)) activeSources.push(pKey);
        }
      } else if (comp.type === 'Boost5V' && pinStates[`${comp.id}.VOUT`] === 1) {
        activeSources.push(`${comp.id}.VOUT`);
      } else if (comp.type === 'TP4056' && pinStates[`${comp.id}.BAT+`] === 1) {
        activeSources.push(`${comp.id}.BAT+`);
      } else if (['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'].includes(comp.type)) {
        if (pinStates[`${comp.id}.Y`] === 1) activeSources.push(`${comp.id}.Y`);
      } else if (comp.type === 'D_FlipFlop' || comp.type === 'JK_FlipFlop') {
        if (pinStates[`${comp.id}.Q`] === 1) activeSources.push(`${comp.id}.Q`);
        if (pinStates[`${comp.id}.Q_BAR`] === 1) activeSources.push(`${comp.id}.Q_BAR`);
      } else if (comp.type === 'Clock' && pinStates[`${comp.id}.OUT`] === 1) {
        activeSources.push(`${comp.id}.OUT`);
      }
    }

    const visited = new Set<string>();
    const stack = [...activeSources];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const nb of adj[cur] || []) {
        if (!visited.has(nb)) stack.push(nb);
      }
    }
    liveReachable = visited;
    return liveReachable;
  };

  for (const comp of graph.components) {
    if (comp.type === 'Voltmeter') {
      const vPos = nodeVoltages[`${comp.id}.pos`] ?? 0;
      const vNeg = nodeVoltages[`${comp.id}.neg`] ?? 0;
      instrumentReadings[comp.id] = formatVoltageReading(vPos - vNeg);
    } else if (comp.type === 'Ammeter') {
      const vPos = nodeVoltages[`${comp.id}.pos`] ?? 0;
      const vNeg = nodeVoltages[`${comp.id}.neg`] ?? 0;
      const current = (vPos - vNeg) / 0.001;
      instrumentReadings[comp.id] = formatCurrentReading(current);
    } else if (comp.type === 'Ohmmeter') {
      const pin1 = `${comp.id}.1`;
      const pin2 = `${comp.id}.2`;
      const liveSet = getLiveReachable();
      if (liveSet.has(pin1) || liveSet.has(pin2)) {
        instrumentReadings[comp.id] = {
          display: 'ERR / LIVE',
          rawValue: null,
          unit: 'Ω',
          status: 'live_error',
        };
        continue;
      }

      // Isolated test-current pass: inject I_test = 1 mA into pin1 with pin2 tied to 0V reference
      const isoParent = new Map<string, string>();
      const isoFind = (x: string): string => {
        let p = isoParent.get(x);
        if (p === undefined) {
          isoParent.set(x, x);
          return x;
        }
        while (p !== isoParent.get(p)!) p = isoParent.get(p)!;
        let cur = x;
        while (cur !== p) {
          const next = isoParent.get(cur)!;
          isoParent.set(cur, p);
          cur = next;
        }
        return p;
      };
      const isoUnion = (a: string, b: string) => {
        const ra = isoFind(a);
        const rb = isoFind(b);
        if (ra !== rb) isoParent.set(rb, ra);
      };

      const isoPins = new Set<string>([pin1, pin2]);
      isoFind(pin1);
      isoFind(pin2);
      for (const conn of graph.connections) {
        const s = `${conn.sourceComponentId}.${conn.sourcePinId}`;
        const t = `${conn.targetComponentId}.${conn.targetPinId}`;
        isoPins.add(s);
        isoPins.add(t);
        isoUnion(s, t);
      }

      const refRoot = isoFind(pin2);
      const pin1Root = isoFind(pin1);
      if (pin1Root === refRoot) {
        componentResistances[comp.id] = 0;
        instrumentReadings[comp.id] = formatResistanceReading(0);
        continue;
      }

      const isoNodeMap = new Map<string, number>();
      let isoNumNodes = 0;
      for (const p of isoPins) {
        const r = isoFind(p);
        if (r === refRoot) {
          isoNodeMap.set(r, 0);
        } else if (!isoNodeMap.has(r)) {
          isoNumNodes++;
          isoNodeMap.set(r, isoNumNodes);
        }
      }
      const getIsoNode = (p: string) => isoNodeMap.get(isoFind(p)) ?? 0;

      const A_iso: number[][] = Array.from({ length: isoNumNodes }, () => new Array<number>(isoNumNodes).fill(0));
      const b_iso = new Array<number>(isoNumNodes).fill(0);
      for (let i = 0; i < isoNumNodes; i++) A_iso[i][i] += 1e-12;

      const stampIso = (pA: string, pB: string, R: number) => {
        const nA = getIsoNode(pA);
        const nB = getIsoNode(pB);
        const g = 1 / Math.max(R, 1e-6);
        if (nA > 0) A_iso[nA - 1][nA - 1] += g;
        if (nB > 0) A_iso[nB - 1][nB - 1] += g;
        if (nA > 0 && nB > 0) {
          A_iso[nA - 1][nB - 1] -= g;
          A_iso[nB - 1][nA - 1] -= g;
        }
      };

      for (const c of graph.components) {
        if (c.type === 'Resistor') {
          stampIso(`${c.id}.1`, `${c.id}.2`, parseComponentValue(c.value, 1000));
        } else if (c.type === 'Switch') {
          stampIso(`${c.id}.1`, `${c.id}.2`, (switchStates[c.id] ?? false) ? 0.001 : 1e9);
        } else if (c.type === 'Ammeter') {
          stampIso(`${c.id}.pos`, `${c.id}.neg`, 0.001);
        } else if (c.type === 'Voltmeter') {
          stampIso(`${c.id}.pos`, `${c.id}.neg`, 1e10); // 10 GΩ ideal input impedance
        } else if (c.type === 'Capacitor') {
          stampIso(`${c.id}.1`, `${c.id}.2`, 1e9);
        }
      }

      const n1 = getIsoNode(pin1);
      const I_TEST = 0.001;
      if (n1 > 0) b_iso[n1 - 1] += I_TEST;

      const vIso = solveLinearSystem(A_iso, b_iso);
      const v1 = n1 > 0 ? vIso[n1 - 1] : 0;
      const rEq = v1 / I_TEST;
      componentResistances[comp.id] = rEq > 1e8 ? 1e9 : rEq;
      instrumentReadings[comp.id] = formatResistanceReading(rEq);
    }
  }
  void ohmmeters;

  // 4. Evaluate energized status of connection wires
  const edgeStates: Record<string, 0 | 1> = {};
  for (const conn of graph.connections) {
    const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
    const srcVoltage = nodeVoltages[srcPin] ?? 0;
    const tgtVoltage = nodeVoltages[tgtPin] ?? 0;
    const edgeCurrent = branchCurrents[conn.id] ?? 0;
    const hasClosedGroundPath = Boolean(isGrounded[srcPin] || isGrounded[tgtPin]);
    const hasCurrentFlow = Math.abs(edgeCurrent) > 1e-7 && hasClosedGroundPath;
    const hasEnergizedVoltage = srcVoltage >= 1.5 || tgtVoltage >= 1.5;
    edgeStates[conn.id] = hasCurrentFlow || hasEnergizedVoltage ? 1 : 0;
  }

  // 5. Strict I2C device validation.
  // A device only comes `online` when its VCC sits on a live power rail, its GND
  // is grounded, and SDA/SCL reach the ESP32 I2C pins (GPIO21 / GPIO22).
  const i2cDevices: Record<string, I2cDeviceState> = {};
  const netAdjacency: Record<string, string[]> = {};
  const link = (a: string, b: string) => {
    (netAdjacency[a] ||= []).push(b);
    (netAdjacency[b] ||= []).push(a);
  };
  for (const conn of graph.connections) {
    link(
      `${conn.sourceComponentId}.${conn.sourcePinId}`,
      `${conn.targetComponentId}.${conn.targetPinId}`
    );
  }
  for (const comp of graph.components) {
    if (comp.type === 'Resistor') {
      link(`${comp.id}.1`, `${comp.id}.2`);
    } else if (comp.type === 'Switch' && (switchStates[comp.id] ?? false)) {
      link(`${comp.id}.1`, `${comp.id}.2`);
    }
  }

  const netIdOf = new Map<string, number>();
  let netCounter = 0;
  for (const pin of Object.keys(netAdjacency)) {
    if (netIdOf.has(pin)) continue;
    const stack = [pin];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (netIdOf.has(cur)) continue;
      netIdOf.set(cur, netCounter);
      for (const nb of netAdjacency[cur] || []) {
        if (!netIdOf.has(nb)) stack.push(nb);
      }
    }
    netCounter++;
  }
  const sameNet = (a: string, b: string): boolean => {
    const na = netIdOf.get(a);
    const nb = netIdOf.get(b);
    return na !== undefined && nb !== undefined && na === nb;
  };

  const esp32Comp = graph.components.find((c) => c.type === 'ESP32_30Pin');

  for (const comp of graph.components) {
    const type = comp.type as I2cDeviceType;
    const address = (I2C_ADDRESSES as Record<string, number | undefined>)[type];
    if (address === undefined) continue;

    const vccOk = pinStates[`${comp.id}.VCC`] === 1;
    const gndOk = Boolean(isGrounded[`${comp.id}.GND`]);
    const sdaOk = esp32Comp ? sameNet(`${comp.id}.SDA`, `${esp32Comp.id}.GPIO21`) : false;
    const sclOk = esp32Comp ? sameNet(`${comp.id}.SCL`, `${esp32Comp.id}.GPIO22`) : false;
    const powered = vccOk && gndOk;
    const wired = sdaOk && sclOk;

    i2cDevices[comp.id] = {
      componentId: comp.id,
      type,
      address,
      powered,
      wired,
      online: powered && wired,
    };
  }

  return {
    pinStates,
    isGrounded,
    ledStates,
    buzzerStates,
    edgeStates,
    flipFlopStates,
    i2cDevices,
    nodeVoltages,
    branchCurrents,
    componentResistances,
    overCurrent,
    instrumentReadings,
  };
}