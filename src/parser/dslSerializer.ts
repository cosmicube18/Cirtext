import type { CircuitGraph, CircuitComponent, CircuitConnection } from '../types/circuit.ts';

/**
 * Serializes a CircuitGraph into canonical, clean DSL text.
 * Generates deterministic output with aligned syntax.
 */
export function serializeGraph(graph: CircuitGraph): string {
  const parts: string[] = [];

  // Preamble / Title
  const title = graph.title?.trim() || 'Circuit Diagram';
  parts.push(`# Circuit: ${title}`);
  parts.push('');

  // [COMPONENTS] Section
  parts.push('[COMPONENTS]');
  const sortedComponents = [...graph.components].sort(compareComponents);

  if (sortedComponents.length === 0) {
    parts.push('# (No components added yet)');
  } else {
    for (const comp of sortedComponents) {
      parts.push(formatComponentLine(comp));
    }
  }

  parts.push('');

  // [CONNECTIONS] Section
  parts.push('[CONNECTIONS]');
  const sortedConnections = [...graph.connections].sort(compareConnections);

  if (sortedConnections.length === 0) {
    parts.push('# (No connections added yet)');
  } else {
    for (const conn of sortedConnections) {
      parts.push(formatConnectionLine(conn));
    }
  }

  return parts.join('\n');
}

/**
 * Formats a single component definition line.
 * e.g. "R1: Resistor (10k)" or "GND: Ground"
 */
function formatComponentLine(comp: CircuitComponent): string {
  let line = `${comp.id}: ${comp.type}`;
  if (comp.value && comp.value.trim() !== '') {
    line += ` (${comp.value.trim()})`;
  }
  if (comp.label && comp.label.trim() !== '') {
    line += ` [Label: ${comp.label.trim()}]`;
  }
  return line;
}

/**
 * Formats a single connection line.
 * e.g. "V1.pos -> R1.1" or "R1.2 -> R2.1 [Label: V_out]"
 */
function formatConnectionLine(conn: CircuitConnection): string {
  let line = `${conn.sourceComponentId}.${conn.sourcePinId} -> ${conn.targetComponentId}.${conn.targetPinId}`;
  if (conn.netLabel && conn.netLabel.trim() !== '') {
    line += ` [Label: ${conn.netLabel.trim()}]`;
  }
  return line;
}

/**
 * Natural ordering for component list:
 * Sources first, then passives, then diodes/LEDs, then grounds, sub-sorted alphabetically.
 */
function compareComponents(a: CircuitComponent, b: CircuitComponent): number {
  const priorityOrder: Record<string, number> = {
    VoltageSource: 1,
    ESP32_30Pin: 2,
    AND: 3,
    OR: 3,
    NOT: 3,
    NAND: 3,
    NOR: 3,
    XOR: 3,
    XNOR: 3,
    Switch: 4,
    Resistor: 5,
    Capacitor: 6,
    LED: 7,
    Buzzer: 7.5,
    SCD41: 8,
    BH1750: 9,
    SHT31: 10,
    OLED_SSD1306: 11,
    Ground: 12,
  };

  const prioA = priorityOrder[a.type] ?? 99;
  const prioB = priorityOrder[b.type] ?? 99;

  if (prioA !== prioB) {
    return prioA - prioB;
  }

  return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Deterministic ordering for connections.
 */
function compareConnections(a: CircuitConnection, b: CircuitConnection): number {
  const srcCompare = a.sourceComponentId.localeCompare(b.sourceComponentId, undefined, {
    numeric: true,
  });
  if (srcCompare !== 0) return srcCompare;

  return a.targetComponentId.localeCompare(b.targetComponentId, undefined, {
    numeric: true,
  });
}
