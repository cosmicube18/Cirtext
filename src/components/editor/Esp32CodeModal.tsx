import React, { useState, useEffect, useRef } from 'react';
import { X, Play, RotateCcw, Terminal, CheckCircle, AlertCircle, Loader2, Square } from 'lucide-react';
import { esp32RuntimeManager } from '../../simulation/esp32/Esp32RuntimeManager';
import { useCircuitStore } from '../../store/circuitStore';

const DEFAULT_SKETCH = `// ESP32 Blink + Buzzer Test Sketch
// Connect LED to GPIO2 (D2) and Buzzer to GPIO4 (D4)

const int ledPin = 2;
const int buzzerPin = 4;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32 Blink + Buzzer Test Starting...");
}

void loop() {
  Serial.println("LED ON, Buzzer ON");
  digitalWrite(ledPin, HIGH);
  tone(buzzerPin, 1000);
  delay(500);

  Serial.println("LED OFF, Buzzer OFF");
  digitalWrite(ledPin, LOW);
  noTone(buzzerPin);
  delay(500);
}
`;

interface Esp32CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  esp32ComponentId: string;
}

export const Esp32CodeModal: React.FC<Esp32CodeModalProps> = ({ isOpen, onClose, esp32ComponentId }) => {
  const [code, setCode] = useState<string>(DEFAULT_SKETCH);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [serialOutput, setSerialOutput] = useState<string>('');
  const [showSerial, setShowSerial] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const serialRef = useRef<HTMLDivElement>(null);
  const { simulationState } = useCircuitStore();
  const isHydratedRef = useRef(false);

  const handleSerialOutput = (text: string) => {
    setSerialOutput(prev => prev + text);
  };

  const handlePinUpdate = (_gpio: number, _value: number) => {
  };

  const handleToneUpdate = (_gpio: number, _frequencyHz: number) => {
  };

  useEffect(() => {
    if (isOpen) {
      esp32RuntimeManager.setEsp32ComponentId(esp32ComponentId);
      esp32RuntimeManager.setSerialCallback(handleSerialOutput);
      esp32RuntimeManager.setPinUpdateCallback(handlePinUpdate);
      esp32RuntimeManager.setToneUpdateCallback(handleToneUpdate);

      if (!isHydratedRef.current) {
        setIsRunning(esp32RuntimeManager.getIsRunning());
        setSerialOutput(esp32RuntimeManager.getSerialBuffer());
        const savedCode = esp32RuntimeManager.getCurrentCode();
        if (savedCode) {
          setCode(savedCode);
        }
        isHydratedRef.current = true;
      }
    } else {
      esp32RuntimeManager.setSerialCallback(() => {});
      esp32RuntimeManager.setPinUpdateCallback(() => {});
      esp32RuntimeManager.setToneUpdateCallback(() => {});
    }
  }, [isOpen, esp32ComponentId]);

  useEffect(() => {
    if (serialRef.current) {
      serialRef.current.scrollTop = serialRef.current.scrollHeight;
    }
  }, [serialOutput]);

  useEffect(() => {
    if (isRunning && simulationState) {
      esp32RuntimeManager.syncPinStatesFromCircuit(
        useCircuitStore.getState().graph,
        simulationState
      );
    }
  }, [simulationState, isRunning]);

  const handleCompileAndRun = async () => {
    setIsCompiling(true);
    setCompileError(null);

    try {
      const result = await esp32RuntimeManager.compile(code);
      if (result.success) {
        await esp32RuntimeManager.start();
        setIsRunning(true);
        setIsCompiling(false);
      } else {
        setCompileError(result.errors || 'Compilation failed');
        setIsCompiling(false);
      }
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : 'Unknown error');
      setIsCompiling(false);
    }
  };

  const handleStop = () => {
    esp32RuntimeManager.stop();
    setIsRunning(false);
  };

  const handleReset = () => {
    esp32RuntimeManager.reset();
    setCode(DEFAULT_SKETCH);
    setSerialOutput('');
    setCompileError(null);
    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl h-[85vh] max-h-[900px] bg-slate-950 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" className="stroke-sky-400 fill-none stroke-2">
                <path d="M 2 2 L 6 2 L 6 10 L 10 10 L 10 2 L 14 2 L 14 10 L 18 10 L 18 2 L 22 2" />
              </svg>
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-sky-400">ESP32 Firmware</h2>
              <span className="text-[10px] font-mono text-slate-500">Component: {esp32ComponentId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSerial(!showSerial)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                showSerial
                  ? 'bg-sky-950/80 border-sky-800 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 mr-1 inline-block" />
              Serial
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800">
            <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">sketch.cpp</span>
              <div className="flex items-center gap-2">
                {compileError && (
                  <span className="flex items-center gap-1 text-xs text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Compilation Error
                  </span>
                )}
                {!compileError && isRunning && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running
                  </span>
                )}
                {!compileError && !isRunning && !isCompiling && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Ready
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <textarea
                ref={editorRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full h-full font-mono text-sm text-slate-100 bg-slate-950 border-none resize-none outline-none p-4 tab-size-2"
                spellCheck={false}
                placeholder="// Write your Arduino/ESP32 C++ code here..."
                disabled={isCompiling}
              />
              {isCompiling && (
                <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3 text-sky-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="font-mono text-sm">Compiling with Clang...</span>
                  </div>
                </div>
              )}
            </div>

            {compileError && (
              <div className="p-3 bg-rose-950/50 border-t border-rose-800/50 max-h-32 overflow-auto">
                <pre className="font-mono text-[11px] text-rose-300 whitespace-pre-wrap">{compileError}</pre>
              </div>
            )}
          </div>

          {showSerial && (
            <div className="w-80 flex flex-col border-l border-slate-800 bg-slate-900/50">
              <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Serial Monitor</span>
                <button
                  onClick={() => setSerialOutput('')}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
                  title="Clear"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <div
                ref={serialRef}
                className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-slate-300 leading-relaxed"
              >
                {serialOutput || (
                  <span className="text-slate-600">Waiting for serial output...</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-mono rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors disabled:opacity-50"
            disabled={isCompiling}
          >
            <RotateCcw className="w-4 h-4 mr-1.5 inline-block" />
            Reset
          </button>
          <button
            onClick={handleStop}
            disabled={!isRunning || isCompiling}
            className="px-4 py-2 text-sm font-mono rounded-lg bg-rose-950/50 border border-rose-800/50 text-rose-300 hover:bg-rose-950 hover:border-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4 mr-1.5 inline-block" />
            Stop
          </button>
          <button
            onClick={handleCompileAndRun}
            disabled={isCompiling || isRunning}
            className="px-5 py-2 text-sm font-mono rounded-lg bg-sky-600 text-slate-950 font-semibold hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isCompiling ? 'Compiling...' : isRunning ? 'Running' : 'Compile & Run'}
          </button>
        </div>
      </div>
    </div>
  );
};