# MQTT Broker Setup Guide

## Overview
The Kora Control System uses MQTT (Message Queuing Telemetry Transport) for real-time communication between components:
- **Kora Desktop** (JavaFX UI)
- **Kora Engine** (Python processing)
- **Kora Simulation** (Test data generation)
- **Kora Backend** (Django REST API)

**Current Status**: ✅ **SETUP COMPLETE** - Mosquitto MQTT broker running on localhost:1883

---

## ✅ Setup Checklist

### 1. ✅ Install Dependencies
- [x] Install MQTT broker dependencies
  ```bash
  pip install -r mqtt_requirements.txt
  ```

### 2. ✅ Start MQTT Broker
- [x] MQTT broker is running on localhost:1883
  - **Broker Type**: Mosquitto (C-based, high-performance)
  - **Status**: Running (Process ID: 16212)
  - Expected to see messages on broker console

### 3. ✅ Test Connectivity
- [x] All connectivity tests PASSED (4/4)
  ```bash
  python test_mqtt_connectivity.py
  ```
  Results:
  - ✅ **Connection**: Successfully connected to broker
  - ✅ **Publish/Subscribe**: Successfully published and received message
  - ✅ **Multiple Topics**: Successfully published to all standardized topics
  - ✅ **QoS Levels**: All QoS levels (0, 1, 2) supported

### 4. ✅ Document Credentials
- [x] Reviewed credentials below
- [x] No authentication required (anonymous access enabled)

### 5. 🔄 Verify Component Integration
- [ ] Kora Desktop can connect
- [ ] Kora Engine can receive sensor data
- [ ] Kora Simulation can publish test data
- [ ] Kora Backend logs MQTT activity

---

## Broker Configuration

### Connection Details
| Setting | Value |
|---------|-------|
| **Broker** | Mosquitto |
| **Host** | localhost |
| **Port** | 1883 |
| **Protocol** | MQTT 3.1.1 |
| **Status** | ✅ Running |
| **Process ID** | 16212 |

### Authentication
| Setting | Value |
|---------|-------|
| **Mode** | Anonymous (No credentials required) |
| **Allow Anonymous** | ✅ Yes |
| **Username** | (Not configured) |
| **Password** | (Not configured) |

### Features
| Feature | Status |
|---------|--------|
| **TLS/SSL** | ❌ Not enabled (Development) |
| **Topic Check** | ❌ Disabled (Any topics allowed) |
| **QoS Support** | ✅ 0, 1, 2 |
| **Persistence** | ✅ Available |

---

## MQTT Topics

All topics follow the standardized namespace: `kora/`

### Data Topics (Publish)
- `kora/sensor/data` - Raw sensor data
  ```json
  {
    "tank_level": 85,
    "pump_status": "ON",
    "flow_rate": 45,
    "pressure": 2
  }
  ```

- `kora/scada/tags` - Processed tag updates
  ```json
  {
    "L01": 85.5,
    "P01": 1.0,
    "F01": 45.2
  }
  ```

### Command Topics (Subscribe)
- `kora/command/pump` - Pump control
  ```json
  {
    "command": "START|STOP",
    "pump_id": "P01"
  }
  ```

- `kora/command/valve` - Valve control
  ```json
  {
    "command": "OPEN|CLOSE",
    "valve_id": "V01"
  }
  ```

- `kora/command/emergency` - Emergency stop
  ```json
  {
    "command": "STOP_ALL"
  }
  ```

- `kora/command/set_tag` - Generic tag setting
  ```json
  {
    "tag_name": "L01",
    "value": 85.5
  }
  ```

### Alarm Topics
- `kora/alarm/notifications` - Alarm notifications
  ```json
  {
    "alarm_id": 1,
    "severity": "high",
    "message": "Tank level critical",
    "tag": "L01"
  }
  ```

---

## Connection Examples

### Python (paho-mqtt)
```python
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("localhost", 1883, 60)
client.loop_start()

# Subscribe to sensor data
client.subscribe("kora/sensor/data")

# Publish command
client.publish("kora/command/pump", '{"command": "START", "pump_id": "P01"}')

# Handle messages
def on_message(client, userdata, msg):
    print(f"Received: {msg.topic} = {msg.payload.decode()}")

client.on_message = on_message
```

### Java (Eclipse Paho)
```java
import org.eclipse.paho.client.mqttv3.*;

MqttClient client = new MqttClient("tcp://localhost:1883", "desktop-client");
client.connect();

// Subscribe to data
client.subscribe("kora/sensor/data");

// Publish command
client.publish("kora/command/pump", 
  "{\"command\": \"START\"}".getBytes(), 1, false);

// Handle messages
client.setCallback(new MqttCallback() {
    public void messageArrived(String topic, MqttMessage message) {
        System.out.println(topic + ": " + new String(message.getPayload()));
    }
});
```

---

## Troubleshooting

### Issue: Connection Refused
**Cause:** MQTT broker not running
```bash
# Check if broker is running
tasklist | find "mosquitto"

# If not running, ensure it's installed:
# Windows: Use Mosquitto installer or choco install mosquitto
# Linux: sudo apt-get install mosquitto mosquitto-clients
# macOS: brew install mosquitto
```

### Issue: "Address already in use"
**Cause:** Another process using port 1883
```bash
# Find process using port 1883
netstat -ano | find "1883"

# Kill the process (if needed)
taskkill /PID <PID> /F
```

### Issue: Topic not receiving messages
**Cause:** Incorrect topic name or QoS mismatch
- Verify topic name matches exactly
- Check QoS level (0, 1, or 2)
- Ensure subscriber subscribed before publisher sends

---

## Testing Commands

### Test Connection
```bash
python test_mqtt_connectivity.py
```

### Monitor Topics (Terminal 1)
```bash
# Using mosquitto_sub (if installed)
mosquitto_sub -h localhost -p 1883 -t 'kora/#' -v
```

### Publish Test Message (Terminal 2)
```bash
# Using mosquitto_pub (if installed)
mosquitto_pub -h localhost -p 1883 -t kora/test/connectivity -m '{"status":"ok"}'
```

---

## Production Considerations

For production deployment, consider:

1. **Enable TLS/SSL** - Encrypt communication
   ```
   listener 8883
   certfile /path/to/cert.pem
   keyfile /path/to/key.pem
   ```

2. **Enable Authentication**
   ```
   allow_anonymous false
   password_file /path/to/passwords.conf
   ```

3. **Enable Persistence**
   ```
   persistence true
   persistence_location /path/to/persistence/
   ```

4. **Monitor Performance**
   - Check broker logs regularly
   - Monitor memory usage and connections
   - Set up system alerts

5. **Backup & Recovery**
   - Regular backups of persistence files
   - Test recovery procedures
   - Document disaster recovery plan

---

## Reference Documentation

- [Mosquitto Documentation](https://mosquitto.org/)
- [MQTT Specification](http://mqtt.org/)
- [Eclipse Paho Client](https://www.eclipse.org/paho/)
- [Paho Python Client](https://pypi.org/project/paho-mqtt/)

---

## Support

For issues or questions, refer to:
- MQTT_TOPICS.md - Topic standardization
- INTEGRATION_TESTING_GUIDE.md - Component integration tests
- test_mqtt_connectivity.py - Connectivity test suite
- [Mosquitto GitHub](https://github.com/eclipse/mosquitto)
