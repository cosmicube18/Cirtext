import type { CircuitGraph } from '../types/circuit.ts';

export interface FlipFlopState {
  q: boolean;
  prevClk: boolean;
}

export type FlipFlopStates = Record<string, FlipFlopState>;

export interface SimulationResult {
  pinStates: Record<string, 0 | 1>;
  isGrounded: Record<string, boolean>;
  ledStates: Record<string, boolean>;
  edgeStates: Record<string, 0 | 1>;
  flipFlopStates: FlipFlopStates;
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
  flipFlopStates: FlipFlopStates = {}
): SimulationResult {
  const pinStates: Record<string, 0 | 1> = {};
  const isGrounded: Record<string, boolean> = {};

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
      pinStates[`${comp.id}.Q`] = 0;
      pinStates[`${comp.id}.Q_BAR`] = 1;
    } else if (comp.type === 'JK_FlipFlop') {
      pinStates[`${comp.id}.J`] = 0;
      pinStates[`${comp.id}.CLK`] = 0;
      pinStates[`${comp.id}.K`] = 0;
      pinStates[`${comp.id}.Q`] = 0;
      pinStates[`${comp.id}.Q_BAR`] = 1;
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
    
    // Add passive component internal connections (Switch.1 <-> Switch.2, Resistor.1 <-> Resistor.2)
    for (const comp of graph.components) {
      if (comp.type === 'Switch' || comp.type === 'Resistor') {
        const pin1 = `${comp.id}.1`;
        const pin2 = `${comp.id}.2`;
        if (!pinAdjacency[pin1]) pinAdjacency[pin1] = [];
        if (!pinAdjacency[pin2]) pinAdjacency[pin2] = [];
        pinAdjacency[pin1].push(pin2);
        pinAdjacency[pin2].push(pin1);
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
    // Driver outputs: VoltageSource pos, Logic gate Y, Flip-Flop Q/Q_BAR
    const driverPinIds = new Set(['pos', 'Y', 'Q', 'Q_BAR']);
    for (const net of nets) {
      let driverValue: 0 | 1 | null = null;
      let hasDriver = false;

      // Find driver value in this net
      for (const pin of net) {
        const pinName = pin.split('.').pop() || '';
        if (driverPinIds.has(pinName)) {
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

      // Sequential Logic Evaluation (D_FlipFlop, JK_FlipFlop) with rising-edge detection
      if (comp.type === 'D_FlipFlop' || comp.type === 'JK_FlipFlop') {
        const compId = comp.id;
        const currClk = (pinStates[`${compId}.CLK`] ?? 0) === 1;

        // Initialize or retrieve flip-flop state
        if (!flipFlopStates[compId]) {
          flipFlopStates[compId] = { q: false, prevClk: false };
        }
        const ffState = flipFlopStates[compId];

        // Rising edge detection: CLK went from LOW to HIGH
        const risingEdge = !ffState.prevClk && currClk;

        if (risingEdge) {
          if (comp.type === 'D_FlipFlop') {
            const inD = pinStates[`${compId}.D`] ?? 0;
            ffState.q = inD === 1;
          } else if (comp.type === 'JK_FlipFlop') {
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

  // 4. Evaluate energized status of connection wires
  const edgeStates: Record<string, 0 | 1> = {};
  for (const conn of graph.connections) {
    const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
    const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;
    const isLive = pinStates[srcPin] === 1 || pinStates[tgtPin] === 1 ? 1 : 0;
    edgeStates[conn.id] = isLive;
  }

  return {
    pinStates,
    isGrounded,
    ledStates,
    edgeStates,
    flipFlopStates,
  };
}