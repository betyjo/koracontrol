# MQTT Topic Standardization for Kora Control System

## Standardized Topic Structure

### Data Topics (Publish)
- `kora/sensor/data` - Raw sensor data from simulation/hardware
  - Payload: `{"tank_level": 85, "pump_status": "ON", "flow_rate": 45, "pressure": 2}`

- `kora/scada/tags` - Processed tag updates from backend/engine
  - Payload: `{"L01": 85.5, "P01": 1.0, "F01": 45.2, "Pr01": 2.1}`

### Command Topics (Subscribe)
- `kora/command/pump` - Pump control commands
  - Payload: `{"command": "START|STOP", "pump_id": "P01"}`

- `kora/command/valve` - Valve control commands
  - Payload: `{"command": "OPEN|CLOSE", "valve_id": "V01"}`

- `kora/command/emergency` - Emergency stop commands
  - Payload: `{"command": "STOP_ALL"}`

- `kora/command/set_tag` - Generic tag setting commands
  - Payload: `{"tag_name": "L01", "value": 85.5}`

### Alarm Topics
- `kora/alarm/notifications` - Alarm notifications from backend
  - Payload: `{"alarm_id": 1, "severity": "high", "message": "Tank level critical", "tag": "L01"}`

## Migration Guide

### Simulation Bridge (`kora_simulation/serial_mqtt_bridge.py`)
**Change:** `water/tank/data` → `kora/sensor/data`

### Kora Engine (`kora_engine/engine.py`)
**Change:** Subscribe to `kora/sensor/data` instead of `water/tank/data`

### Kora Desktop (`kora_desktop/src/main/java/com/kora/desktop/service/DataService.java`)
**Changes:**
- Subscribe to `kora/sensor/data` instead of `water/tank/data`
- Subscribe to `kora/scada/tags` instead of `scada/tags/updates`
- Publish pump commands to `kora/command/pump` instead of `water/pump/cmd`
- Publish valve commands to `kora/command/valve` instead of `water/valve/cmd`
- Publish tag commands to `kora/command/set_tag` instead of `scada/tags/set`
- Subscribe to `kora/alarm/notifications` for alarm updates

## Benefits of Standardization

1. **Namespace Organization**: All topics under `kora/` prefix
2. **Logical Grouping**: Data, commands, and alarms are clearly separated
3. **Scalability**: Easy to add new components without conflicts
4. **Security**: Fine-grained access control by topic patterns
5. **Debugging**: Clear topic structure makes monitoring easier