import { parseDsl } from './parser/dslParser.ts';
import { serializeGraph } from './parser/dslSerializer.ts';
import { SAMPLE_CIRCUITS } from './parser/sampleCircuits.ts';
import { type FlipFlopStates } from './utils/simulation.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function runTests() {
  console.log('--- Running DSL Parser & Serializer Tests ---');

  // Test 1: Parse Voltage Divider
  const vd = SAMPLE_CIRCUITS.find((s) => s.id === 'voltage-divider')!;
  const result1 = parseDsl(vd.dsl);
  assert(result1.isValid, 'Expected Voltage Divider to be valid');
  assert(result1.diagnostics.length === 0, 'Expected 0 diagnostics for valid circuit');
  assert(result1.graph.components.length === 4, `Expected 4 components, got ${result1.graph.components.length}`);
  assert(result1.graph.connections.length === 4, `Expected 4 connections, got ${result1.graph.connections.length}`);
  console.log('✓ Test 1 Passed: Valid Voltage Divider parsed cleanly');

  // Test 2: Serializer round-trip
  const serialized = serializeGraph(result1.graph);
  const result2 = parseDsl(serialized);
  assert(result2.isValid, 'Expected serialized output to re-parse as valid');
  assert(result2.graph.components.length === 4, 'Expected same component count after round trip');
  assert(result2.graph.connections.length === 4, 'Expected same connection count after round trip');
  console.log('✓ Test 2 Passed: Deterministic serializer round-trip successful');

  // Test 3: Graceful Error Handling (Unknown Component in Connection)
  const badDsl = `[COMPONENTS]
V1: VoltageSource (5V)

[CONNECTIONS]
V1.pos -> R99.1`;
  const result3 = parseDsl(badDsl);
  assert(!result3.isValid, 'Expected badDsl to be invalid');
  assert(result3.diagnostics.length > 0, 'Expected diagnostics for missing component');
  assert(result3.diagnostics[0].message.includes('Unknown target component "R99"'), 'Expected missing component message');
  console.log('✓ Test 3 Passed: Gracefully caught unknown target component');

  // Test 4: Graceful Warning for Invalid Pin
  const badPinDsl = `[COMPONENTS]
R1: Resistor (10k)
R2: Resistor (10k)

[CONNECTIONS]
R1.3 -> R2.1`;
  const result4 = parseDsl(badPinDsl);
  assert(result4.diagnostics.some(d => d.message.includes('Invalid pin "3"')), 'Expected invalid pin diagnostic');
  console.log('✓ Test 4 Passed: Gracefully flagged invalid pin handle');

  // Test 5: Preserve Canvas Coordinates when updating text
  const initialGraph = result1.graph;
  initialGraph.components[0].position = { x: 120, y: 340 };
  const updatedDsl = vd.dsl + '\n// edited text';
  const result5 = parseDsl(updatedDsl, initialGraph);
  assert(result5.graph.components[0].position.x === 120, 'Expected position.x to be preserved');
  assert(result5.graph.components[0].position.y === 340, 'Expected position.y to be preserved');
  console.log('✓ Test 5 Passed: Existing canvas node positions correctly preserved');

  // Test 6: ELKjs Auto-Layout calculation
  const { calculateAutoLayout } = await import('./utils/layout.ts');
  const positions = await calculateAutoLayout(result1.graph);
  assert(Object.keys(positions).length === 4, 'Expected layout for all 4 components');
  assert(typeof positions['V1'].x === 'number', 'Expected numeric x for V1');
  console.log('✓ Test 6 Passed: ELKjs auto-layout computed valid spatial coordinates');

  // Test 7: Multi-Pin Microcontroller & I2C Sensor Preset Validation
  const espPreset = SAMPLE_CIRCUITS.find((s) => s.id === 'esp32-environmental-station')!;
  const espResult = parseDsl(espPreset.dsl);
  assert(espResult.isValid, 'Expected ESP32 station preset to be valid');
  assert(espResult.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(espResult.diagnostics)}`);
  assert(espResult.graph.components.length === 6, `Expected 6 components, got ${espResult.graph.components.length}`);
  assert(espResult.graph.connections.length === 19, `Expected 19 connections, got ${espResult.graph.connections.length}`);

  // Test 7b: Layout of ESP32 Circuit
  const espPositions = await calculateAutoLayout(espResult.graph);
  assert(Object.keys(espPositions).length === 6, 'Expected layout coordinates for all 6 components');
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
  assert(
    postDeleteEdges.length === initialEdgeCount - 1,
    `Expected 1 edge to be deleted, got ${postDeleteEdges.length} vs initial ${initialEdgeCount}`
  );
  assert(
    !useCircuitStore.getState().dslText.includes(edgeToDelete.id),
    'Expected DSL text to reflect deleted wire'
  );

  // 8b: Delete node and verify orphaned connections are purged
  const compToDelete = 'R2';
  useCircuitStore.getState().deleteNodes([compToDelete]);
  const finalState = useCircuitStore.getState();
  assert(
    !finalState.graph.components.some((c) => c.id === compToDelete),
    'Expected component R2 to be deleted'
  );
  assert(
    !finalState.graph.connections.some(
      (c) => c.sourceComponentId === compToDelete || c.targetComponentId === compToDelete
    ),
    'Expected all connections to R2 to be purged'
  );
  assert(
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
  assert(result9.isValid, 'Expected forgivingDsl to be valid');
  assert(result9.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(result9.diagnostics)}`);
  assert(result9.graph.components.length === 2, `Expected 2 components, got ${result9.graph.components.length}`);
  assert(result9.graph.components[0].label === 'ESP32_Controller', `Expected label ESP32_Controller, got ${result9.graph.components[0].label}`);
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
  assert(result10.isValid, 'Expected logicDsl to be valid');
  assert(result10.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(result10.diagnostics)}`);
  assert(result10.graph.components.length === 7, `Expected 7 logic gates, got ${result10.graph.components.length}`);
  assert(result10.graph.connections.length === 6, `Expected 6 connections, got ${result10.graph.connections.length}`);

  // Test layout dimensions for logic gates
  const logicPositions = await calculateAutoLayout(result10.graph);
  assert(Object.keys(logicPositions).length === 7, 'Expected 7 layout positions for logic gates');
  console.log('✓ Test 10 Passed: All 7 Logic Gates (AND, OR, NOT, NAND, NOR, XOR, XNOR) parsed and layouted cleanly');

  // Test 11: Real-time DC and Logic Gate Simulation Engine
  const { runCircuitSimulation } = await import('./utils/simulation.ts');
  const halfAdder = SAMPLE_CIRCUITS.find((s) => s.id === 'half-adder-logic')!;
  const haResult = parseDsl(halfAdder.dsl);
  assert(haResult.isValid, 'Expected half-adder circuit to be valid');

  // Scenario A: SW1 = CLOSED (1), SW2 = OPEN (0)
  // Input A = 1, Input B = 0
  // XOR (Sum) = 1, AND (Carry) = 0, D1 (Sum LED) = Lit, D2 (Carry LED) = Off
  const simA = runCircuitSimulation(haResult.graph, { SW1: true, SW2: false });
  assert(simA.pinStates['G1.A'] === 1, `Expected G1.A to be 1, got ${simA.pinStates['G1.A']}`);
  assert(simA.pinStates['G1.B'] === 0, `Expected G1.B to be 0, got ${simA.pinStates['G1.B']}`);
  assert(simA.pinStates['G1.Y'] === 1, `Expected XOR Sum G1.Y to be 1, got ${simA.pinStates['G1.Y']}`);
  assert(simA.pinStates['G2.Y'] === 0, `Expected AND Carry G2.Y to be 0, got ${simA.pinStates['G2.Y']}`);
  assert(simA.ledStates['D1'] === true, 'Expected D1 (Sum LED) to be lit');
  assert(simA.ledStates['D2'] === false, 'Expected D2 (Carry LED) to be off');

  // Scenario B: SW1 = CLOSED (1), SW2 = CLOSED (1)
  // Input A = 1, Input B = 1
  // XOR (Sum) = 0, AND (Carry) = 1, D1 (Sum LED) = Off, D2 (Carry LED) = Lit
  const simB = runCircuitSimulation(haResult.graph, { SW1: true, SW2: true });
  assert(simB.pinStates['G1.Y'] === 0, `Expected XOR Sum G1.Y to be 0, got ${simB.pinStates['G1.Y']}`);
  assert(simB.pinStates['G2.Y'] === 1, `Expected AND Carry G2.Y to be 1, got ${simB.pinStates['G2.Y']}`);
  assert(simB.ledStates['D1'] === false, 'Expected D1 (Sum LED) to be off when both inputs are 1');
  assert(simB.ledStates['D2'] === true, 'Expected D2 (Carry LED) to be lit when both inputs are 1');
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
  assert(simOpen.pinStates['D1.anode'] === 1, 'Expected D1.anode to be HIGH');
  assert(!simOpen.isGrounded['D1.cathode'], 'Expected D1.cathode to be ungrounded when switch is open');
  assert(simOpen.ledStates['D1'] === false, 'Expected D1 to be OFF when cathode is floating');

  // Scenario 2: SW1 is CLOSED (ground return complete)
  // Cathode is GROUNDED through closed switch -> LED lights up!
  const simClosed = runCircuitSimulation(openLoopGraph, { SW1: true });
  assert(simClosed.isGrounded['D1.cathode'] === true, 'Expected D1.cathode to be grounded when switch is closed');
  assert(simClosed.ledStates['D1'] === true, 'Expected D1 to be ON when closed loop to ground is complete');

  // Scenario 3: Return directly to VoltageSource.neg without separate Ground node
  const directReturnDsl = `[COMPONENTS]
V1: VoltageSource (5V)
D1: LED (Red)

[CONNECTIONS]
V1.pos -> D1.anode
D1.cathode -> V1.neg`;

  const directReturnGraph = parseDsl(directReturnDsl).graph;
  const simDirect = runCircuitSimulation(directReturnGraph, {});
  assert(simDirect.isGrounded['V1.neg'] === true, 'Expected V1.neg to be grounded');
  assert(simDirect.isGrounded['D1.cathode'] === true, 'Expected D1.cathode to be grounded via V1.neg');
  assert(simDirect.ledStates['D1'] === true, 'Expected D1 to be ON with direct return to V1.neg');

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
  assert(ffResult.isValid, 'Expected flipFlopDsl to be valid');
  assert(ffResult.diagnostics.length === 0, `Expected 0 diagnostics, got ${JSON.stringify(ffResult.diagnostics)}`);
  assert(ffResult.graph.components.length === 7, `Expected 7 components, got ${ffResult.graph.components.length}`);

  // Test layout computation for flip-flops
  const ffPositions = await calculateAutoLayout(ffResult.graph);
  assert(Boolean(ffPositions['FF1'] && ffPositions['FF2']), 'Expected layout positions for FF1 and FF2');

  // Use persistent flipFlopStates to simulate clock edge transitions across calls
  const flipFlopStates: FlipFlopStates = {};

  // 1. Initial state: CLK=0 (OPEN), D=1 held by SW_D
  const simInit = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: false }, flipFlopStates);
  assert(simInit.pinStates['FF1.D'] === 1, 'Expected FF1.D to be 1');
  assert(simInit.pinStates['FF1.CLK'] === 0, 'Expected FF1.CLK to be 0');
  assert(simInit.pinStates['FF1.Q'] === 0, 'Expected FF1.Q to be 0 initially');
  assert(simInit.pinStates['FF1.Q_BAR'] === 1, 'Expected FF1.Q_BAR to be 1 initially');

  // 2. Rising edge #1: CLK 0->1 (SW_CLK closes). FF1 (positive-edge) latches D=1.
  //    FF2 is a negative-edge JK flip-flop, so it does NOT trigger on a rising edge.
  const simPulse1 = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: true }, flipFlopStates);
  assert(simPulse1.pinStates['FF1.Q'] === 1, 'Expected FF1.Q to latch to 1 on first rising edge');
  assert(simPulse1.pinStates['FF1.Q_BAR'] === 0, 'Expected FF1.Q_BAR to be 0');
  assert(simPulse1.pinStates['FF2.Q'] === 0, 'Expected FF2.Q to remain 0 on a rising edge (JK is negative-edge)');

  // 3. Falling edge: CLK 1->0 (SW_CLK opens). FF1 (positive-edge) holds.
  //    FF2 (negative-edge) triggers: it now sees J=1 (FF1.Q), K=0 -> SET.
  const simFall = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: false }, flipFlopStates);
  assert(simFall.pinStates['FF1.Q'] === 1, 'Expected FF1.Q to hold on falling edge');
  assert(simFall.pinStates['FF2.Q'] === 1, 'Expected FF2.Q to be Set to 1 on the falling edge (JK negative-edge)');
  assert(simFall.ledStates['D_Out'] === true, 'Expected D_Out LED to be lit');

  // 4. Rising edge #2: CLK 0->1 (SW_CLK closes again). Neither flip-flop changes:
  //    FF1 holds (D still 1), FF2 (negative-edge) does not trigger on a rising edge.
  const simPulse2 = runCircuitSimulation(ffResult.graph, { SW_D: true, SW_CLK: true }, flipFlopStates);
  assert(simPulse2.pinStates['FF2.Q'] === 1, 'Expected FF2.Q to hold 1 on a rising edge (JK negative-edge)');
  assert(simPulse2.ledStates['D_Out'] === true, 'Expected D_Out LED to stay lit');

  console.log('✓ Test 13 Passed: Sequential Logic (D_FlipFlop & JK_FlipFlop) parsed, layouted, and simulated cleanly');

  // Test 14: Exact DC Modified Nodal Analysis (MNA) Math & Engineering Unit Parser
  const { parseComponentValue } = await import('./utils/simulation.ts');
  assert(parseComponentValue('10k', 1000) === 10000, 'Expected 10k -> 10000');
  assert(parseComponentValue('10k Ohm', 1000) === 10000, 'Expected 10k Ohm -> 10000');
  assert(parseComponentValue('220', 1000) === 220, 'Expected 220 -> 220');
  assert(parseComponentValue('4.7M', 1000) === 4700000, 'Expected 4.7M -> 4700000');
  assert(parseComponentValue('5V', 5) === 5, 'Expected 5V -> 5');
  assert(parseComponentValue('3.3V', 5) === 3.3, 'Expected 3.3V -> 3.3');
  assert(Math.abs(parseComponentValue('10uF', 10e-6) - 1e-5) < 1e-12, 'Expected 10uF -> 1e-5');
  assert(parseComponentValue('Status_LED', 1000) === 1000, 'Expected non-numeric fallback');

  const mnaDividerDsl = `[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
R2: Resistor (10k Ohm)
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> R2.1
R2.2 -> GND.1
V1.neg -> GND.1`;

  const mnaGraph = parseDsl(mnaDividerDsl).graph;
  const mnaSim = runCircuitSimulation(mnaGraph, {});
  const vTop = mnaSim.nodeVoltages['V1.pos'];
  const vMid = mnaSim.nodeVoltages['R1.2'];
  const vGnd = mnaSim.nodeVoltages['GND.1'];
  const iR1 = mnaSim.branchCurrents['R1'];
  const iR2 = mnaSim.branchCurrents['R2'];
  const iEdgeMid = mnaSim.branchCurrents['R1.2->R2.1'];

  assert(Math.abs(vTop - 5.0) < 1e-6, `Expected V1.pos = 5.0V, got ${vTop}`);
  assert(Math.abs(vMid - 2.5) < 1e-6, `Expected V_mid = 2.50V, got ${vMid}`);
  assert(Math.abs(vGnd - 0.0) < 1e-9, `Expected GND.1 = 0.0V, got ${vGnd}`);
  assert(Math.abs(iR1 - 0.00025) < 1e-7, `Expected I_R1 = 0.00025A (0.25mA), got ${iR1}`);
  assert(Math.abs(iR2 - 0.00025) < 1e-7, `Expected I_R2 = 0.00025A (0.25mA), got ${iR2}`);
  assert(Math.abs(iEdgeMid - 0.00025) < 1e-7, `Expected wire current = 0.00025A, got ${iEdgeMid}`);
  assert(mnaSim.componentResistances['R1'] === 10000, 'Expected R1 resistance = 10000');
  assert(mnaSim.componentResistances['R2'] === 10000, 'Expected R2 resistance = 10000');

  // Verify reverse-biased LED blocks current in 2-pass MNA
  const revLedDsl = `[COMPONENTS]
V1: VoltageSource (5V)
D1: LED (Red)
GND: Ground

[CONNECTIONS]
V1.pos -> D1.cathode
D1.anode -> GND.1
V1.neg -> GND.1`;
  const revLedSim = runCircuitSimulation(parseDsl(revLedDsl).graph, {});
  assert(revLedSim.ledStates['D1'] === false, 'Expected reverse-biased LED to be OFF');
  assert(revLedSim.branchCurrents['D1'] <= 0, `Expected reverse LED current <= 0, got ${revLedSim.branchCurrents['D1']}`);

  console.log('✓ Test 14 Passed: Exact DC MNA voltage divider (2.50V, 0.25mA), unit parser, and 2-pass LED check verified');

  // Test 15: Virtual Test Instruments (Voltmeter, Ammeter, Ohmmeter)
  const vmDsl = `[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
R2: Resistor (10k)
VM1: Voltmeter
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> R2.1
R2.2 -> GND.1
V1.neg -> GND.1
R2.1 -> VM1.pos
R2.2 -> VM1.neg`;

  const vmParsed = parseDsl(vmDsl);
  assert(vmParsed.isValid, `Expected vmDsl to be valid, got ${JSON.stringify(vmParsed.diagnostics)}`);
  const vmSim = runCircuitSimulation(vmParsed.graph, {});
  const vmReading = vmSim.instrumentReadings['VM1'];
  assert(vmReading && vmReading.status === 'ok', 'Expected VM1 status ok');
  assert(vmReading.display === '+2.50 V', `Expected VM1 reading "+2.50 V", got "${vmReading.display}"`);

  const amDsl = `[COMPONENTS]
V1: VoltageSource (5V)
AM1: Ammeter
R1: Resistor (10k)
R2: Resistor (10k)
GND: Ground

[CONNECTIONS]
V1.pos -> AM1.pos
AM1.neg -> R1.1
R1.2 -> R2.1
R2.2 -> GND.1
V1.neg -> GND.1`;

  const amParsed = parseDsl(amDsl);
  assert(amParsed.isValid, `Expected amDsl to be valid, got ${JSON.stringify(amParsed.diagnostics)}`);
  const amSim = runCircuitSimulation(amParsed.graph, {});
  const amReading = amSim.instrumentReadings['AM1'];
  assert(amReading && amReading.status === 'ok', 'Expected AM1 status ok');
  assert(amReading.display === '+250.0 µA', `Expected AM1 reading "+250.0 µA", got "${amReading.display}"`);
  assert(
    amReading.rawValue !== null && Math.abs(amReading.rawValue - 0.00025) < 1e-7,
    `Expected AM1 rawValue ~0.00025 A, got ${amReading.rawValue}`
  );

  // Ohmmeter across two unpowered 10k resistors in series -> 20.00 kΩ
  const ohmUnpoweredDsl = `[COMPONENTS]
R1: Resistor (10k)
R2: Resistor (10k)
OM1: Ohmmeter

[CONNECTIONS]
OM1.1 -> R1.1
R1.2 -> R2.1
R2.2 -> OM1.2`;
  const ohmUnpoweredParsed = parseDsl(ohmUnpoweredDsl);
  assert(ohmUnpoweredParsed.isValid, 'Expected ohmUnpoweredDsl to be valid');
  const ohmUnpoweredSim = runCircuitSimulation(ohmUnpoweredParsed.graph, {});
  const omOk = ohmUnpoweredSim.instrumentReadings['OM1'];
  assert(omOk && omOk.status === 'ok', `Expected OM1 status ok, got ${omOk?.status}`);
  assert(omOk.display === '20.00 kΩ', `Expected OM1 reading "20.00 kΩ", got "${omOk.display}"`);

  // Ohmmeter connected to a live 5V source -> live_error
  const ohmLiveDsl = `[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
OM1: Ohmmeter
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> GND.1
V1.neg -> GND.1
R1.1 -> OM1.1
R1.2 -> OM1.2`;
  const ohmLiveSim = runCircuitSimulation(parseDsl(ohmLiveDsl).graph, {});
  const omLive = ohmLiveSim.instrumentReadings['OM1'];
  assert(omLive && omLive.status === 'live_error', `Expected OM1 status live_error, got ${omLive?.status}`);
  assert(omLive.display === 'ERR / LIVE', `Expected OM1 display "ERR / LIVE", got "${omLive?.display}"`);

  console.log('✓ Test 15 Passed: Virtual Test Instruments (Voltmeter +2.50 V, Ammeter +250.0 µA, Ohmmeter 20.00 kΩ & live_error) verified');

  // Test 16: Proteus-Style Wire-to-Wire Junctions & branchFromEdge
  const branchBaseDsl = `[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
R2: Resistor (10k)
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> GND.1
V1.neg -> GND.1`;

  await useCircuitStore.getState().setDslText(branchBaseDsl);
  const targetEdgeId = 'V1.pos->R1.1';
  const jId = useCircuitStore.getState().branchFromEdge(targetEdgeId, { x: 155, y: 99 });
  assert(jId === 'J1', `Expected first junction ID "J1", got "${jId}"`);

  const branchedState = useCircuitStore.getState();
  const jComp = branchedState.graph.components.find((c) => c.id === 'J1');
  assert(Boolean(jComp && jComp.type === 'Junction'), 'Expected J1 Junction component in graph');
  assert(jComp!.position.x === 160 && jComp!.position.y === 96, `Expected 16px-snapped position (160, 96), got (${jComp!.position.x}, ${jComp!.position.y})`);
  assert(branchedState.dslText.includes('J1: Junction'), 'Expected "J1: Junction" in serialized DSL');
  assert(
    branchedState.graph.connections.some((c) => c.sourceComponentId === 'V1' && c.targetComponentId === 'J1' && c.targetPinId === '1'),
    'Expected V1.pos -> J1.1 connection'
  );
  assert(
    branchedState.graph.connections.some((c) => c.sourceComponentId === 'J1' && c.sourcePinId === '1' && c.targetComponentId === 'R1'),
    'Expected J1.1 -> R1.1 connection'
  );

  // Wire R2 in parallel from J1.1 to GND.1 and verify MNA merges J1.1 into the 5V net
  const parallelJunctionDsl = `[COMPONENTS]
V1: VoltageSource (5V)
AM1: Ammeter
J1: Junction
R1: Resistor (10k)
R2: Resistor (10k)
VM1: Voltmeter
GND: Ground

[CONNECTIONS]
V1.pos -> AM1.pos
AM1.neg -> J1.1
J1.1 -> R1.1
J1.1 -> R2.1
R1.2 -> GND.1
R2.2 -> GND.1
J1.1 -> VM1.pos
GND.1 -> VM1.neg
V1.neg -> GND.1`;

  const pjParsed = parseDsl(parallelJunctionDsl);
  assert(pjParsed.isValid, `Expected parallelJunctionDsl to be valid, got ${JSON.stringify(pjParsed.diagnostics)}`);
  const pjRoundTrip = parseDsl(serializeGraph(pjParsed.graph));
  assert(pjRoundTrip.isValid && pjRoundTrip.graph.connections.length === 9, 'Expected Junction DSL round-trip to preserve all 9 connections');

  const pjLayout = await calculateAutoLayout(pjParsed.graph);
  assert(Boolean(pjLayout['J1']), 'Expected ELKjs auto-layout to position J1');

  const pjSim = runCircuitSimulation(pjParsed.graph, {});
  assert(Math.abs(pjSim.nodeVoltages['J1.1'] - 5.0) < 1e-3, `Expected J1.1 = 5.0V, got ${pjSim.nodeVoltages['J1.1']}`);
  assert(pjSim.instrumentReadings['VM1']?.display === '+5.00 V', `Expected VM1 "+5.00 V", got "${pjSim.instrumentReadings['VM1']?.display}"`);
  assert(pjSim.instrumentReadings['AM1']?.display === '+1.00 mA', `Expected AM1 "+1.00 mA" for two parallel 10k resistors, got "${pjSim.instrumentReadings['AM1']?.display}"`);

  console.log('✓ Test 16 Passed: Wire-to-wire Junctions (branchFromEdge, DSL round-trip, ELKjs layout, and MNA parallel split) verified');

  // Verify downstream low-voltage closed-loop wires glow green when branchCurrent > 0.1 uA
  const lowVLoopDsl = `[COMPONENTS]
V1: VoltageSource (5V)
R2: Resistor (500)
AM1: Ammeter
GND: Ground

[CONNECTIONS]
V1.pos -> R2.1
R2.2 -> AM1.pos
AM1.neg -> GND.1
V1.neg -> GND.1`;
  const lowVSim = runCircuitSimulation(parseDsl(lowVLoopDsl).graph, {});
  assert(lowVSim.instrumentReadings['AM1']?.display === '+10.00 mA', `Expected +10.00 mA, got ${lowVSim.instrumentReadings['AM1']?.display}`);
  assert(lowVSim.edgeStates['R2.2->AM1.pos'] === 1, 'Expected R2.2->AM1.pos downstream wire to be active (1)');
  assert(lowVSim.edgeStates['AM1.neg->GND.1'] === 1, 'Expected AM1.neg->GND.1 return wire to be active (1)');

  // Test 17: 4-Bit D_FlipFlop Shift/Parallel Register across clock cycles (0 -> 1 -> 0 -> 1)
  const reg4BitDsl = `[COMPONENTS]
V1: VoltageSource (5V)
CLK1: Clock (2s)
SW0: Switch (Bit0)
SW1: Switch (Bit1)
G_INV: NOT
FF0: D_FlipFlop
FF1: D_FlipFlop
FF2: D_FlipFlop
FF3: D_FlipFlop
LED0: LED
LED1: LED
LED2: LED
LED3: LED
GND: Ground

[CONNECTIONS]
V1.pos -> SW0.1
V1.pos -> SW1.1
SW0.2 -> FF0.D
SW1.2 -> G_INV.A
G_INV.Y -> FF1.D
FF0.Q -> FF2.D
FF1.Q -> FF3.D
CLK1.OUT -> FF0.CLK
CLK1.OUT -> FF1.CLK
CLK1.OUT -> FF2.CLK
CLK1.OUT -> FF3.CLK
FF0.Q -> LED0.anode
FF1.Q -> LED1.anode
FF2.Q -> LED2.anode
FF3.Q -> LED3.anode
LED0.cathode -> GND.1
LED1.cathode -> GND.1
LED2.cathode -> GND.1
LED3.cathode -> GND.1
V1.neg -> GND.1`;

  const reg4Graph = parseDsl(reg4BitDsl).graph;
  const regFfStates: FlipFlopStates = {};

  // Cycle 0 (CLK = 0): SW0=1, SW1=0 -> FF0.D=1, FF1.D=1 (via NOT gate), all Qs initially 0
  const r0 = runCircuitSimulation(reg4Graph, { SW0: true, SW1: false }, regFfStates, false);
  for (const id of ['FF0', 'FF1', 'FF2', 'FF3']) {
    assert(r0.pinStates[`${id}.Q`] === 0, `Expected ${id}.Q=0 initially`);
    assert(r0.pinStates[`${id}.Q_BAR`] === 1, `Expected ${id}.Q_BAR=1 initially`);
  }

  // Rising edge #1 (CLK 0 -> 1): FF0 & FF1 latch D=1 (even with FF1.D driven by NOT gate!),
  // while FF2 & FF3 sample pre-edge FF0.Q=0 / FF1.Q=0 synchronously
  const r1 = runCircuitSimulation(reg4Graph, { SW0: true, SW1: false }, regFfStates, true);
  assert(r1.pinStates['FF0.Q'] === 1 && r1.pinStates['FF0.Q_BAR'] === 0, 'Expected FF0 Q=1, Q_BAR=0 after rising edge #1');
  assert(r1.pinStates['FF1.Q'] === 1 && r1.pinStates['FF1.Q_BAR'] === 0, 'Expected FF1 Q=1, Q_BAR=0 after rising edge #1');
  assert(r1.pinStates['FF2.Q'] === 0 && r1.pinStates['FF2.Q_BAR'] === 1, 'Expected FF2 Q=0, Q_BAR=1 (synchronous shift)');
  assert(r1.pinStates['FF3.Q'] === 0 && r1.pinStates['FF3.Q_BAR'] === 1, 'Expected FF3 Q=0, Q_BAR=1 (synchronous shift)');
  assert(r1.ledStates['LED0'] === true && r1.ledStates['LED1'] === true, 'Expected LED0 & LED1 ON');

  // Falling edge (CLK 1 -> 0): All D_FlipFlops hold
  const r2 = runCircuitSimulation(reg4Graph, { SW0: false, SW1: true }, regFfStates, false);
  assert(r2.pinStates['FF0.Q'] === 1 && r2.pinStates['FF0.Q_BAR'] === 0, 'Expected FF0 to hold on falling edge');
  assert(r2.pinStates['FF1.Q'] === 1 && r2.pinStates['FF1.Q_BAR'] === 0, 'Expected FF1 to hold on falling edge');

  // Rising edge #2 (CLK 0 -> 1): SW0=0, SW1=1 -> FF0.D=0, FF1.D=0; FF2 & FF3 capture previous FF0.Q=1 & FF1.Q=1
  const r3 = runCircuitSimulation(reg4Graph, { SW0: false, SW1: true }, regFfStates, true);
  assert(r3.pinStates['FF0.Q'] === 0 && r3.pinStates['FF0.Q_BAR'] === 1, 'Expected FF0 Q=0, Q_BAR=1 after rising edge #2');
  assert(r3.pinStates['FF1.Q'] === 0 && r3.pinStates['FF1.Q_BAR'] === 1, 'Expected FF1 Q=0, Q_BAR=1 after rising edge #2');
  assert(r3.pinStates['FF2.Q'] === 1 && r3.pinStates['FF2.Q_BAR'] === 0, 'Expected FF2 Q=1, Q_BAR=0 after rising edge #2');
  assert(r3.pinStates['FF3.Q'] === 1 && r3.pinStates['FF3.Q_BAR'] === 0, 'Expected FF3 Q=1, Q_BAR=0 after rising edge #2');
  assert(r3.ledStates['LED2'] === true && r3.ledStates['LED3'] === true, 'Expected LED2 & LED3 ON');

  console.log('✓ Test 17 Passed: 4-Bit D_FlipFlop register latches Q and Q_BAR=!Q synchronously across clock cycles');

  // Test 18: Voltmeter ideal input impedance (10 GΩ) — dual voltmeter across voltage divider
  // Circuit: V1 (5V) -> R1 (10k) -> R2 (1k) -> GND
  //          VM1 across R1 (pos=V1.pos node, neg=mid node)
  //          VM2 across R2 (pos=mid node, neg=GND)
  // Ideal divider: V_mid = 5 * 1000 / (10000 + 1000) = 5/11 ≈ 0.454545... V
  // VM2 must read exactly that (10 GΩ load negligible vs 11 kΩ divider)
  const vmDividerDsl = `# Circuit: Voltmeter Ideal Impedance Test
[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
R2: Resistor (1k)
VM1: Voltmeter
VM2: Voltmeter
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> R2.1
R2.2 -> GND.1
V1.neg -> GND.1
R1.1 -> VM1.pos
R2.1 -> VM1.neg
R2.1 -> VM2.pos
R2.2 -> VM2.neg`;

  const vmDivSim = runCircuitSimulation(parseDsl(vmDividerDsl).graph, {});

  const vm2 = vmDivSim.instrumentReadings['VM2'];
  assert(vm2 && vm2.status === 'ok', `Expected VM2 status ok, got ${vm2?.status}`);
  // rawValue is in Volts (the unformatted numeric value behind the display string)
  const vm2Raw = vm2.rawValue!;
  const expectedVM2 = 5 * 1000 / 11000; // ≈ 0.454545...
  assert(
    Math.abs(vm2Raw - expectedVM2) < 1e-3,
    `Expected VM2 ≈ ${expectedVM2.toFixed(6)} V, got ${vm2Raw} V (display: "${vm2.display}")`
  );

  const vm1 = vmDivSim.instrumentReadings['VM1'];
  assert(vm1 && vm1.status === 'ok', `Expected VM1 status ok, got ${vm1?.status}`);
  const vm1Raw = vm1.rawValue!;
  const expectedVM1 = 5 * 10000 / 11000; // ≈ 4.545454...
  assert(
    Math.abs(vm1Raw - expectedVM1) < 1e-3,
    `Expected VM1 ≈ ${expectedVM1.toFixed(6)} V, got ${vm1Raw} V (display: "${vm1.display}")`
  );

  console.log(`✓ Test 18 Passed: Voltmeter 10 GΩ ideal impedance — VM2=${vm2.display} (≈+454.55 mV), VM1=${vm1.display} (≈+4.55 V) across 10k/1k divider`);

  console.log('--- All 18 Parser, Serializer, Layout, Gate, Closed-Loop, Sequential, MNA, Instrument, Junction & Voltmeter-Impedance Tests Passed! ---');
}

runTests();
