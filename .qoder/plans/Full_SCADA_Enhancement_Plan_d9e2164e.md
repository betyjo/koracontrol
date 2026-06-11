# Kora Control -- Full SCADA Enhancement Plan

## Gap Analysis: Current State vs Professional SCADA

| Feature Area | Current State | Professional SCADA Standard | Gap |
|---|---|---|---|
| **Desktop HMI** | Single dashboard with KPIs, charts, process diagram | Multi-tab with faceplates, alarm banner, system diagnostics, shift log | HIGH |
| **Alarm Management** | Rule-based with deadband/shelving/ack | ISA-18.2 lifecycle, alarm flood suppression, horn/silence, priority matrix | MEDIUM |
| **AI/ML** | Isolation Forest anomaly detection, leak detector, trend analyzer | Predictive maintenance (RUL), equipment health scoring, root cause analysis, energy optimization | MEDIUM |
| **Web Frontend** | 20 pages (good coverage) but shallow on some | Shift management, SOE viewer, batch tracking, OEE metrics | MEDIUM |
| **Simulation** | 4 sensors (level, pump, flow, pressure), basic pump logic | Temperature, pH, turbidity, DO, PID control, multi-tank cascade, VFD | MEDIUM |
| **Backend** | REST API, MQTT, alarm evaluator | WebSocket real-time, audit trail, PDF/CSV reports, scheduled reports | LOW-MEDIUM |

---

## Phase 1: Desktop HMI Overhaul (PRIORITY)

### Task 1.1: Professional Multi-Tab Desktop Layout

**Current**: Single `dashboard.fxml` with everything crammed into one view.  
**Target**: Tabbed interface matching professional SCADA operator stations.

**Changes:**
- `kora_desktop/src/main/resources/ui/main_layout.fxml`: Add a `TabPane` in the content area with tabs:
  - **Overview** (current dashboard - keep as-is but cleaned up)
  - **Process** (dedicated full-screen process diagram with interactive faceplates)
  - **Trends** (dedicated multi-chart trend group display)
  - **Alarms** (full alarm management table, not just summary)
  - **Diagnostics** (system health: CPU, MQTT latency, tag engine stats, connection status)
- `kora_desktop/src/main/java/com/kora/desktop/controller/`: Create `ProcessController`, `TrendsController`, `AlarmTableController`, `DiagnosticsController`
- Each controller subscribes to relevant TagEngine tags independently

### Task 1.2: Alarm Banner Bar (Always Visible)

**Current**: Alarm count shown as a KPI tile.  
**Target**: Persistent alarm banner at top of all tabs, like real SCADA systems.

**Changes:**
- Add a fixed `HBox` alarm banner above the `TabPane` in `main_layout.fxml`
- Shows scrolling/rotating latest active alarm with severity color
- Red flashing border when critical alarm active
- "Horn Silence" button
- Click opens the Alarms tab
- `AlarmBannerController.java`: subscribes to `AlarmManager.getInstance()` for live updates

### Task 1.3: Equipment Faceplates

**Current**: Simple label showing "Pump 1: Running".  
**Target**: Reusable faceplate components for each equipment type.

**Changes:**
- Create `FaceplateFactory.java` in `com.kora.desktop.ui.faceplate`
- Faceplates for: Pump (with running/stopped/fault states, hours-run counter), Valve (open/closed/throttled with position %), Tank (animated fill with level alarm markers), Sensor (value with quality code indicator and engineering unit)
- Each faceplate is a `VBox`/`HBox` with standardized 120x80px card
- Use in Process tab (Task 1.1)

### Task 1.4: System Diagnostics Tab

**Current**: No system health view.  
**Target**: SCADA system self-monitoring dashboard.

**Content:**
- MQTT connection status with latency ms and reconnect count
- Tag Engine stats: total tags, update rate (tags/sec), stale tags (no update in >10s)
- Backend API response time
- Memory usage (JVM heap)
- Engine scan cycle time
- Disk usage for logging
- Connection uptime timer

### Task 1.5: Shift Management and Operator Log

**Current**: No shift tracking.  
**Target**: Operator shift handover system.

**Changes:**
- `ShiftManager.java`: Tracks current shift (Morning/Afternoon/Night based on time)
- Shift start/end buttons with operator name
- Shift log: auto-records significant events (alarms, commands, mode changes)
- Export shift report to text file
- Display in Diagnostics tab or separate Shift Log tab

---

## Phase 2: Web Frontend Expansion

### Task 2.1: Enhanced Trend Analysis Page

**Current** (`trends/page.tsx`, 635 lines): Good -- has multi-tag, annotations, compare mode, AI abnormality detection.  
**Missing:**
- Cursor crosshair with exact value readout
- Statistical summary panel (min/max/avg/std for visible range)
- Export chart as PNG (partially implemented with `html-to-image`)
- Add regression line overlay option

### Task 2.2: Sequence of Events (SOE) Viewer -- NEW PAGE

**New page** at `dashboard/events/page.tsx`:
- Chronological log of ALL system events (operator actions, alarm trips, commands sent, mode changes)
- Filter by event type, severity, date range
- Color-coded by type
- Export to CSV
- Backend: new endpoint `GET /api/operations/events/` aggregating from `OperatorActionLog`, `AlarmEvent`, and a new `SystemEvent` model

### Task 2.3: Shift Management Page -- NEW PAGE

**New page** at `dashboard/shifts/page.tsx`:
- Current shift display with operator name
- Shift handover notes
- Events during current shift
- Shift history and reports
- Backend: new `Shift` and `ShiftEvent` models with CRUD endpoints

### Task 2.4: OEE / Performance Metrics Page -- NEW PAGE

**New page** at `dashboard/performance/page.tsx`:
- Overall Equipment Effectiveness calculation
- Availability % (uptime / planned production time)
- Performance % (actual output / ideal output)
- Quality % (good product / total product -- mapped to water quality compliance)
- Downtime Pareto chart
- Equipment utilization heatmap
- Backend: computed from existing `TagLog` + `AlarmEvent` + `EquipmentHealth` data

### Task 2.5: Enhance Plant Overview

**Current** (`plant-overview/page.tsx`, 279 lines): P&ID-inspired map with areas and equipment.  
**Enhancements:**
- Add real-time value overlays on equipment icons (live flow, pressure, level values floating on the diagram)
- Click equipment to open detail drawer with trend + alarm history for that asset
- Add pipe flow animation (animated dots showing flow direction)
- Area-level KPI summary cards

---

## Phase 3: AI/ML Deep Integration

### Task 3.1: Predictive Maintenance Engine

**Current** (`leak_detector.py`, 224 lines): Has variance tracking, predictive maintenance alerts based on increasing variance.  
**Enhancement -- new file `kora_ai/predictive_maintenance.py`:**
- Equipment health score (0-100) computed from: alarm frequency, running hours (from pump status tag), deviation from baseline
- Remaining Useful Life (RUL) estimation using linear degradation model
- Publishes to MQTT topic `kora/ai/equipment-health`
- Backend: new `EquipmentHealthScore` model with API endpoint

### Task 3.2: Root Cause Analysis Enhancement

**Current** (`leak_detector.py`): Has correlation detection for simultaneous sensor deviations.  
**Enhancement:**
- Build correlation matrix from multi-sensor windows
- When alarm triggers, auto-generate root cause hypothesis (e.g., "Pressure spike likely caused by valve closure based on 85% correlation")
- Publish root cause findings to `kora/ai/root-cause` MQTT
- Display in web alarms page (already partially integrated with `correlated_tags`)

### Task 3.3: Energy Optimization Advisor

**New file** `kora_ai/energy_optimizer.py`:
- Analyze pump running patterns vs flow efficiency
- Calculate specific energy (kWh per m3 pumped)
- Suggest optimal pump scheduling based on demand patterns
- Publish recommendations to `kora/ai/energy-advisory`
- Display as "Energy Advisory" card on web dashboard

### Task 3.4: Integrate AI Outputs into Web Dashboard

- **Dashboard page** (`page.tsx`): Add "AI Advisory" panel showing equipment health scores, energy recommendations, and predictive maintenance alerts
- **Analytics page** (`analytics/page.tsx`): Expand to show trend analyzer output with abnormality scoring timeline chart
- **Plant overview**: Show equipment health score badges on equipment cards

---

## Phase 4: Simulation Expansion

### Task 4.1: Add More Sensors to Arduino Code

**Current** (`esp32_water_control.ino`, 64 lines): 4 sensors (level, pump, flow, pressure).  
**Enhancement:**
- Add temperature sensor (simulated via potentiometer A2, range 40-110C)
- Add pH sensor (simulated via potentiometer A3, range 0-14 mapped to 6.0-9.0)
- Add turbidity sensor (NTU, range 0-100)
- Add dissolved oxygen (DO, range 0-15 mg/L)
- Update JSON output: `{"L":85,"P":0,"F":45,"Pr":2,"T":65,"pH":7.2,"Tu":5,"DO":8.5}`
- Update `serial_mqtt_bridge.py` to pass through new fields
- Update engine `tag_manager.py` to register new tags

### Task 4.2: PID Control Simulation

**Current**: Simple on/off pump control (level < 20% = ON, level > 95% = OFF).  
**Enhancement:**
- Add PID controller for flow rate setpoint tracking
- Simulate VFD (Variable Frequency Drive) for pump speed control (0-100%)
- Add to Arduino: accept setpoint commands via serial, adjust pump PWM output
- New MQTT topics: `kora/command/setpoint` (downstream), `kora/sensor/vfd_speed` (upstream)

### Task 4.3: Multi-Tank Cascade

**Enhancement to `simulate_proteus.py`:**
- Add Tank B simulation with interconnecting pipe
- Cascade logic: Tank A overflow feeds Tank B
- Independent level sensors per tank
- Valve between tanks (V03) with open/close control
- This gives the desktop Process tab a more realistic multi-stage process to monitor

### Task 4.4: Automated Fault Injection

**New capability in simulation:**
- Scheduled fault scenarios: sensor drift, stuck valve, pump cavitation, pipe leak
- Configurable via MQTT command `kora/simulation/inject_fault`
- Enables testing of AI detection and alarm systems
- Dashboard to show active injected faults (for demo/training purposes)

---

## Phase 5: Backend Capabilities

### Task 5.1: WebSocket Real-Time Updates

- Add `django-channels` to backend
- WebSocket endpoint `/ws/tags/` pushing tag updates to frontend every 2 seconds
- Replace polling in web dashboard with WebSocket subscription
- Fallback to REST polling if WebSocket unavailable

### Task 5.2: Comprehensive Audit Trail

- New `AuditEvent` model capturing: user, action, target, old_value, new_value, timestamp, ip_address
- Middleware to auto-log all write operations
- API endpoint `GET /api/audit/events/` for SOE viewer (Task 2.2)
- Filter by user, action type, date range

### Task 5.3: Report Generation

- New endpoint `GET /api/reports/generate/{type}/`
- Types: `shift_summary`, `alarm_history`, `equipment_status`, `compliance`
- Output formats: JSON (already exists), CSV, PDF (using `weasyprint` or `reportlab`)
- Scheduled report generation via `django-apscheduler` (already a dependency)

---

## Phase 6: Cross-Cutting Improvements

### Task 6.1: Dark Theme for Desktop HMI
- Currently has dark SCADA theme in `style.css` -- refine and add light theme toggle

### Task 6.2: Alarm Sound Integration
- Desktop: Play WAV sound file on critical alarm
- Web: Browser notification API for critical alarms
- Configurable mute/silence per severity level

### Task 6.3: Multi-Language Support
- Mobile has English/Amharic localization
- Extend to web frontend using Next.js i18n
- Extend to desktop using JavaFX resource bundles

---

## Implementation Order (Recommended)

| Wave | Tasks | Impact | Effort |
|---|---|---|---|
| **Wave 1** (This session) | 1.1, 1.2, 1.4 | Desktop transforms from single-view to professional multi-tab HMI | High |
| **Wave 2** | 1.3, 1.5, 6.2 | Equipment faceplates, shift management, alarm sounds | Medium |
| **Wave 3** | 2.2, 2.3, 2.4 | New web pages: SOE viewer, shifts, OEE/performance | Medium |
| **Wave 4** | 3.1, 3.2, 3.4 | AI predictive maintenance and root cause integration into UIs | High |
| **Wave 5** | 4.1, 4.2, 4.3 | Simulation expansion with more sensors and PID control | Medium |
| **Wave 6** | 5.1, 5.2, 5.3 | Backend WebSocket, audit trail, report generation | Medium |
| **Wave 7** | 2.1, 2.5, 3.3, 6.1, 6.3 | Polish: enhanced trends, energy advisor, dark theme, i18n | Low-Medium |

---

## Key Files to Modify (Wave 1)

- `kora_desktop/src/main/resources/ui/main_layout.fxml` -- Add TabPane structure
- `kora_desktop/src/main/resources/ui/dashboard.fxml` -- Refactor as "Overview" tab content
- `kora_desktop/src/main/java/com/kora/desktop/main/MainLayout.java` -- Wire TabPane
- `kora_desktop/src/main/java/com/kora/desktop/controller/DashboardController.java` -- Slim down to overview only
- `kora_desktop/src/main/java/com/kora/desktop/controller/AlarmTableController.java` -- New alarm table
- `kora_desktop/src/main/java/com/kora/desktop/controller/DiagnosticsController.java` -- New system diagnostics
- `kora_desktop/src/main/resources/ui/alarms_tab.fxml` -- New alarm table FXML
- `kora_desktop/src/main/resources/ui/diagnostics_tab.fxml` -- New diagnostics FXML
- `kora_desktop/src/main/resources/style.css` -- Alarm banner styling, tab styling
