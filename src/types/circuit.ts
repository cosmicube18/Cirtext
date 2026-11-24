export type ComponentType =
  | 'VoltageSource'
  | 'Resistor'
  | 'Capacitor'
  | 'LED'
  | 'Ground'
  | 'Switch'
  | 'ESP32_30Pin'
  | 'SCD41'
  | 'BH1750'
  | 'SHT31'
  | 'OLED_SSD1306'
  | 'AND'
  | 'OR'
  | 'NOR'
  | 'NOT'
  | 'NAND'
  | 'XOR'
  | 'XNOR';

export type HandleOrientation = 'top' | 'bottom' | 'left' | 'right';

export interface PinDefinition {
  id: string; // e.g. '1', '2', 'pos', 'neg', 'A', 'B', 'Y', 'GPIO21', 'SDA', etc.
  label: string;
  position: HandleOrientation;
  offset?: { x: number; y: number };
  aliases?: string[];
}

export interface ComponentMetadata {
  type: ComponentType;
  defaultPrefix: string;
  displayName: string;
  defaultValue?: string;
  category?: 'passives' | 'microcontrollers' | 'sensors_displays' | 'logic_gates';
  pins: PinDefinition[];
}

export const COMPONENT_METADATA: Record<ComponentType, ComponentMetadata> = {
  VoltageSource: {
    type: 'VoltageSource',
    defaultPrefix: 'V',
    displayName: 'Voltage Source',
    defaultValue: '5V',
    category: 'passives',
    pins: [
      { id: 'pos', label: '+', position: 'top', aliases: ['+', 'p', '1'] },
      { id: 'neg', label: '-', position: 'bottom', aliases: ['-', 'n', '2'] },
    ],
  },
  Resistor: {
    type: 'Resistor',
    defaultPrefix: 'R',
    displayName: 'Resistor',
    defaultValue: '10k',
    category: 'passives',
    pins: [
      { id: '1', label: '1', position: 'left', aliases: ['a', 'in', 'left'] },
      { id: '2', label: '2', position: 'right', aliases: ['b', 'out', 'right'] },
    ],
  },
  Capacitor: {
    type: 'Capacitor',
    defaultPrefix: 'C',
    displayName: 'Capacitor',
    defaultValue: '100uF',
    category: 'passives',
    pins: [
      { id: '1', label: '1', position: 'left', aliases: ['pos', '+', 'a'] },
      { id: '2', label: '2', position: 'right', aliases: ['neg', '-', 'b'] },
    ],
  },
  LED: {
    type: 'LED',
    defaultPrefix: 'D',
    displayName: 'LED',
    defaultValue: 'Red',
    category: 'passives',
    pins: [
      { id: 'anode', label: 'A', position: 'left', aliases: ['a', '+', 'pos', '1'] },
      { id: 'cathode', label: 'K', position: 'right', aliases: ['k', 'c', '-', 'neg', '2'] },
    ],
  },
  Ground: {
    type: 'Ground',
    defaultPrefix: 'GND',
    displayName: 'Ground',
    category: 'passives',
    pins: [
      { id: '1', label: '1', position: 'top', aliases: ['gnd', 'in', 'top'] },
    ],
  },
  Switch: {
    type: 'Switch',
    defaultPrefix: 'SW',
    displayName: 'SPST Switch',
    defaultValue: 'Toggle',
    category: 'passives',
    pins: [
      { id: '1', label: '1', position: 'left', aliases: ['in', 'a'] },
      { id: '2', label: '2', position: 'right', aliases: ['out', 'b'] },
    ],
  },
  // -------------------------------------------------------------
  // Logic Gates (IEEE Standard)
  // -------------------------------------------------------------
  AND: {
    type: 'AND',
    defaultPrefix: 'G',
    displayName: 'AND Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  OR: {
    type: 'OR',
    defaultPrefix: 'G',
    displayName: 'OR Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  NOT: {
    type: 'NOT',
    defaultPrefix: 'G',
    displayName: 'NOT Gate',
    defaultValue: 'Inverter',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['in', '1'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '2'] },
    ],
  },
  NAND: {
    type: 'NAND',
    defaultPrefix: 'G',
    displayName: 'NAND Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  NOR: {
    type: 'NOR',
    defaultPrefix: 'G',
    displayName: 'NOR Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  XOR: {
    type: 'XOR',
    defaultPrefix: 'G',
    displayName: 'XOR Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  XNOR: {
    type: 'XNOR',
    defaultPrefix: 'G',
    displayName: 'XNOR Gate',
    defaultValue: '2-Input',
    category: 'logic_gates',
    pins: [
      { id: 'A', label: 'A', position: 'left', aliases: ['1', 'in1', 'ina'] },
      { id: 'B', label: 'B', position: 'left', aliases: ['2', 'in2', 'inb'] },
      { id: 'Y', label: 'Y', position: 'right', aliases: ['out', 'q', '3'] },
    ],
  },
  // -------------------------------------------------------------
  // Microcontrollers & Dev Boards
  // -------------------------------------------------------------
  ESP32_30Pin: {
    type: 'ESP32_30Pin',
    defaultPrefix: 'U',
    displayName: 'ESP32 (30-Pin NodeMCU)',
    defaultValue: 'NodeMCU-32S',
    category: 'microcontrollers',
    pins: [
      // Left-side pins (15 pins)
      { id: 'EN', label: 'EN', position: 'left', aliases: ['rst', 'reset'] },
      { id: 'VP', label: 'VP', position: 'left', aliases: ['gpio36', 'd36'] },
      { id: 'VN', label: 'VN', position: 'left', aliases: ['gpio39', 'd39'] },
      { id: 'D34', label: 'D34', position: 'left', aliases: ['gpio34', '34'] },
      { id: 'D35', label: 'D35', position: 'left', aliases: ['gpio35', '35'] },
      { id: 'D32', label: 'D32', position: 'left', aliases: ['gpio32', '32'] },
      { id: 'D33', label: 'D33', position: 'left', aliases: ['gpio33', '33'] },
      { id: 'D25', label: 'D25', position: 'left', aliases: ['gpio25', '25', 'dac1'] },
      { id: 'D26', label: 'D26', position: 'left', aliases: ['gpio26', '26', 'dac2'] },
      { id: 'D27', label: 'D27', position: 'left', aliases: ['gpio27', '27'] },
      { id: 'D14', label: 'D14', position: 'left', aliases: ['gpio14', '14'] },
      { id: 'D12', label: 'D12', position: 'left', aliases: ['gpio12', '12'] },
      { id: 'D13', label: 'D13', position: 'left', aliases: ['gpio13', '13'] },
      { id: 'GND', label: 'GND', position: 'left', aliases: ['gnd1', 'gnd_l'] },
      { id: 'VIN', label: 'VIN', position: 'left', aliases: ['5v', 'vcc_in'] },

      // Right-side pins (15 pins)
      { id: '3V3', label: '3V3', position: 'right', aliases: ['3.3v', 'vcc'] },
      { id: 'GND2', label: 'GND', position: 'right', aliases: ['gnd_r'] },
      { id: 'D15', label: 'D15', position: 'right', aliases: ['gpio15', '15'] },
      { id: 'D2', label: 'D2', position: 'right', aliases: ['gpio2', '2'] },
      { id: 'D4', label: 'D4', position: 'right', aliases: ['gpio4', '4'] },
      { id: 'RX2', label: 'RX2', position: 'right', aliases: ['gpio16', 'd16'] },
      { id: 'TX2', label: 'TX2', position: 'right', aliases: ['gpio17', 'd17'] },
      { id: 'D5', label: 'D5', position: 'right', aliases: ['gpio5', '5'] },
      { id: 'D18', label: 'D18', position: 'right', aliases: ['gpio18', '18', 'sck'] },
      { id: 'D19', label: 'D19', position: 'right', aliases: ['gpio19', '19', 'miso'] },
      { id: 'GPIO21', label: 'GPIO21', position: 'right', aliases: ['d21', '21', 'sda'] },
      { id: 'RX0', label: 'RX0', position: 'right', aliases: ['gpio3', 'rx'] },
      { id: 'TX0', label: 'TX0', position: 'right', aliases: ['gpio1', 'tx'] },
      { id: 'GPIO22', label: 'GPIO22', position: 'right', aliases: ['d22', '22', 'scl'] },
      { id: 'D23', label: 'D23', position: 'right', aliases: ['gpio23', '23', 'mosi'] },
    ],
  },
  // -------------------------------------------------------------
  // Sensors & Displays
  // -------------------------------------------------------------
  SCD41: {
    type: 'SCD41',
    defaultPrefix: 'U',
    displayName: 'SCD41 CO2 Sensor',
    defaultValue: 'CO2/Temp/RH',
    category: 'sensors_displays',
    pins: [
      { id: 'VCC', label: 'VCC', position: 'left', aliases: ['3v3', 'vin'] },
      { id: 'GND', label: 'GND', position: 'left', aliases: ['ground'] },
      { id: 'SCL', label: 'SCL', position: 'right', aliases: ['sck'] },
      { id: 'SDA', label: 'SDA', position: 'right', aliases: ['data'] },
    ],
  },
  BH1750: {
    type: 'BH1750',
    defaultPrefix: 'U',
    displayName: 'BH1750 Light Sensor',
    defaultValue: 'Ambient Light',
    category: 'sensors_displays',
    pins: [
      { id: 'VCC', label: 'VCC', position: 'left', aliases: ['3v3', 'vin'] },
      { id: 'GND', label: 'GND', position: 'left', aliases: ['ground'] },
      { id: 'SCL', label: 'SCL', position: 'right', aliases: ['sck'] },
      { id: 'SDA', label: 'SDA', position: 'right', aliases: ['data'] },
      { id: 'ADDR', label: 'ADDR', position: 'right', aliases: ['add', 'address'] },
    ],
  },
  SHT31: {
    type: 'SHT31',
    defaultPrefix: 'U',
    displayName: 'SHT31 Temp/RH Sensor',
    defaultValue: 'Temp/Humidity',
    category: 'sensors_displays',
    pins: [
      { id: 'VCC', label: 'VCC', position: 'left', aliases: ['3v3', 'vin'] },
      { id: 'GND', label: 'GND', position: 'left', aliases: ['ground'] },
      { id: 'SCL', label: 'SCL', position: 'right', aliases: ['sck'] },
      { id: 'SDA', label: 'SDA', position: 'right', aliases: ['data'] },
      { id: 'ADDR', label: 'ADDR', position: 'right', aliases: ['add', 'address', 'alert'] },
    ],
  },
  OLED_SSD1306: {
    type: 'OLED_SSD1306',
    defaultPrefix: 'DISP',
    displayName: 'SSD1306 OLED (128x64)',
    defaultValue: '128x64 I2C',
    category: 'sensors_displays',
    pins: [
      { id: 'VCC', label: 'VCC', position: 'left', aliases: ['3v3', 'vin', 'vcc'] },
      { id: 'GND', label: 'GND', position: 'left', aliases: ['ground'] },
      { id: 'SCL', label: 'SCL', position: 'right', aliases: ['sck'] },
      { id: 'SDA', label: 'SDA', position: 'right', aliases: ['data'] },
    ],
  },
};

export interface CircuitComponent {
  id: string; // e.g. "V1", "R1", "GND", "U1", "G1"
  type: ComponentType;
  value?: string;
  label?: string;
  position: { x: number; y: number };
  rotation?: 0 | 90 | 180 | 270;
}

export interface CircuitConnection {
  id: string;
  sourceComponentId: string;
  sourcePinId: string;
  targetComponentId: string;
  targetPinId: string;
  netLabel?: string;
}

export interface CircuitGraph {
  title?: string;
  components: CircuitComponent[];
  connections: CircuitConnection[];
}

export interface ParseDiagnostic {
  line: number;
  message: string;
  severity: 'warning' | 'error';
  rawLine?: string;
}

export interface ParseResult {
  graph: CircuitGraph;
  diagnostics: ParseDiagnostic[];
  isValid: boolean;
}

export type UpdateSource = 'canvas' | 'text' | 'initial' | 'layout';

/**
 * Normalizes user-entered pin identifier to the canonical pin ID for the component type.
 */
export function normalizePin(type: ComponentType, pinName: string): string | null {
  const meta = COMPONENT_METADATA[type];
  if (!meta) return null;

  const normalized = pinName.trim().toLowerCase();
  for (const pin of meta.pins) {
    if (pin.id.toLowerCase() === normalized) {
      return pin.id;
    }
    if (pin.aliases?.some((a) => a.toLowerCase() === normalized)) {
      return pin.id;
    }
  }
  return null;
}

/**
 * Normalizes user-entered component type (case-insensitive & aliases).
 */
export function normalizeComponentType(typeStr: string): ComponentType | null {
  const cleaned = typeStr.trim().toLowerCase();
  const map: Record<string, ComponentType> = {
    voltagesource: 'VoltageSource',
    voltage_source: 'VoltageSource',
    voltage: 'VoltageSource',
    vsource: 'VoltageSource',
    v: 'VoltageSource',

    resistor: 'Resistor',
    res: 'Resistor',
    r: 'Resistor',

    capacitor: 'Capacitor',
    cap: 'Capacitor',
    c: 'Capacitor',

    led: 'LED',
    diodered: 'LED',
    d: 'LED',

    ground: 'Ground',
    gnd: 'Ground',

    switch: 'Switch',
    sw: 'Switch',
    spst: 'Switch',

    // Logic Gates
    and: 'AND',
    andgate: 'AND',
    or: 'OR',
    orgate: 'OR',
    not: 'NOT',
    notgate: 'NOT',
    inverter: 'NOT',
    inv: 'NOT',
    nand: 'NAND',
    nandgate: 'NAND',
    nor: 'NOR',
    norgate: 'NOR',
    xor: 'XOR',
    xorgate: 'XOR',
    xnor: 'XNOR',
    xnorgate: 'XNOR',

    // Microcontrollers & Boards
    esp32_30pin: 'ESP32_30Pin',
    esp32: 'ESP32_30Pin',
    esp3230pin: 'ESP32_30Pin',
    esp: 'ESP32_30Pin',
    nodemcu: 'ESP32_30Pin',

    // Sensors & Displays
    scd41: 'SCD41',
    scd_41: 'SCD41',

    bh1750: 'BH1750',
    bh_1750: 'BH1750',

    sht31: 'SHT31',
    sht_31: 'SHT31',

    oled_ssd1306: 'OLED_SSD1306',
    oled: 'OLED_SSD1306',
    ssd1306: 'OLED_SSD1306',
    display: 'OLED_SSD1306',
  };

  return map[cleaned] || null;
}
