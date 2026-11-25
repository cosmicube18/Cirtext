# Power Pin Simulation Plan

## Goal
Extend the circuit simulation (`src/utils/simulation.ts`) to model **power flow** through the power pins of three components:
- **ESP32_30Pin**: VIN (5V in), GND (ground), 3V3 (3.3V out)
- **TP4056**: IN+/IN- (5V charge input), BAT+/BAT- (battery output)
- **Boost5V**: VIN/GND (battery in), VOUT/GND2 (5V out)

Only these specific pins — no other pins on these components.

---

## Current Simulation Behavior
- `VoltageSource.pos` = HIGH (1), `neg` = GROUNDED
- `Ground.1` = GROUNDED
- Passive components (Resistor, Switch) bidirectionally bridge signals + ground
- Nets propagate driver values + ground reachability
- LEDs/Buzzers light when anode HIGH + cathode GROUNDED

**Missing**: No component acts as a *power converter/regulator* with distinct input/output power pins.

---

## Required Simulation Logic

### 1. ESP32_30Pin Power Pins
| Pin | Role | Simulation Behavior |
|-----|------|---------------------|
| `VIN` | 5V Input | When connected to a 5V source (HIGH), marks pin HIGH. Does **not** automatically ground VIN. |
| `GND` / `GND2` | Ground | Always GROUNDED (0V reference). Connects to circuit ground net. |
| `3V3` | 3.3V Output | **Outputs HIGH (1)** when `VIN` is HIGH **OR** when `3V3` is externally driven HIGH. Acts as a 3.3V regulator output. |

**Rules**:
- If `VIN` net is HIGH → drive `3V3` HIGH
- If `3V3` net is HIGH (external supply) → drive `3V3` HIGH (back-powering allowed)
- `GND`/`GND2` always grounded
- Other GPIO pins unchanged (remain digital logic only)

### 2. TP4056 Charger
| Pin | Role | Simulation Behavior |
|-----|------|---------------------|
| `IN+` | Charge Input + | When HIGH (5V present), enables charging |
| `IN-` | Charge Input - | Must be GROUNDED for charging to work |
| `BAT+` | Battery + | **Outputs HIGH** when `IN+` HIGH **AND** `IN-` GROUNDED (charging → ~4.2V). Otherwise follows battery state (assume HIGH if battery connected). |
| `BAT-` | Battery - | Always GROUNDED |

**Rules**:
- Charging active: `IN+`=1 ∧ `IN-`=grounded → `BAT+`=1
- `BAT-` always grounded
- If no input power, `BAT+` state depends on battery (simplify: treat as HIGH if any load connected)

### 3. Boost5V Converter (e.g., MT3608)
| Pin | Role | Simulation Behavior |
|-----|------|---------------------|
| `VIN` | Battery Input + | Must be HIGH (battery voltage ~3.7V) |
| `GND` | Battery Input - | Must be GROUNDED |
| `VOUT` | 5V Output | **Outputs HIGH** when `VIN` HIGH **AND** `GND` GROUNDED |
| `GND2` | Output Ground | Always GROUNDED (same net as `GND`) |

**Rules**:
- `VIN`=1 ∧ `GND`=grounded → `VOUT`=1
- `GND` and `GND2` always grounded (same potential)

---

## Implementation Tasks

### Task 1: Extend `runCircuitSimulation` in `src/utils/simulation.ts`
- Add initialization block for `ESP32_30Pin`, `TP4056`, `Boost5V` components (after line 65)
- Add power-pin propagation logic in the iterative relaxation loop (after passive component handling, before net building)
- For each component type, implement the rules above using `pinStates` and `isGrounded`

### Task 2: Add Pin Definitions for Power Pins (if needed)
- Verify `COMPONENT_METADATA` in `src/types/circuit.ts` has correct pins (already present)
- No changes needed — pins already defined

### Task 3: Visual Feedback (Optional but Recommended)
- Update `Esp32Node.tsx` `getPinColor` — already highlights VIN/3V3/GND
- Create dedicated node components for `TP4056` and `Boost5V` (or extend `MultiPinModuleNode` with component-specific `getPinColor`) to show power-pin colors matching simulation state
- Consider animating power-flow edges when simulation runs

### Task 4: Add Test Cases
- Create sample circuits in `src/parser/sampleCircuits.ts` demonstrating:
  - ESP32 powered via VIN → 3V3 drives LED
  - TP4056 charging battery → BAT+ powers Boost5V → VOUT powers ESP32 VIN
  - Boost5V powered by battery → VOUT powers ESP32
- Verify simulation results: `pinStates`, `isGrounded`, `edgeStates` reflect power flow

---

## Edge Cases & Decisions

| Scenario | Decision |
|----------|----------|
| ESP32 `3V3` driven externally (no VIN) | Allow back-powering: `3V3`=HIGH propagates to ESP32 internal logic |
| TP4056 `BAT+` without input power | Treat as HIGH (battery present) — simplifies to "battery connected" assumption |
| Boost5V `VOUT` back-fed | Not modeled — assume unidirectional boost |
| Multiple GND pins on same component | All GND pins forced to same grounded net (already via net propagation) |
| Conflicting drivers on power net | Existing net conflict detection handles it (leave net uncontested) |

---

## Files to Modify
1. `src/utils/simulation.ts` — Core simulation logic (primary change)
2. `src/components/nodes/nodeTypes.ts` — Register new node components if created
3. `src/components/nodes/Tp4056Node.tsx` — New (optional, for visual power-pin feedback)
4. `src/components/nodes/Boost5VNode.tsx` — New (optional)
5. `src/parser/sampleCircuits.ts` — Add test circuits

---

## Validation Plan
1. Run existing tests (if any) — ensure no regression
2. Load new sample circuits in the editor
3. Enable simulation mode
4. Verify:
   - ESP32 `3V3` pin goes HIGH when `VIN` connected to 5V source
   - TP4056 `BAT+` goes HIGH when `IN+`=5V and `IN-`=GND
   - Boost5V `VOUT` goes HIGH when `VIN`=battery and `GND`=GND
   - Edge animation shows power flow on these nets
   - LEDs powered from `3V3`/`VOUT`/`BAT+` light up correctly

---

## Out of Scope
- Full analog simulation (voltage levels, current limiting, efficiency)
- Battery state modeling (SoC, discharge curves)
- Thermal/protection features (TP4056 charge termination, Boost5V overcurrent)
- GPIO pin power simulation (only VIN/GND/3V3 for ESP32)