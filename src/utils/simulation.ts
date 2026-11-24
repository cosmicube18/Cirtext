import type { CircuitGraph } from '../types/circuit.ts';

export interface SimulationResult {
  pinStates: Record<string, 0 | 1>; // `${componentId}.${pinId}` -> 1 = HIGH, 0 = LOW / unenergized
  isGrounded: Record<string, boolean>; // `${componentId}.${pinId}` -> true ONLY if path to Ground.1 or VoltageSource.neg exists
  ledStates: Record<string, boolean>; // `${componentId}` -> boolean (true = lit in closed loop)
  edgeStates: Record<string, 0 | 1>; // `${edgeId}` -> 0 or 1 (1 = energized/live)
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
  switchStates: Record<string, boolean>
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

    // B. Propagate across connection wires
    for (const conn of graph.connections) {
      const srcPin = `${conn.sourceComponentId}.${conn.sourcePinId}`;
      const tgtPin = `${conn.targetComponentId}.${conn.targetPinId}`;

      // Forward signal propagation
      if (pinStates[srcPin] === 1 && pinStates[tgtPin] !== 1) {
        pinStates[tgtPin] = 1;
        changed = true;
      }

      // Reverse signal propagation for bidirectional elements
      const targetComp = graph.components.find((c) => c.id === conn.targetComponentId);
      const sourceComp = graph.components.find((c) => c.id === conn.sourceComponentId);

      if (
        (targetComp?.type === 'Resistor' || targetComp?.type === 'Switch') &&
        pinStates[tgtPin] === 1 &&
        pinStates[srcPin] !== 1
      ) {
        pinStates[srcPin] = 1;
        changed = true;
      }

      if (
        (sourceComp?.type === 'Resistor' || sourceComp?.type === 'Switch') &&
        pinStates[tgtPin] === 1 &&
        pinStates[srcPin] !== 1
      ) {
        pinStates[srcPin] = 1;
        changed = true;
      }

      // Bidirectional ground reachability across wires
      if (isGrounded[srcPin] && !isGrounded[tgtPin]) {
        isGrounded[tgtPin] = true;
        changed = true;
      }
      if (isGrounded[tgtPin] && !isGrounded[srcPin]) {
        isGrounded[srcPin] = true;
        changed = true;
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
  };
}
