/**
 * Prepares the current circuit DSL wrapped in a specialized prompt
 * with strict syntax rules for ChatGPT, Claude, and Gemini.
 */
export function generateAiPrompt(dslText: string): string {
  return `You are an expert Electronic Circuit Designer and DSL Assistant.

I have a circuit diagram written in a custom, human- and LLM-readable text format (DSL).
Here are the strict syntax rules:

1. SECTION HEADERS:
   The circuit consists of two sections:
   [COMPONENTS]
   [CONNECTIONS]

2. COMPONENTS SYNTAX:
   <ID>: <Type> (<Value>)
   IMPORTANT: NEVER use empty parentheses \`()\` and NEVER put \`[Label: ...]\` on \`[COMPONENTS]\` lines. Put descriptive names inside the parentheses like \`U1: ESP32_30Pin (Controller)\` or omit parentheses completely like \`GND1: Ground\`.
   Supported Component Types and their allowed pin names:
   - Logic Gates:
       - NOT: input "A", output "Y" (e.g. G1: NOT)
       - AND, OR, NOR, NAND, XOR, XNOR: inputs "A", "B", output "Y" (e.g. G1: AND, G2: OR, G3: XOR)
    - Sequential Logic (Flip-Flops):
        - D_FlipFlop: inputs "D", "CLK", outputs "Q", "Q_BAR" (e.g. FF1: D_FlipFlop)
        - JK_FlipFlop: inputs "J", "CLK", "K", outputs "Q", "Q_BAR" (e.g. FF1: JK_FlipFlop)
    - Clock Generators:
        - Clock: output "OUT" (e.g. CLK1: Clock)
   - ESP32_30Pin:
       left pins: "EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"
       right pins: "3V3", "GND" (or GND2), "D15", "D2", "D4", "RX2", "TX2", "D5", "D18", "D19", "GPIO21", "RX0", "TX0", "GPIO22", "D23"
   - SCD41: pins "VCC", "GND", "SCL", "SDA"
   - BH1750: pins "VCC", "GND", "SCL", "SDA", "ADDR"
   - SHT31: pins "VCC", "GND", "SCL", "SDA", "ADDR"
    - OLED_SSD1306: pins "VCC", "GND", "SCL", "SDA"
    - LCD_I2C: pins "GND", "VCC", "SDA", "SCL" (16x2 I2C character LCD at address 0x27)
   - Switch: pins "1", "2"
   - VoltageSource: pins "pos", "neg"
   - Resistor: pins "1", "2"
   - Capacitor: pins "1", "2"
   - LED: pins "anode", "cathode"
- Buzzer: pins "pos", "neg"
- Boost5V: pins "VIN", "GND", "VOUT", "GND2"
- TP4056: pins "IN+", "IN-", "BAT+", "BAT-"
   - Ground: pin "1"

3. CONNECTIONS SYNTAX:
   <ComponentA>.<PinA> -> <ComponentB>.<PinB> [Label: OptionalLabel]
   Examples:
   U1.3V3 -> SW1.1
   SW1.2 -> U2.VCC [Label: 3V3_Switched]
   U1.GPIO21 -> U2.SDA [Label: I2C_SDA]
   U1.GPIO22 -> U2.SCL [Label: I2C_SCL]

----------------------
CURRENT CIRCUIT DSL:
----------------------
\`\`\`text
${dslText.trim()}
\`\`\`

----------------------
YOUR TASK:
----------------------
Please analyze this circuit and modify or expand it according to my request below.
IMPORTANT: When responding with the updated circuit, output ONLY the valid DSL inside a \`\`\`text code block so I can paste it directly back into my editor.

[USER REQUEST]: `;
}
