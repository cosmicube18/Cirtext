import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  RotateCcw,
  Bot,
  User,
  AlertCircle,
  X,
  Cpu,
} from 'lucide-react';
import { useCircuitStore } from '../../store/circuitStore.ts';

const SYSTEM_INSTRUCTION = `You are Cirtext AI, an expert Electronic Circuit Designer and DSL Assistant.

STRICT RULE: NEVER invent new component types. NEVER hallucinate pin names. ONLY use the exact ComponentTypes and pin IDs listed below. If a user asks for a component not listed here, explain it is not yet supported rather than guessing.

═══════════════════════════════════════════════
CIRTEXT DSL SYNTAX RULES
═══════════════════════════════════════════════

A circuit file has this structure:

  # Circuit: <Title>

  [COMPONENTS]
  <ID>: <ComponentType> (<Value or Label>)

  [CONNECTIONS]
  <ComponentA>.<pinA> -> <ComponentB>.<pinB> [Label: OptionalNetName]

COMPONENTS rules:
- Value/label is OPTIONAL. NEVER use empty parentheses (). Omit them entirely when unused.
- NEVER put [Label: ...] on [COMPONENTS] lines.
- Good: V1: VoltageSource (5V)   R1: Resistor (10k)   U1: ESP32_30Pin (Controller)   GND: Ground
- Bad:  R1: Resistor ()           FF1: D_FlipFlop [Label: Stage1]

CONNECTIONS rules:
- [Label: OptionalNetName] is optional on connection lines.
- Example: V1.pos -> R1.1 [Label: VCC_Rail]

═══════════════════════════════════════════════
COMPLETE COMPONENT CATALOGUE (source of truth)
═══════════════════════════════════════════════

── PASSIVES & SOURCES ──────────────────────────
  VoltageSource   pins: pos, neg                 (default 5 V if no value given)
  Resistor        pins: 1, 2                     (default 1 kΩ if no value given)
  Capacitor       pins: 1, 2                     (default 10 µF if no value given)
  Switch          pins: 1, 2
  LED             pins: anode, cathode
  Buzzer          pins: pos, neg
  Ground          pin:  1
  Boost5V         pins: VIN, GND, VOUT, GND2
  TP4056          pins: IN+, IN-, BAT+, BAT-

── WIRE BRANCHING ──────────────────────────────
  Junction        pin:  1
                  Use to fan-out / branch wires from a single node.
                  Example: SW_CLK.2 -> J_CLK.1
                           J_CLK.1 -> FF1.CLK
                           J_CLK.1 -> FF2.CLK

── LOGIC GATES (NO VCC or GND pins on these) ───
  NOT             pins: A, Y                     (single-input inverter)
  AND             pins: A, B, Y
  OR              pins: A, B, Y
  NAND            pins: A, B, Y
  NOR             pins: A, B, Y
  XOR             pins: A, B, Y
  XNOR            pins: A, B, Y

── SEQUENTIAL / MEMORY ─────────────────────────
  D_FlipFlop      pins: D, CLK, Q, Q_BAR
                  POSITIVE-edge triggered (latches on CLK 0->1 rising edge), like 74LS74.
                  For a shift register: chain FF1.Q -> FF2.D, share CLK via Junction.
                  For a ripple UP-counter: wire previous Q_BAR -> next CLK.

  JK_FlipFlop     pins: J, CLK, K, Q, Q_BAR
                  NEGATIVE-edge triggered (latches on CLK 1->0 falling edge), like 74LS76.
                  For a ripple UP-counter: wire previous Q -> next CLK.

  Clock           pin:  OUT                      (free-running square-wave generator)

── VIRTUAL TEST INSTRUMENTS ────────────────────
  Voltmeter       pins: pos, neg
                  Wire IN PARALLEL across the two nodes to measure.
                  High impedance (10 MΩ); reads V(pos) - V(neg).

  Ammeter         pins: pos, neg
                  Wire IN SERIES in the branch to measure.
                  Near-zero resistance shunt (1 mΩ); reads branch current.

  Ohmmeter        pins: 1, 2
                  Use ONLY on fully UNPOWERED passive networks.
                  Shows ERR/LIVE if connected to a live voltage source.

── MICROCONTROLLER ─────────────────────────────
  ESP32_30Pin
    left  pins: EN, VP, VN, D34, D35, D32, D33, D25, D26, D27, D14, D12, D13, GND, VIN
    right pins: 3V3, GND2, D15, D2, D4, RX2, TX2, D5, D18, D19, GPIO21, RX0, TX0, GPIO22, D23

── I²C SENSORS & DISPLAYS ──────────────────────
  SCD41           pins: VCC, GND, SCL, SDA
  BH1750          pins: VCC, GND, SCL, SDA, ADDR
  SHT31           pins: VCC, GND, SCL, SDA, ADDR
  OLED_SSD1306    pins: VCC, GND, SCL, SDA
  LCD_I2C         pins: GND, VCC, SDA, SCL      (16x2 I2C LCD at 0x27)

═══════════════════════════════════════════════
INSTRUMENT WIRING RULES
═══════════════════════════════════════════════
- Voltmeter  — always in PARALLEL across the two nodes you want to measure.
- Ammeter    — always in SERIES in the branch whose current you want to measure.
- Ohmmeter   — only on a fully UNPOWERED sub-circuit (no VoltageSource connected).
- Do NOT connect Ohmmeter to a live circuit; it will show ERR/LIVE.

═══════════════════════════════════════════════
MULTI-BIT D_FlipFlop SHIFT-REGISTER EXAMPLE
═══════════════════════════════════════════════
# Circuit: 2-Bit Shift Register

[COMPONENTS]
V1: VoltageSource (5V)
SW_DATA: Switch (Data)
SW_CLK: Switch (Clock)
J_CLK: Junction
FF1: D_FlipFlop
FF2: D_FlipFlop
LED1: LED (Q1)
LED2: LED (Q2)
GND: Ground

[CONNECTIONS]
V1.pos -> SW_DATA.1
V1.pos -> SW_CLK.1
SW_DATA.2 -> FF1.D
SW_CLK.2 -> J_CLK.1
J_CLK.1 -> FF1.CLK
J_CLK.1 -> FF2.CLK
FF1.Q -> FF2.D
FF1.Q -> LED1.anode
FF2.Q -> LED2.anode
LED1.cathode -> GND.1
LED2.cathode -> GND.1
V1.neg -> GND.1

═══════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════
Analyze the user's circuit request (and the current DSL if provided), modify or generate the circuit accordingly, and output:
1. A brief, clear explanation of what was built or changed.
2. The complete, updated circuit DSL wrapped inside a \`\`\`cirtext code block.

Remember: ONLY use ComponentTypes and pin names from the catalogue above. NEVER invent new types or fake pins.`;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  explanation?: string;
  dsl?: string | null;
}

export interface AiAssistantPanelProps {
  onClose?: () => void;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ onClose }) => {
  const { setDslText, applyAutoLayout } = useCircuitStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your AI Circuit Assistant. Describe any circuit or modification in plain English, and I will automatically build and layout your schematic!",
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const extractDsl = (text: string): { explanation: string; dsl: string | null } => {
    const match = text.match(/```(?:cirtext|text)?\s*([\s\S]*?)```/i);
    if (match) {
      const dsl = match[1].trim();
      const explanation = text.replace(match[0], '').trim();
      return { explanation, dsl };
    }
    return { explanation: text.trim(), dsl: null };
  };

  const extractMessageContent = (message: unknown): string => {
    if (!message || typeof message !== 'object') return '';
    const content = (message as { content?: unknown }).content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            const text = (part as { text?: unknown }).text;
            if (typeof text === 'string') return text;
          }
          return '';
        })
        .join('')
        .trim();
    }

    return '';
  };

  const handleApplyDsl = async (dsl: string) => {
    try {
      setDslText(dsl);
      await applyAutoLayout();
      setSuccessToast('Circuit updated & auto-layout applied successfully!');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Failed to apply DSL to canvas:', err);
      setErrorMsg('Failed to render circuit layout on canvas.');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const promptText = inputPrompt.trim();
    if (!promptText || isLoading) return;

    setErrorMsg(null);
    setInputPrompt('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const currentDsl = useCircuitStore.getState().dslText;
      const fullUserPrompt = `${promptText}

----------------------
CURRENT CIRCUIT DSL:
----------------------
\`\`\`text
${currentDsl.trim()}
\`\`\`
`;

      const activeModel =
        import.meta.env.VITE_OPENROUTER_MODEL || 'nvidia/nemotron-3.5-super-vl:free';
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

      const failoverModels = [
        'nvidia/nemotron-3.5-super-vl:free',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
        'google/gemma-4-31b-it:free',
        'openrouter/free',
      ];
      const modelsList = Array.from(new Set([activeModel, ...failoverModels])).slice(0, 3);

      const chatMessages = messages.map((m) => ({ role: m.role, content: m.content }));
      const userPayload = { role: 'user' as const, content: fullUserPrompt };
      const allMessages = [...chatMessages, userPayload];
      const firstIdx = allMessages.findIndex((m) => m.role === 'user');
      if (firstIdx >= 0) {
        allMessages[firstIdx] = {
          role: 'user',
          content: `${SYSTEM_INSTRUCTION}\n\nUser request: ${allMessages[firstIdx].content}`,
        };
      }

      const requestCompletion = async (): Promise<string> => {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Cirtext',
          },
          body: JSON.stringify({
            model: activeModel,
            models: modelsList,
            max_tokens: 4096,
            reasoning: { effort: 'low' },
            messages: allMessages,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg =
            errData?.error?.metadata?.raw ||
            errData?.error?.message ||
            'Provider returned error';
          throw new Error(errMsg);
        }

        const data = await res.json();
        if (data.error) {
          throw new Error(data.error?.message || 'OpenRouter error');
        }

        return extractMessageContent(data.choices?.[0]?.message);
      };

      let rawResponseText = await requestCompletion();

      if (!rawResponseText) {
        rawResponseText = await requestCompletion();
      }

      if (!rawResponseText) {
        throw new Error(
          'The AI model returned an empty response. Please try again.'
        );
      }

      const { explanation, dsl } = extractDsl(rawResponseText);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: rawResponseText,
        explanation,
        dsl,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (dsl) {
        await handleApplyDsl(dsl);
      }
    } catch (err: any) {
      console.error('OpenRouter API call failed:', err);
      setErrorMsg(err.message || 'Failed to communicate with OpenRouter API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/80 flex items-center justify-center text-sky-400 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              AI Circuit Assistant
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                Powered by Nvidia Nemotron
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Natural Language to Circuit Diagram</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="mx-3 mt-2 p-2 bg-emerald-950/80 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2 shadow animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="mx-3 mt-2 p-2 bg-rose-950/80 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center justify-between gap-2 shadow">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[88%] md:max-w-[82%] rounded-xl p-3 text-xs leading-relaxed space-y-2 ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none shadow'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <>
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.explanation || msg.content}
                  </div>

                  {msg.dsl && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] text-sky-400 font-mono">
                        <Cpu className="w-3 h-3" />
                        <span>Valid Circuit DSL generated</span>
                      </div>
                      <button
                        onClick={() => void handleApplyDsl(msg.dsl!)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 text-[10px] font-semibold transition-colors shadow-sm"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Re-apply to Canvas</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start animate-pulse">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl rounded-tl-none p-3 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>Nemotron is designing your circuit...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2 shrink-0"
      >
        <textarea
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSendMessage();
            }
          }}
          placeholder="Describe a circuit or modification"
          rows={1}
          className="flex-1 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed"
        />
        <button
          type="submit"
          disabled={isLoading || !inputPrompt.trim()}
          className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white shadow transition-all shrink-0 flex items-center justify-center"
          title="Send prompt to Gemini"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
