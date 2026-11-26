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

export interface SimulationResult {
  pinStates: Record<string, 0 | 1>;
  isGrounded: Record<string, boolean>;
  ledStates: Record<string, boolean>;
  buzzerStates: Record<string, boolean>;
  edgeStates: Record<string, 0 | 1>;
  flipFlopStates: FlipFlopStates;
  i2cDevices: Record<string, I2cDeviceState>;
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

  // 2. Iterative relaxation loop (up to 16 passes for signal and ground convergence)
  const MAX_ITERATIONS = 16;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    // A. Propagate through passive conductive components (Switch, Resistor)
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
      } else if (comp.type === 'Resistor') {
        const pin1 = `${comp.id}.1`;
        const pin2 = `${comp.id}.2`;

        // Bidirectional signal bridging
        if ((pinStates[pin1] === 1 || pinStates[pin2] === 1) && (!pinStates[pin1] || !pinStates[pin2])) {
          pinStates[pin1] = 1;
          pinStates[pin2] = 1;
          changed = true;
        }

        // Bidirectional ground bridging through current-limiting resistor
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
      // ESP32_30Pin: VIN (5V in) -> 3V3 (3.3V out), GND/GND2 always grounded
      if (comp.type === 'ESP32_30Pin') {
        const vinPin = `${comp.id}.VIN`;
        const v33Pin = `${comp.id}.3V3`;
        const gndPin = `${comp.id}.GND`;
        const gnd2Pin = `${comp.id}.GND2`;

        // If VIN is HIGH (5V supplied), drive 3V3 HIGH (regulator output)
        if (pinStates[vinPin] === 1 && pinStates[v33Pin] !== 1) {
          pinStates[v33Pin] = 1;
          changed = true;
        }
        // Back-powering: if 3V3 is externally driven HIGH, keep it HIGH
        // (already handled by net propagation, but ensure GNDs stay grounded)
        if (isGrounded[gndPin] && !isGrounded[gnd2Pin]) {
          isGrounded[gnd2Pin] = true;
          changed = true;
        } else if (isGrounded[gnd2Pin] && !isGrounded[gndPin]) {
          isGrounded[gndPin] = true;
          changed = true;
        }
      }

      // TP4056: IN+/IN- (charge input) -> BAT+/BAT- (battery output)
      else if (comp.type === 'TP4056') {
        const inPlusPin = `${comp.id}.IN+`;
        const inMinusPin = `${comp.id}.IN-`;
        const batPlusPin = `${comp.id}.BAT+`;
        const batMinusPin = `${comp.id}.BAT-`;

        // Charging active: IN+ HIGH AND IN- grounded -> BAT+ HIGH (charging ~4.2V)
        const charging = pinStates[inPlusPin] === 1 && isGrounded[inMinusPin];
        if (charging && pinStates[batPlusPin] !== 1) {
          pinStates[batPlusPin] = 1;
          changed = true;
        }
        // If no charging input, assume battery connected -> BAT+ HIGH (simplified)
        else if (!charging && pinStates[batPlusPin] === 0) {
          // Check if BAT+ is connected to anything (has net connections)
          // For simplicity, treat as HIGH if any load could be connected
          // In practice, net propagation will handle external drive
        }
        // BAT- always grounded
        if (isGrounded[batMinusPin] && !isGrounded[inMinusPin]) {
          isGrounded[inMinusPin] = true;
          changed = true;
        }
      }

      // Boost5V: VIN/GND (battery in) -> VOUT/GND2 (5V out)
      else if (comp.type === 'Boost5V') {
        const vinPin = `${comp.id}.VIN`;
        const gndPin = `${comp.id}.GND`;
        const voutPin = `${comp.id}.VOUT`;
        const gnd2Pin = `${comp.id}.GND2`;

        // Boost active: VIN HIGH AND GND grounded -> VOUT HIGH (5V output)
        const boosting = pinStates[vinPin] === 1 && isGrounded[gndPin];
        if (boosting && pinStates[voutPin] !== 1) {
          pinStates[voutPin] = 1;
          changed = true;
        }
        // GND and GND2 always same potential (both grounded)
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
    // Build adjacency list of pins connected by wires AND passive component internal connections
    const pinAdjacency: Record<string, string[]> = {};
    
    // Add wire connections
    for (const conn of graph.connections) {
      const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
      const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
      if (!pinAdjacency[srcPin]) pinAdjacency[srcPin] = [];
      if (!pinAdjacency[tgtPin]) pinAdjacency[tgtPin] = [];
      pinAdjacency[srcPin].push(tgtPin);
      pinAdjacency[tgtPin].push(srcPin);
    }
    
    // Add passive component internal connections (Resistor.1 <-> Resistor.2 always, Switch only when closed)
    for (const comp of graph.components) {
      if (comp.type === 'Resistor') {
        const pin1 = `${comp.id}.1`;
        const pin2 = `${comp.id}.2`;
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

    // Find all nets using DFS
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

    // For each net, find driver outputs and propagate their value to all pins in the net
    // Driver outputs: VoltageSource pos, Logic gate Y, Flip-Flop Q/Q_BAR, Clock OUT, Power outputs (3V3, BAT+, VOUT)
    const driverPinIds = new Set(['pos', 'Y', 'Q', 'Q_BAR', 'OUT', '3V3', 'BAT+', 'VOUT']);
    for (const net of nets) {
      let driverValue: 0 | 1 | null = null;
      let hasDriver = false;

      // Find driver value in this net
      for (const pin of net) {
        const pinName = pin.split('.').pop() || '';
        if (driverPinIds.has(pinName) || activeSourcePins.has(pin)) {
          const val = pinStates[pin] ?? 0;
          if (!hasDriver) {
            driverValue = val;
            hasDriver = true;
          } else if (driverValue !== val) {
            // Multiple drivers with conflicting values - net is contested, leave as-is
            hasDriver = false;
            break;
          }
        }
      }

      // Propagate driver value to all pins in net
      if (hasDriver && driverValue !== null) {
        for (const pin of net) {
          if (pinStates[pin] !== driverValue) {
            pinStates[pin] = driverValue;
            changed = true;
          }
        }
      }

      // Bidirectional ground reachability across the entire net
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
      const isGate = [
        'AND',
        'OR',
        'NOT',
        'NAND',
        'NOR',
        'XOR',
        'XNOR',
      ].includes(comp.type);

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

      // Sequential Logic Evaluation (D_FlipFlop, JK_FlipFlop) with edge detection.
      // Edge polarity matches standard 74xx parts:
      //   - D_FlipFlop  (e.g. 74LS74): POSITIVE-edge, latches on CLK 0 -> 1.
      //   - JK_FlipFlop (e.g. 74LS73/74LS76): NEGATIVE-edge, latches on CLK 1 -> 0.
      // The negative-edge JK is what makes a ripple counter wired Q -> CLK of the
      // next stage (with J = K = 1) count UP (0, 1, 2, 3, ...).
      if (comp.type === 'D_FlipFlop' || comp.type === 'JK_FlipFlop') {
        const compId = comp.id;
        const currClk = (pinStates[`${compId}.CLK`] ?? 0) === 1;

        // Initialize or retrieve flip-flop state
        if (!flipFlopStates[compId]) {
          flipFlopStates[compId] = { q: false, prevClk: false };
        }
        const ffState = flipFlopStates[compId];

        // Rising edge: CLK went from LOW to HIGH (D flip-flop active edge)
        const risingEdge = !ffState.prevClk && currClk;
        // Falling edge: CLK went from HIGH to LOW (JK flip-flop active edge)
        const fallingEdge = ffState.prevClk && !currClk;

        if (comp.type === 'D_FlipFlop' && risingEdge) {
          const inD = pinStates[`${compId}.D`] ?? 0;
          ffState.q = inD === 1;
        } else if (comp.type === 'JK_FlipFlop' && fallingEdge) {
          const inJ = pinStates[`${compId}.J`] ?? 0;
          const inK = pinStates[`${compId}.K`] ?? 0;

          if (inJ === 0 && inK === 0) {
            // Hold: q stays the same
          } else if (inJ === 0 && inK === 1) {
            ffState.q = false; // Reset
          } else if (inJ === 1 && inK === 0) {
            ffState.q = true; // Set
          } else if (inJ === 1 && inK === 1) {
            ffState.q = !ffState.q; // Toggle
          }
        }

        // Always update prevClk for next evaluation
        ffState.prevClk = currClk;

        // Drive outputs
        const outQ: 0 | 1 = ffState.q ? 1 : 0;
        const outQBar: 0 | 1 = ffState.q ? 0 : 1;

        if (pinStates[`${compId}.Q`] !== outQ) {
          pinStates[`${compId}.Q`] = outQ;
          changed = true;
        }
        if (pinStates[`${compId}.Q_BAR`] !== outQBar) {
          pinStates[`${compId}.Q_BAR`] = outQBar;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // 3. Evaluate LED illumination state:
  // An LED ONLY lights up when anode is HIGH (1) AND cathode is GROUNDED (closed return path)
  const ledStates: Record<string, boolean> = {};
  for (const comp of graph.components) {
    if (comp.type === 'LED') {
      const anodeHigh = pinStates[`${comp.id}.anode`] === 1;
      const cathodeGrounded = Boolean(isGrounded[`${comp.id}.cathode`]);
      ledStates[comp.id] = anodeHigh && cathodeGrounded;
    }
  }

  // 3b. Evaluate buzzer state:
  const buzzerStates: Record<string, boolean> = {};
  for (const comp of graph.components) {
    if (comp.type === 'Buzzer') {
      const posHigh = pinStates[`${comp.id}.pos`] === 1;
      const negGrounded = Boolean(isGrounded[`${comp.id}.neg`]);
      buzzerStates[comp.id] = posHigh && negGrounded;
    }
  }

  // 4. Evaluate energized status of connection wires
  const edgeStates: Record<string, 0 | 1> = {};
  for (const conn of graph.connections) {
    const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
    const isLive = pinStates[srcPin] === 1 || pinStates[tgtPin] === 1 ? 1 : 0;
    edgeStates[conn.id] = isLive;
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
  };
}