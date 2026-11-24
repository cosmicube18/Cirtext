export interface CircuitSample {
  id: string;
  name: string;
  description: string;
  dsl: string;
}

export const SAMPLE_CIRCUITS: CircuitSample[] = [
  {
    id: 'half-adder-logic',
    name: 'Half Adder (XOR & AND Gates)',
    description: 'Digital 1-bit binary half adder with XOR gate (Sum) and AND gate (Carry)',
    dsl: `# Circuit: 1-Bit Half Adder
[COMPONENTS]
V1: VoltageSource (5V)
SW1: Switch (Input_A)
SW2: Switch (Input_B)
G1: XOR (Sum)
G2: AND (Carry)
D1: LED (Sum_LED)
D2: LED (Carry_LED)
GND: Ground

[CONNECTIONS]
V1.pos -> SW1.1
V1.pos -> SW2.1
SW1.2 -> G1.A [Label: Input_A]
SW1.2 -> G2.A
SW2.2 -> G1.B [Label: Input_B]
SW2.2 -> G2.B
G1.Y -> D1.anode [Label: Sum_Out]
G2.Y -> D2.anode [Label: Carry_Out]
D1.cathode -> GND.1
D2.cathode -> GND.1
V1.neg -> GND.1`,
  },
  {
    id: 'esp32-environmental-station',
    name: 'ESP32 I2C Sensor Station',
    description: 'ESP32 30-Pin dev board with SCD41, BH1750, SHT31, OLED display, and SPST switch',
    dsl: `# Circuit: ESP32 Environmental Station
[COMPONENTS]
U1: ESP32_30Pin
SW1: Switch (Power)
U2: SCD41 (CO2/Temp/RH)
U3: BH1750 (Ambient Light)
U4: SHT31 (Temp/RH)
DISP1: OLED_SSD1306 (128x64)

[CONNECTIONS]
U1.3V3 -> SW1.1
SW1.2 -> U2.VCC [Label: 3V3_Switched]
SW1.2 -> U3.VCC
SW1.2 -> U4.VCC
SW1.2 -> DISP1.VCC
U1.GND -> U2.GND
U1.GND -> U3.GND
U1.GND -> U4.GND
U1.GND -> DISP1.GND
U1.GPIO21 -> U2.SDA [Label: I2C_SDA]
U1.GPIO21 -> U3.SDA
U1.GPIO21 -> U4.SDA
U1.GPIO21 -> DISP1.SDA
U1.GPIO22 -> U2.SCL [Label: I2C_SCL]
U1.GPIO22 -> U3.SCL
U1.GPIO22 -> U4.SCL
U1.GPIO22 -> DISP1.SCL
U1.GND -> U3.ADDR
U1.GND -> U4.ADDR`,
  },
  {
    id: 'voltage-divider',
    name: 'Voltage Divider',
    description: 'Classic two-resistor reference voltage divider with 5V source',
    dsl: `# Circuit: Voltage Divider
[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (10k)
R2: Resistor (10k)
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> R2.1 [Label: V_out]
R2.2 -> GND.1
V1.neg -> GND.1`,
  },
  {
    id: 'led-indicator',
    name: 'LED Indicator Driver',
    description: 'Current-limiting resistor driving an indicator LED from a 5V rail',
    dsl: `# Circuit: LED Indicator
[COMPONENTS]
V1: VoltageSource (5V)
R1: Resistor (330)
D1: LED (Red)
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> D1.anode
D1.cathode -> GND.1
V1.neg -> GND.1`,
  },
  {
    id: 'rc-lowpass',
    name: 'RC Low-Pass Filter',
    description: 'First-order low-pass filter using a resistor and shunt capacitor',
    dsl: `# Circuit: RC Low-Pass Filter
[COMPONENTS]
V1: VoltageSource (3.3V)
R1: Resistor (1k)
C1: Capacitor (100nF)
GND: Ground

[CONNECTIONS]
V1.pos -> R1.1
R1.2 -> C1.1 [Label: V_filtered]
C1.2 -> GND.1
V1.neg -> GND.1`,
  },
];
