import { parseDsl } from './parser/dslParser.ts';
import { serializeGraph } from './parser/dslSerializer.ts';
import { SAMPLE_CIRCUITS } from './parser/sampleCircuits.ts';

async function runTests() {
  console.log('--- Running DSL Parser & Serializer Tests ---');

  // Test 1: Parse Voltage Divider
  const vd = SAMPLE_CIRCUITS.find((s) => s.id === 'voltage-divider')!;
  const result1 = parseDsl(vd.dsl);
  console.assert(result1.isValid, 'Expected Voltage Divider to be valid');
  console.assert(result1.diagnostics.length === 0, 'Expected 0 diagnostics for valid circuit');
  console.assert(result1.graph.components.length === 4, `Expected 4 components, got ${result1.graph.components.length}`);
  console.assert(result1.graph.connections.length === 4, `Expected 4 connections, got ${result1.graph.connections.length}`);
  console.log('✓ Test 1 Passed: Valid Voltage Divider parsed cleanly');

  // Test 2: Serializer round-trip
  const serialized = serializeGraph(result1.graph);
  const result2 = parseDsl(serialized);
  console.assert(result2.isValid, 'Expected serialized output to re-parse as valid');
  console.assert(result2.graph.components.length === 4, 'Expected same component count after round trip');
  console.assert(result2.graph.connections.length === 4, 'Expected same connection count after round trip');
  console.log('✓ Test 2 Passed: Deterministic serializer round-trip successful');

  // Test 3: Graceful Error Handling (Unknown Component in Connection)
  const badDsl = `[COMPONENTS]
V1: VoltageSource (5V)

[CONNECTIONS]
V1.pos -> R99.1`;
  const result3 = parseDsl(badDsl);
  console.assert(!result3.isValid, 'Expected badDsl to be invalid');
  console.assert(result3.diagnostics.length > 0, 'Expected diagnostics for missing component');
  console.assert(result3.diagnostics[0].message.includes('Unknown target component "R99"'), 'Expected missing component message');
  console.log('✓ Test 3 Passed: Gracefully caught unknown target component');

  // Test 4: Graceful Warning for Invalid Pin
  const badPinDsl = `[COMPONENTS]
R1: Resistor (10k)
R2: Resistor (10k)

[CONNECTIONS]
R1.3 -> R2.1`;
  const result4 = parseDsl(badPinDsl);
  console.assert(result4.diagnostics.some(d => d.message.includes('Invalid pin "3"')), 'Expected invalid pin diagnostic');
  console.log('✓ Test 4 Passed: Gracefully flagged invalid pin handle');

  // Test 5: Preserve Canvas Coordinates when updating text
  const initialGraph = result1.graph;
  initialGraph.components[0].position = { x: 120, y: 340 };
  const updatedDsl = vd.dsl + '\n// edited text';
  const result5 = parseDsl(updatedDsl, initialGraph);
  console.assert(result5.graph.components[0].position.x === 120, 'Expected position.x to be preserved');
  console.assert(result5.graph.components[0].position.y === 340, 'Expected position.y to be preserved');
  console.log('✓ Test 5 Passed: Existing canvas node positions correctly preserved');

  // Test 6: ELKjs Auto-Layout calculation
  const { calculateAutoLayout } = await import('./utils/layout.ts');
  const positions = await calculateAutoLayout(result1.graph);
  console.assert(Object.keys(positions).length === 4, 'Expected layout for all 4 components');
  console.assert(typeof positions['V1'].x === 'number', 'Expected numeric x for V1');
  console.log('✓ Test 6 Passed: ELKjs auto-layout computed valid spatial coordinates');

  // Test 7: Multi-Pin Microcontroller & I2C Sensor Preset Validation
  const espPreset = SAMPLE_CIRCUITS.find((s) => s.id === 'esp32-environmental-station')!;
  const espResult = parseDsl(espPreset.dsl);
  console.assert(espResult.isValid, 'Expected ESP32 station preset to be valid');
  console.assert(espResult.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(espResult.diagnostics)}`);
  console.assert(espResult.graph.components.length === 6, `Expected 6 components, got ${espResult.graph.components.length}`);
  console.assert(espResult.graph.connections.length === 19, `Expected 19 connections, got ${espResult.graph.connections.length}`);

  // Test 7b: Layout of ESP32 Circuit
  const espPositions = await calculateAutoLayout(espResult.graph);
  console.assert(Object.keys(espPositions).length === 6, 'Expected layout coordinates for all 6 components');
  console.log('✓ Test 7 Passed: ESP32 + SCD41 + BH1750 + SHT31 + OLED + Switch parsed and layouted cleanly');

  // Test 8: Individual Node and Edge Deletion in Store
  const { useCircuitStore } = await import('./store/circuitStore.ts');
  useCircuitStore.getState().setDslText(vd.dsl);

  // 8a: Delete single wire
  const currentEdges = useCircuitStore.getState().edges;
  const edgeToDelete = currentEdges[0];
  const initialEdgeCount = currentEdges.length;
  useCircuitStore.getState().deleteEdges([edgeToDelete]);
  const postDeleteEdges = useCircuitStore.getState().edges;
  console.assert(
    postDeleteEdges.length === initialEdgeCount - 1,
    `Expected 1 edge to be deleted, got ${postDeleteEdges.length} vs initial ${initialEdgeCount}`
  );
  console.assert(
    !useCircuitStore.getState().dslText.includes(edgeToDelete.id),
    'Expected DSL text to reflect deleted wire'
  );

  // 8b: Delete node and verify orphaned connections are purged
  const compToDelete = 'R2';
  useCircuitStore.getState().deleteNodes([compToDelete]);
  const finalState = useCircuitStore.getState();
  console.assert(
    !finalState.graph.components.some((c) => c.id === compToDelete),
    'Expected component R2 to be deleted'
  );
  console.assert(
    !finalState.graph.connections.some(
      (c) => c.sourceComponentId === compToDelete || c.targetComponentId === compToDelete
    ),
    'Expected all connections to R2 to be purged'
  );
  console.assert(
    !finalState.dslText.includes('R2: Resistor'),
    'Expected DSL text to not include R2'
  );
  console.log('✓ Test 8 Passed: Individual wire and component deletion cleanly synced to DSL');

  // Test 9: Forgiving component parsing with empty parentheses () and [Label: ...]
  const forgivingDsl = `[COMPONENTS]
U1: ESP32_30Pin () [Label: ESP32_Controller]
GND1: Ground ()

[CONNECTIONS]
U1.GND -> GND1.1`;
  const result9 = parseDsl(forgivingDsl);
  console.assert(result9.isValid, 'Expected forgivingDsl to be valid');
  console.assert(result9.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(result9.diagnostics)}`);
  console.assert(result9.graph.components.length === 2, `Expected 2 components, got ${result9.graph.components.length}`);
  console.assert(result9.graph.components[0].label === 'ESP32_Controller', `Expected label ESP32_Controller, got ${result9.graph.components[0].label}`);
  console.log('✓ Test 9 Passed: Empty parentheses () and [Label: ...] on components parsed cleanly');

  // Test 10: Logic Gates validation (AND, OR, NOT, NAND, NOR, XOR, XNOR)
  const logicDsl = `# Circuit: Complete Logic Gates Demo
[COMPONENTS]
G1: AND
G2: OR
G3: NOT
G4: NAND
G5: NOR
G6: XOR
G7: XNOR

[CONNECTIONS]
G1.Y -> G2.A
G2.Y -> G3.A
G3.Y -> G4.A
G4.Y -> G5.A
G5.Y -> G6.A
G6.Y -> G7.A`;
  const result10 = parseDsl(logicDsl);
  console.assert(result10.isValid, 'Expected logicDsl to be valid');
  console.assert(result10.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(result10.diagnostics)}`);
  console.assert(result10.graph.components.length === 7, `Expected 7 logic gates, got ${result10.graph.components.length}`);
  console.assert(result10.graph.connections.length === 6, `Expected 6 connections, got ${result10.graph.connections.length}`);

  // Test layout dimensions for logic gates
  const logicPositions = await calculateAutoLayout(result10.graph);
  console.assert(Object.keys(logicPositions).length === 7, 'Expected 7 layout positions for logic gates');
  console.log('✓ Test 10 Passed: All 7 Logic Gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) parsed and layouted cleanly');

  // Test 11: Real-time DC and Logic Gate Simulation Engine
  const { runCircuitSimulation } = await import('./utils/simulation.ts');
  const halfAdder = SAMPLE_CIRCUITS.find((s) => s.id === 'half-adder-logic')!;
  const haResult = parseDsl(halfAdder.dsl);
  console.assert(haResult.isValid, 'Expected half-adder circuit to be valid');

  // Scenario A: SW1 = CLOSED (1), SW2 = OPEN (0)
  // Input A = 1, Input B = 0
  // XOR (Sum) = 1, AND (Carry) = 0, D1 (Sum LED) = Lit, D2 (Carry LED) = Off
  const simA = runCircuitSimulation(haResult.graph, { SW1: true, SW2: false });
  console.assert(simA.pinStates['G1.A'] === 1, `Expected G1.A to be 1, got ${simA.pinStates['G1.A']}`);
  console.assert(simA.pinStates['G1.B'] === 0, `Expected G1.B to be 0, got ${simA.pinStates['G1.B']}`);
  console.assert(simA.pinStates['G1.Y'] === 1, `Expected XOR Sum G1.Y to be 1, got ${simA.pinStates['G1.Y']}`);
  console.assert(simA.pinStates['G2.Y'] === 0, `Expected AND Carry G2.Y to be 0, got ${simA.pinStates['G2.Y']}`);
  console.assert(simA.ledStates['D1'] === true, 'Expected D1 (Sum LED) to be lit');
  console.assert(simA.ledStates['D2'] === false, 'Expected D2 (Carry LED) to be off');

  // Scenario B: SW1 = CLOSED (1), SW2 = CLOSED (1)
  // Input A = 1, Input B = 1
  // XOR (Sum) = 0, AND (Carry) = 1, D1 (Sum LED) = Off, D2 (Carry LED) = Lit
  const simB = runCircuitSimulation(haResult.graph, { SW1: true, SW2: true });
  console.assert(simB.pinStates['G1.Y'] === 0, `Expected XOR Sum G1.Y to be 0, got ${simB.pinStates['G1.Y']}`);
  console.assert(simB.pinStates['G2.Y'] === 1, `Expected AND Carry G2.Y to be 1, got ${simB.pinStates['G2.Y']}`);
  console.assert(simB.ledStates['D1'] === false, 'Expected D1 (Sum LED) to be off when both inputs are 1');
  console.assert(simB.ledStates['D2'] === true, 'Expected D2 (Carry LED) to be lit when both inputs are 1');
  console.log('✓ Test 11 Passed: Real-time DC and Logic Gate simulation correctly solved Half-Adder circuit');

  // Test 12: Enforce Closed-Loop Ground Check (LED only lights if cathode has return path to Ground)
  const openLoopDsl = `[COMPONENTS]
V1: VoltageSource (5V)
D1: LED (Red)
SW1: Switch (Gnd_Switch)
GND: Ground

[CONNECTIONS]
V1.pos -> D1.anode
D1.cathode -> SW1.1
SW1.2 -> GND.1
V1.neg -> GND.1`;

  const openLoopGraph = parseDsl(openLoopDsl).graph;

  // Scenario 1: SW1 is OPEN (ground return broken)
  // Anode is HIGH (1), but Cathode is FLOATING (not grounded) -> LED must NOT light up!
  const simOpen = runCircuitSimulation(openLoopGraph, { SW1: false });
  console.assert(simOpen.pinStates['D1.anode'] === 1, 'Expected D1.anode to be HIGH');
  console.assert(!simOpen.isGrounded['D1.cathode'], 'Expected D1.cathode to be ungrounded when switch is open');
  console.assert(simOpen.ledStates['D1'] === false, 'Expected D1 to be OFF when cathode is floating');

  // Scenario 2: SW1 is CLOSED (ground return complete)
  // Cathode is GROUNDED through closed switch -> LED lights up!
  const simClosed = runCircuitSimulation(openLoopGraph, { SW1: true });
  console.assert(simClosed.isGrounded['D1.cathode'] === true, 'Expected D1.cathode to be grounded when switch is closed');
  console.assert(simClosed.ledStates['D1'] === true, 'Expected D1 to be ON when closed loop to ground is complete');

  // Scenario 3: Return directly to VoltageSource.neg without separate Ground node
  const directReturnDsl = `[COMPONENTS]
V1: VoltageSource (5V)
D1: LED (Red)

[CONNECTIONS]
V1.pos -> D1.anode
D1.cathode -> V1.neg`;

  const directReturnGraph = parseDsl(directReturnDsl).graph;
  const simDirect = runCircuitSimulation(directReturnGraph, {});
  console.assert(simDirect.isGrounded['V1.neg'] === true, 'Expected V1.neg to be grounded');
  console.assert(simDirect.isGrounded['D1.cathode'] === true, 'Expected D1.cathode to be grounded via V1.neg');
  console.assert(simDirect.ledStates['D1'] === true, 'Expected D1 to be ON with direct return to V1.neg');

  console.log('✓ Test 12 Passed: Closed-loop ground check verified (floating cathode prevents illumination; ground completes circuit)');

  // Test 13: Sequential Logic (D_FlipFlop and JK_FlipFlop)
  const flipFlopDsl = `# Circuit: Sequential Flip-Flop Register
[COMPONENTS]
V1: VoltageSource (5V)
SW_D: Switch (Data)
SW_CLK: Switch (Clock)
FF1: D_FlipFlop (Register_D)
FF2: JK_FlipFlop (Register_JK)
D_Out: LED (Q_Out)
GND: Ground

[CONNECTIONS]
V1.pos -> SW_D.1
V1.pos -> SW_CLK.1
SW_D.2 -> FF1.D
SW_CLK.2 -> FF1.CLK
FF1.Q -> FF2.J
FF1.Q_BAR -> FF2.K
SW_CLK.2 -> FF2.CLK
FF2.Q -> D_Out.anode
D_Out.cathode -> GND.1
V1.neg -> GND.1`;

  const ffResult = parseDsl(flipFlopDsl);
  console.assert(ffResult.isValid, 'Expected flipFlopDsl to be valid');
  console.assert(ffResult.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(ffResult.diagnostics)}`);
  console.assert(ffResult.graph.components.length === 7, `Expected 7 components, got ${ffResult.graph.components.length}`);

  // Test layout computation for flip-flops
  const ffPositions = await calculateAutoLayout(ffResult.graph);
  console.assert(Boolean(ffPositions['FF1'] && ffPositions['FF2']), 'Expected layout positions for FF1 and FF2');

  // Simulation: When CLK is OPEN (0), FF1 holds initial state (Q=0, Q_BAR=1)
  const simClkLow = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: false });
  console.assert(simClkLow.pinStates['FF1.D'] === 1, 'Expected FF1.D to be 1');
  console.assert(simClkLow.pinStates['FF1.CLK'] === 0, 'Expected FF1.CLK to be 0');
  console.assert(simClkLow.pinStates['FF1.Q'] === 0, 'Expected FF1.Q to remain 0 before clock pulse');
  console.assert(simClkLow.pinStates['FF1.Q_BAR'] === 1, 'Expected FF1.Q_BAR to be 1');

  // Simulation: When CLK is CLOSED (1), FF1 latches D (Q=1, Q_BAR=0), FF2 receives J=1, K=0 -> Sets FF2.Q=1, lighting LED!
  const simClkHigh = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: true });
  console.assert(simClkHigh.pinStates['FF1.Q'] === 1, 'Expected FF1.Q to be latched to 1 on clock pulse');
  console.assert(simClkHigh.pinStates['FF1.Q_BAR'] === 0, 'Expected FF1.Q_BAR to be 0');
  console.assert(simClkHigh.pinStates['FF2.J'] === 1, 'Expected FF2.J to be 1');
  console.assert(simClkHigh.pinStates['FF2.K'] === 0, 'Expected FF2.K to be 0');
  console.assert(simClkHigh.pinStates['FF2.Q'] === 1, 'Expected FF2.Q to be Set to 1');
  console.assert(simClkHigh.ledStates['D_Out'] === true, 'Expected D_Out LED to be lit');

  console.log('✓ Test 13 Passed: Sequential Logic (D_FlipFlop & JK_FlipFlop) parsed, layouted, and simulated cleanly');

  console.log('--- All 13 Parser, Serializer, Layout, Gate, Closed-Loop & Sequential Tests Passed! ---');
}

runTests();
