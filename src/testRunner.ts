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

  console.log('--- All 9 Parser, Serializer, Layout & Deletion Tests Passed! ---');
}

runTests();
