import type { NodeTypes } from '@xyflow/react';
import { VoltageSourceNode } from './VoltageSourceNode.tsx';
import { ResistorNode } from './ResistorNode.tsx';
import { CapacitorNode } from './CapacitorNode.tsx';
import { LedNode } from './LedNode.tsx';
import { GroundNode } from './GroundNode.tsx';
import { SwitchNode } from './SwitchNode.tsx';
import { Esp32Node } from './Esp32Node.tsx';
import { MultiPinModuleNode } from './MultiPinModuleNode.tsx';
import { OledNode } from './OledNode.tsx';

export const circuitNodeTypes: NodeTypes = {
  // Passives & Sources
  VoltageSource: VoltageSourceNode,
  Resistor: ResistorNode,
  Capacitor: CapacitorNode,
  LED: LedNode,
  Ground: GroundNode,
  Switch: SwitchNode,

  // Microcontrollers
  ESP32_30Pin: Esp32Node,

  // I2C Modules & Sensors
  SCD41: MultiPinModuleNode,
  BH1750: MultiPinModuleNode,
  SHT31: MultiPinModuleNode,

  // Displays
  OLED_SSD1306: OledNode,
};
