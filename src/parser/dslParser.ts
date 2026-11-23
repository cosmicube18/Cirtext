import type {
  CircuitComponent,
  CircuitConnection,
  CircuitGraph,
  ParseDiagnostic,
  ParseResult,
} from '../types/circuit.ts';
import {
  COMPONENT_METADATA,
  normalizeComponentType,
  normalizePin,
} from '../types/circuit.ts';

type ParserSection = 'PREAMBLE' | 'COMPONENTS' | 'CONNECTIONS';

/**
 * Parses a circuit DSL string into a structured CircuitGraph.
 * Recovers gracefully from syntax errors and invalid identifiers,
 * producing non-blocking diagnostics for inline editor warnings.
 *
 * @param dslText The raw circuit text from the editor.
 * @param existingGraph Optional prior graph state to preserve canvas positions.
 */
export function parseDsl(dslText: string, existingGraph?: CircuitGraph): ParseResult {
  const lines = dslText.split(/\r?\n/);
  const diagnostics: ParseDiagnostic[] = [];
  const components: CircuitComponent[] = [];
  const componentMap = new Map<string, CircuitComponent>();
  const connections: CircuitConnection[] = [];

  // Build lookup of previous component coordinates to preserve canvas layout
  const existingPositions = new Map<string, { x: number; y: number; rotation?: 0 | 90 | 180 | 270 }>();
  if (existingGraph) {
    for (const comp of existingGraph.components) {
      existingPositions.set(comp.id, {
        x: comp.position.x,
        y: comp.position.y,
        rotation: comp.rotation,
      });
    }
  }

  let currentSection: ParserSection = 'PREAMBLE';
  let title = existingGraph?.title || 'Untitled Circuit';

  // Component regex: e.g., "V1: VoltageSource (5V)" or "GND: Ground" or "U1: ESP32_30Pin () [Label: Controller]"
  const componentRegex = /^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?(?:\s*\[(?:Label:\s*)?([^\]]*)\])?$/i;

  // Connection regex: e.g., "V1.pos -> R1.1" or "R1.2 -> R2.1 [Label: V_out]"
  const connectionRegex = /^([A-Za-z0-9_]+)\.([A-Za-z0-9_+\-]+)\s*(?:->|-->|to)\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_+\-]+)(?:\s*\[(?:Label:\s*)?([^\]]+)\])?$/i;

  lines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const trimmed = rawLine.trim();

    // 1. Skip blank lines
    if (!trimmed) {
      return;
    }

    // 2. Handle comment and title lines
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      const titleMatch = trimmed.match(/^(?:#|\/\/)\s*(?:Circuit\s*:\s*)?(.+)$/i);
      if (titleMatch && currentSection === 'PREAMBLE') {
        const extractedTitle = titleMatch[1].trim();
        if (extractedTitle && !extractedTitle.startsWith('[')) {
          title = extractedTitle;
        }
      }
      return;
    }

    // 3. Section Header Detection
    const sectionMatch = trimmed.match(/^\[([A-Za-z_]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].toUpperCase();
      if (sectionName === 'COMPONENTS') {
        currentSection = 'COMPONENTS';
        return;
      }
      if (sectionName === 'CONNECTIONS') {
        currentSection = 'CONNECTIONS';
        return;
      }

      diagnostics.push({
        line: lineNum,
        severity: 'warning',
        message: `Unknown section "[${sectionMatch[1]}]". Expected [COMPONENTS] or [CONNECTIONS].`,
        rawLine,
      });
      return;
    }

    // 4. Section: [COMPONENTS]
    if (currentSection === 'COMPONENTS') {
      const match = trimmed.match(componentRegex);
      if (!match) {
        diagnostics.push({
          line: lineNum,
          severity: 'warning',
          message: `Malformed component definition. Expected "ID: Type (Value)" e.g. "R1: Resistor (10k)".`,
          rawLine,
        });
        return;
      }
      
      const [, rawId, rawType, rawValue, rawLabel] = match;
      const normalizedType = normalizeComponentType(rawType);

      if (!normalizedType) {
        diagnostics.push({
          line: lineNum,
          severity: 'error',
          message: `Unknown component type "${rawType}". Supported: VoltageSource, Resistor, Capacitor, LED, Ground.`,
          rawLine,
        });
        return;
      }

      if (componentMap.has(rawId)) {
        diagnostics.push({
          line: lineNum,
          severity: 'warning',
          message: `Duplicate component ID "${rawId}". Overwriting previous definition.`,
          rawLine,
        });
      }

      const prevPos = existingPositions.get(rawId);
      const component: CircuitComponent = {
        id: rawId,
        type: normalizedType,
        value: rawValue?.trim() || COMPONENT_METADATA[normalizedType].defaultValue,
        label: rawLabel?.trim() || undefined,
        position: prevPos ? { x: prevPos.x, y: prevPos.y } : { x: 0, y: 0 },
        rotation: prevPos?.rotation ?? 0,
      };

      componentMap.set(rawId, component);
      components.push(component);
      return;
    }

    // 5. Section: [CONNECTIONS]
    if (currentSection === 'CONNECTIONS') {
      const match = trimmed.match(connectionRegex);
      if (!match) {
        diagnostics.push({
          line: lineNum,
          severity: 'warning',
          message: `Malformed connection. Expected "A.pin -> B.pin [Label: Name]" e.g. "V1.pos -> R1.1".`,
          rawLine,
        });
        return;
      }

      const [, srcId, srcPin, tgtId, tgtPin, netLabel] = match;

      // Validate source component exists
      const srcComp = componentMap.get(srcId);
      if (!srcComp) {
        diagnostics.push({
          line: lineNum,
          severity: 'error',
          message: `Unknown source component "${srcId}". Declare it under [COMPONENTS] first.`,
          rawLine,
        });
        return;
      }

      // Validate target component exists
      const tgtComp = componentMap.get(tgtId);
      if (!tgtComp) {
        diagnostics.push({
          line: lineNum,
          severity: 'error',
          message: `Unknown target component "${tgtId}". Declare it under [COMPONENTS] first.`,
          rawLine,
        });
        return;
      }

      // Validate source pin
      const normalizedSrcPin = normalizePin(srcComp.type, srcPin);
      if (!normalizedSrcPin) {
        const allowedPins = COMPONENT_METADATA[srcComp.type].pins.map((p) => p.id).join(', ');
        diagnostics.push({
          line: lineNum,
          severity: 'warning',
          message: `Invalid pin "${srcPin}" on ${srcComp.type} "${srcId}". Allowed pins: ${allowedPins}.`,
          rawLine,
        });
      }

      // Validate target pin
      const normalizedTgtPin = normalizePin(tgtComp.type, tgtPin);
      if (!normalizedTgtPin) {
        const allowedPins = COMPONENT_METADATA[tgtComp.type].pins.map((p) => p.id).join(', ');
        diagnostics.push({
          line: lineNum,
          severity: 'warning',
          message: `Invalid pin "${tgtPin}" on ${tgtComp.type} "${tgtId}". Allowed pins: ${allowedPins}.`,
          rawLine,
        });
      }

      const connectionId = `${srcId}.${normalizedSrcPin || srcPin}->${tgtId}.${normalizedTgtPin || tgtPin}`;

      connections.push({
        id: connectionId,
        sourceComponentId: srcId,
        sourcePinId: normalizedSrcPin || srcPin,
        targetComponentId: tgtId,
        targetPinId: normalizedTgtPin || tgtPin,
        netLabel: netLabel?.trim(),
      });
      return;
    }

    // 6. Content outside a recognized section
    diagnostics.push({
      line: lineNum,
      severity: 'warning',
      message: `Statement outside section. Group under [COMPONENTS] or [CONNECTIONS].`,
      rawLine,
    });
  });

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  return {
    graph: {
      title,
      components,
      connections,
    },
    diagnostics,
    isValid: !hasErrors,
  };
}
