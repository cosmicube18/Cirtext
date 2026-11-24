import type { CircuitGraph } from '../types/circuit.ts';

export interface SimulationResult {
  pinStates: Record<string, 0 | 1>; // `${componentId}.${pinId}` -> 0 or 1
  ledStates: Record<string, boolean>; // `${componentId}` -> boolean (true = lit)
  edgeStates: Record<string, 0 | 1>; // `${edgeId}` -> 0 or 1
}

/**
 * Solves DC logic propagation and digital gate evaluation across the circuit graph.
 * Supports VoltageSources, Grounds, Switches, Resistors, Capacitors, Logic Gates, and LEDs.
 */
export function runCircuitSimulation(
  graph: CircuitGraph,
  switchStates: Record<string, boolean>
): SimulationResult {
  const pinStates: Record<string, 0 | 1> = {};
  const gndReachable = new Set<string>();

  // 1. Initialize fixed power sources and default logic gate pins
  for (const comp of graph.components) {
    if (comp.type === 'VoltageSource') {
      pinStates[`${comp.id}.pos`] = 1;
      pinStates[`${comp.id}.neg`] = 0;
      gndReachable.add(`${comp.id}.neg`);
    } else if (comp.type === 'Ground') {
      pinStates[`${comp.id}.1`] = 0;
      gndReachable.add(`${comp.id}.1`);
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

    // A. Propagate through passive conductive components (Switch, Resistor, Capacitor)
    for (const comp of graph.components) {
      if (comp.type === 'Switch') {
        const isClosed = switchStates[comp.id] ?? false;
        if (isClosed) {
          const pin1 = `${comp.id}.1`;
          const pin2 = `${comp.id}.2`;
          // Signal bridging
          if ((pinStates[pin1] === 1 || pinStates[pin2] === 1) && (!pinStates[pin1] || !pinStates[pin2])) {
            pinStates[pin1] = 1;
            pinStates[pin2] = 1;
            changed = true;
          }
          // Ground bridging
          if (gndReachable.has(pin1) && !gndReachable.has(pin2)) {
            gndReachable.add(pin2);
            changed = true;
          } else if (gndReachable.has(pin2) && !gndReachable.has(pin1)) {
            gndReachable.add(pin1);
            changed = true;
          }
        }
      } else if (comp.type === 'Resistor' || comp.type === 'Capacitor') {
        const pin1 = `${comp.id}.1`;
        const pin2 = `${comp.id}.2`;
        // Signal bridging
        if ((pinStates[pin1] === 1 || pinStates[pin2] === 1) && (!pinStates[pin1] || !pinStates[pin2])) {
          pinStates[pin1] = 1;
          pinStates[pin2] = 1;
          changed = true;
        }
        // Ground bridging
        if (gndReachable.has(pin1) && !gndReachable.has(pin2)) {
          gndReachable.add(pin2);
          changed = true;
        } else if (gndReachable.has(pin2) && !gndReachable.has(pin1)) {
          gndReachable.add(pin1);
          changed = true;
        }
      } else if (comp.type === 'LED') {
        // Reverse ground path through LED cathode
        const cathode = `${comp.id}.cathode`;
        const anode = `${comp.id}.anode`;
        if (gndReachable.has(cathode) && !gndReachable.has(anode)) {
          // Cathode connects to ground
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
      if (
        (targetComp?.type === 'Resistor' || targetComp?.type === 'Switch' || targetComp?.type === 'Capacitor') &&
        pinStates[tgtPin] === 1 &&
        pinStates[srcPin] !== 1
      ) {
        pinStates[srcPin] = 1;
        changed = true;
      }

      // Bidirectional ground reachability
      if (gndReachable.has(srcPin) && !gndReachable.has(tgtPin)) {
        gndReachable.add(tgtPin);
        changed = true;
      }
      if (gndReachable.has(tgtPin) && !gndReachable.has(srcPin)) {
        gndReachable.add(srcPin);
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

  // 3. Evaluate LED illumination state
  // LED turns on when anode is HIGH (1) AND cathode has a conductive path to Ground
  const ledStates: Record<string, boolean> = {};
  for (const comp of graph.components) {
    if (comp.type === 'LED') {
      const anodeHigh = pinStates[`${comp.id}.anode`] === 1;
      const cathodeGround = gndReachable.has(`${comp.id}.cathode`);
      ledStates[comp.id] = anodeHigh && cathodeGround;
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
    ledStates,
    edgeStates,
  };
}
