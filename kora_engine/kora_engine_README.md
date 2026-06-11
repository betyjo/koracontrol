# ⚙️ Kora Industrial Engine

<div align="center">

![Python](https://img.shields.io/badge/Python-3.8+-blue)
![MQTT](https://img.shields.io/badge/MQTT-5.0-orange)
![Status](https://img.shields.io/badge/Status-Production-success)
![License](https://img.shields.io/badge/License-Proprietary-red)

**The core processing unit of the Kora Control system, acting as an intermediary layer between industrial hardware and central management.**

</div>

---

## 🚀 Overview

The **Kora Industrial Engine** is the heart of the Kora Control system, orchestrating real-time data collection, processing, and command execution. It serves as the bridge between physical hardware (PLCs, sensors, actuators) and the software management layer.

### 🎯 Key Responsibilities
- **🔄 Real-time Scanning**: 2-second polling interval for high-frequency data logging
- **📡 MQTT Communication**: Seamless integration with the MQTT broker
- **🎯 Command Processing**: Handle control commands from various interfaces
- **🚨 Alarm Monitoring**: Automatic threshold checking and alert generation
- **💾 Data Logging**: Push sensor data to the Django backend
- **🔌 Hardware Abstraction**: Unified interface for different protocol drivers

---

## 🏗️ Architecture

### Component Structure
```
kora_engine/
├── engine.py              # Main orchestration logic
├── tag_manager.py         # Data repository and state management
├── alarm_manager.py       # Safety monitoring and threshold checking
├── drivers.py             # Hardware protocol abstraction
├── command_handler.py     # MQTT command processing
├── .env.example           # Environment configuration template
├── SETUP.md               # Setup instructions
├── INTEGRATION_NOTES.md   # Integration documentation
└── requirements.txt       # Python dependencies
```

### Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Hardware   │───▶│   Engine    │───▶│   Backend   │
│ (Sensors/   │    │             │    │  (Django)   │
│  Actuators) │    │  • Process  │    │  • REST API │
└─────────────┘    │  • Monitor  │    │  • Database│
                  │  • Log      │    └─────────────┘
                  └─────────────┘
                        │
                        ▼
                  ┌─────────────┐
                  │ MQTT Broker │
                  │ (Commands/  │
                  │  Alarms)    │
                  └─────────────┘
```

---

## 🛠️ Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Python** | Core programming language | 3.8+ |
| **paho-mqtt** | MQTT client library | Latest |
| **requests** | HTTP client for backend API | Latest |
| **python-dotenv** | Environment variable management | Latest |

---

## 🚦 Getting Started

### Prerequisites
- Python 3.8 or higher
- Active Kora Backend running on http://127.0.0.1:8000
- MQTT broker running on localhost:1883
- Backend user with API access permissions

### Installation

#### 1. Install Dependencies
```bash
cd kora_engine
pip install paho-mqtt requests python-dotenv
```

#### 2. Configure Environment
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your backend credentials
# KORA_ENGINE_USERNAME=admin
# KORA_ENGINE_PASSWORD=admin123
```

#### 3. Required Backend Tags
Create these tags in Django admin before starting the engine:
- `L01` - Tank Level
- `P01` - Pump Status
- `F01` - Flow Rate
- `Pr01` - Pressure
- `V01` - Valve Status
- `P02` - Secondary Pump
- `V02` - Secondary Valve

#### 4. Run the Engine
```bash
python engine.py
```

### Expected Output
```
🚀 Kora Water SCADA Engine Started...
✅ Connected to MQTT Broker with result code 0
✅ Data Logged: L01 (ID:1) = 85.5
✅ Data Logged: P01 (ID:2) = 1.0
--- Scan Cycle Complete ---
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `KORA_ENGINE_USERNAME` | Backend username for authentication | - | Yes* |
| `KORA_ENGINE_PASSWORD` | Backend password for authentication | - | Yes* |
| `KORA_ENGINE_TOKEN` | JWT access token (alternative to username/password) | - | No |
| `API_URL` | Backend logging endpoint | `http://127.0.0.1:8000/api/logs/` | No |
| `AUTH_LOGIN_URL` | Backend authentication endpoint | `http://127.0.0.1:8000/api/auth/login/` | No |

*Either username/password or token must be provided

### MQTT Configuration

The engine connects to MQTT broker with these settings:
- **Broker:** `localhost:1883`
- **QoS:** 0 (At most once)
- **Topics:**
  - Subscribe: `kora/sensor/data`, `kora/command/pump`, `kora/command/valve`, `kora/command/emergency`, `kora/command/set_tag`
  - No publishing (engine acts as subscriber/processor)

---

## 📡 MQTT Integration

### Subscribed Topics

#### Sensor Data (`kora/sensor/data`)
Receives sensor data from simulation/hardware:
```json
{
  "tank_level": 85,
  "pump_status": "ON",
  "flow_rate": 45,
  "pressure": 2
}
```

#### Pump Commands (`kora/command/pump`)
Processes pump control commands:
```json
{
  "command": "START|STOP",
  "pump_id": "P01"
}
```

#### Valve Commands (`kora/command/valve`)
Processes valve control commands:
```json
{
  "command": "OPEN|CLOSE",
  "valve_id": "V01"
}
```

#### Emergency Commands (`kora/command/emergency`)
Handles emergency stop commands:
```json
{
  "command": "STOP_ALL"
}
```

#### Tag Commands (`kora/command/set_tag`)
Generic tag setting commands:
```json
{
  "tag_name": "L01",
  "value": 85.5
}
```

---

## 🎯 Component Details

### Tag Manager (`tag_manager.py`)
Maintains in-memory state of all industrial tags:
- Tag value storage
- Unit management
- Operational limits
- Historical data caching

### Alarm Manager (`alarm_manager.py`)
Monitors tag values against safety thresholds:
- Automatic threshold checking
- Alarm generation
- Severity classification
- Alert propagation

### Drivers (`drivers.py`)
Hardware protocol abstraction:
- `ProtocolAdapter` interface
- `MockDriver` for simulation
- Extensible for Modbus, S7, OPC-UA

### Command Handler (`command_handler.py`)
Processes MQTT commands:
- Pump control logic
- Valve control logic
- Emergency stop handling
- Generic tag operations

---

## � Hardware Integration

### Supported Protocols (Planned)
- **Modbus TCP** - Industrial standard
- **S7 Protocol** - Siemens PLCs
- **OPC-UA** - Modern industrial protocol
- **Serial/RS485** - Legacy hardware

### Adding New Drivers

1. Create driver class implementing `ProtocolAdapter`
2. Add driver configuration in `drivers.py`
3. Initialize driver in `engine.py`
4. Map driver data to tags in `tag_manager.py`

---

## � Alarm System

### Threshold Configuration

Configure thresholds in Django admin or `alarm_manager.py`:

```python
# Example alarm thresholds
ALARMS = {
    'L01': {
        'high': 90.0,
        'low': 10.0,
        'critical_high': 95.0,
        'critical_low': 5.0
    },
    'Pr01': {
        'high': 5.0,
        'low': 2.0
    }
}
```

### Alarm Severity Levels
- **INFO**: Informational notifications
- **WARNING**: Warning conditions
- **ALARM**: Alarm conditions requiring attention
- **CRITICAL**: Critical conditions requiring immediate action

---

## 🧪 Testing

### Unit Testing
```bash
# Test tag manager
python -m pytest test_tag_manager.py

# Test alarm manager
python -m pytest test_alarm_manager.py
```

### Integration Testing
```bash
# Run comprehensive integration test
cd ..
python test_serial_communication.py
```

### Manual Testing
```bash
# Test MQTT connection
python -c "
import paho.mqtt.client as mqtt
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect('localhost', 1883, 60)
print('MQTT connection successful')
"

# Test backend connection
python -c "
import requests
response = requests.get('http://127.0.0.1:8000/api/tags/')
print(f'Backend connection: {response.status_code}')
"
```

---

## � Monitoring

### Engine Status
The engine provides real-time status information:
- MQTT connection status
- Scan cycle timing
- Data logging statistics
- Alarm trigger count
- Error rates

### Logging
Logs are printed to console with these formats:
- `✅` - Success operations
- `❌` - Error conditions
- `🔄` - Processing activities
- `🚨` - Alarm notifications

---

## 🛠️ Troubleshooting

### Common Issues

**Engine cannot connect to MQTT broker**
```bash
# Verify broker is running
netstat -an | findstr 1883

# Start Python alternative broker
python ../mqtt_broker.py
```

**Authentication failures with backend**
```bash
# Verify .env file exists
# Check credentials match Django admin user
# Ensure user has permissions for /api/tags/ and /api/logs/
```

**Tag not found errors**
```bash
# Create required tags in Django admin
# Navigate to http://127.0.0.1:8000/admin/core/tag/
# Add tags: L01, P01, F01, Pr01, V01, P02, V02
```

**Scan cycle delays**
```bash
# Check backend response time
# Verify network connectivity
# Monitor MQTT broker performance
```

---

## 🔧 Advanced Configuration

### Custom Scan Intervals
Modify in `engine.py`:
```python
time.sleep(2)  # Change from 2 seconds to desired interval
```

### Custom MQTT Topics
Modify subscription in `engine.py`:
```python
client.subscribe("custom/topic/name")
```

### Additional Backend Endpoints
Add custom logging in `log_to_backend()`:
```python
# Add custom API calls
custom_payload = {"custom_field": value}
requests.post("http://backend/custom/endpoint", json=custom_payload)
```

---

## 📈 Performance Optimization

### Memory Management
- Use efficient data structures for tag storage
- Implement tag value compression
- Add data archiving for historical data

### Network Optimization
- Implement connection pooling
- Add request batching
- Use WebSocket for real-time updates

### Processing Optimization
- Add multi-threading for parallel tag processing
- Implement priority queues for critical alarms
- Add caching for frequently accessed data

---

## 🔒 Security

### Authentication
- JWT token support
- Username/password fallback
- Automatic token refresh
- Secure credential storage

### Data Security
- TLS/SSL for MQTT connections
- Encrypted backend communication
- Secure tag value storage
- Audit logging for sensitive operations

---

## � Additional Documentation

- [Setup Instructions](SETUP.md) - Detailed setup guide
- [Integration Notes](INTEGRATION_NOTES.md) - Integration details
- [Integration Testing Guide](../INTEGRATION_TESTING_GUIDE.md) - Testing procedures
- [MQTT Topics Reference](../MQTT_TOPICS.md) - Topic documentation

---

## 🤝 Contributing

### Adding Features
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit pull request

### Code Style
- Follow PEP 8 guidelines
- Add docstrings to functions
- Use type hints where appropriate
- Add error handling

---

## 📄 License

Part of the **Kora Control System**. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Automation**

![Python](https://img.shields.io/badge/Python-3.8+-blue)
![MQTT](https://img.shields.io/badge/MQTT-5.0-orange)
![Industrial](https://img.shields.io/badge/Industrial-Ready-green)

</div>