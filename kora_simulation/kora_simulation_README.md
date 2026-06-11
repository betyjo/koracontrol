# 🧪 Kora Simulation Environment

<div align="center">

![Arduino](https://img.shields.io/badge/Arduino-C++-00878F)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![Proteus](https://img.shields.io/badge/Proteus-8.0-purple)
![MQTT](https://img.shields.io/badge/MQTT-5.0-orange)

**Hardware simulation environment for testing Kora Control system without physical hardware.**

</div>

---

## 🚀 Overview

The **Kora Simulation Environment** provides a complete hardware simulation setup using Proteus design software and Arduino code. It enables testing and development of the Kora Control system without requiring physical industrial hardware.

### 🎯 Key Capabilities
- **🔌 Virtual Serial Communication** - COM port emulation for data transfer
- **📡 MQTT Bridge** - Serial to MQTT message conversion
- **🎮 Arduino Integration** - Real Arduino code running in simulation
- **💻 Proteus Simulation** - Professional circuit simulation environment
- **📊 Realistic Data Generation** - Simulated sensor data with noise and variations
- **🔄 Real-time Operation** - Live data streaming to the Kora system

---

## 🏗️ Architecture

### System Components
```
┌─────────────────────────────────────────────────────────┐
│              Kora Simulation Environment                │
└─────────────────────────────────────────────────────────┘

    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │   Proteus   │───▶│   Serial     │───▶│   MQTT       │
    │  Simulation │    │   Port COM2  │    │   Broker     │
    │              │    │              │    │              │
    │  Arduino     │    │  Python      │    │  kora/       │
    │  Code       │    │  Bridge      │    │  sensor/     │
    │  (ESP32)     │    │  Script      │    │  data        │
    └──────────────┘    └──────────────┘    └──────────────┘
         │                                      │
         │                                      ▼
         │                            ┌──────────────┐
         │                            │  Kora Engine  │
         │                            │  & Backend   │
         └────────────────────────────┴──────────────┘
```

### Directory Structure
```
kora_simulation/
├── esp32_water_control/
│   └── esp32_water_control.ino    # Arduino firmware
├── serial_mqtt_bridge.py           # Serial to MQTT bridge
└── README.md                       # This file
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Arduino IDE** | C++ | Firmware development |
| **Proteus** | Circuit Simulation | Hardware simulation |
| **Python** | 3.8+ | Bridge script |
| **PySerial** | Latest | Serial communication |
| **paho-mqtt** | Latest | MQTT publishing |
| **LiquidCrystal** | Arduino Library | LCD display control |

---

## 🚦 Getting Started

### Prerequisites

#### Software Required
- **Proteus Design Suite 8.0+** - Circuit simulation
- **Arduino IDE 1.8+** - Code development and upload
- **Python 3.8+** - Bridge script execution
- **Virtual Serial Port Driver** - COM port emulation

#### Hardware Components (Simulated)
- **ESP32 Microcontroller** - Main control unit
- **Ultrasonic Sensor (HC-SR04)** - Tank level measurement
- **Potentiometers** - Flow rate and pressure simulation
- **Relay Module** - Pump control
- **LCD Display (16x2)** - Status monitoring
- **Virtual Serial Port (COM2)** - Data communication

### Installation

#### 1. Arduino Setup
```bash
# Install Arduino IDE from https://www.arduino.cc/en/software
# Install ESP32 board support
# Tools → Board → Boards Manager → Search "ESP32" → Install
```

#### 2. Python Dependencies
```bash
cd kora_simulation
pip install pyserial paho-mqtt
```

#### 3. Virtual Serial Port Setup
```bash
# Install virtual serial port driver
# Configure COM2 for Proteus communication
# Test port availability:
python -c "
import serial
ser = serial.Serial('COM2', 9600, timeout=1)
print('COM2 is available')
ser.close()
"
```

#### 4. Proteus Configuration
1. Open Proteus Design Suite
2. Create new project or open existing simulation
3. Configure virtual terminal for COM2
4. Add ESP32 component and circuit elements
5. Upload Arduino code to ESP32 simulation

---

## 📝 Arduino Code

### Code Overview
The Arduino code (`esp32_water_control.ino`) implements:

- **🎯 Tank Level Monitoring** - Ultrasonic sensor measurement
- **🔄 Pump Control Logic** - Automatic on/off based on level
- **📊 Sensor Simulation** - Potentiometer-based flow and pressure
- **💻 LCD Display** - Real-time status monitoring
- **📡 Serial Communication** - JSON data output

### Pin Configuration
```cpp
const int TRIG_PIN = 9;        // Ultrasonic trigger
const int ECHO_PIN = 3;        // Ultrasonic echo  
const int PUMP_RELAY_PIN = 13;  // Pump control relay
const int POT_FLOW_PIN = A0;    // Flow rate potentiometer
const int POT_PRESS_PIN = A1;   // Pressure potentiometer

// LCD pins
const int rs = 2, en = 4, d4 = 5, d5 = 6, d6 = 7, d7 = 8;
```

### Control Logic
```cpp
// Automatic pump control
if (level < 20) digitalWrite(PUMP_RELAY_PIN, HIGH);  // Start pump
if (level > 95) digitalWrite(PUMP_RELAY_PIN, LOW);   // Stop pump
```

### Data Output Format
```json
{
  "L": 85,    // Tank level (0-100%)
  "P": 1,     // Pump status (0=OFF, 1=ON)
  "F": 45,    // Flow rate (0-100 units)
  "Pr": 2     // Pressure (0-10 units)
}
```

---

## 📡 Serial to MQTT Bridge

### Bridge Script (`serial_mqtt_bridge.py`)

#### Configuration
```python
SERIAL_PORT = 'COM2'
BAUD_RATE = 9600
MQTT_BROKER = "localhost"
MQTT_TOPIC = "kora/sensor/data"
```

#### Data Transformation
The bridge converts Arduino data format to standardized MQTT format:

**Arduino Format:**
```json
{"L": 85, "P": 1, "F": 45, "Pr": 2}
```

**MQTT Format:**
```json
{
  "tank_level": 85,
  "pump_status": "ON",
  "flow_rate": 45,
  "pressure": 2
}
```

#### Running the Bridge
```bash
cd kora_simulation
python serial_mqtt_bridge.py
```

### Expected Output
```
Listening on COM2...
Connected to MQTT Broker with result code 0
Received from Proteus: {'L': 85, 'P': 1, 'F': 45, 'Pr': 2}
Published to MQTT: {'tank_level': 85, 'pump_status': 'ON', 'flow_rate': 45, 'pressure': 2}
```

---

## 🧪 Testing

### Serial Communication Test
```bash
cd ..
python test_serial_communication.py
```

### Manual Serial Test
```bash
# Test serial port directly
python -c "
import serial
import json

ser = serial.Serial('COM2', 9600, timeout=1)
while True:
    if ser.in_waiting > 0:
        line = ser.readline().decode('utf-8').strip()
        try:
            data = json.loads(line)
            print(f'Received: {data}')
        except:
            print(f'Raw: {line}')
"
```

### MQTT Test
```bash
# Subscribe to sensor data topic
python -c "
import paho.mqtt.client as mqtt

def on_message(client, userdata, msg):
    print(f'Received: {msg.payload.decode()}')

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_message = on_message
client.connect('localhost', 1883, 60)
client.subscribe('kora/sensor/data')
client.loop_forever()
"
```

---

## 🎮 Proteus Simulation Setup

### Circuit Components
1. **ESP32 Microcontroller** - Main processing unit
2. **HC-SR04 Ultrasonic Sensor** - Distance measurement
3. **2x Potentiometers (10k)** - Analog input simulation
4. **Relay Module** - Pump control simulation
5. **LCD 16x2** - Visual display
6. **Virtual Terminal** - Serial communication
7. **Power Supply (5V)** - Circuit power

### Simulation Steps

#### 1. Circuit Design
- Open Proteus ISIS
- Place components from library
- Wire connections according to schematic
- Configure component properties

#### 2. Arduino Integration
- Open Arduino IDE
- Load `esp32_water_control.ino`
- Select correct board (ESP32)
- Compile and verify code
- Export to hex file

#### 3. Proteus Configuration
- Double-click ESP32 in Proteus
- Load the hex file
- Configure virtual terminal for COM2
- Set baud rate to 9600

#### 4. Run Simulation
- Click play button in Proteus
- Monitor LCD display
- Check virtual terminal output
- Verify serial communication

---

## 📊 Simulated Data Ranges

### Tank Level (L)
- **Range:** 0-100%
- **Measurement:** Ultrasonic sensor
- **Update Rate:** 1 second
- **Noise:** Small random variations

### Pump Status (P)
- **States:** ON (1) / OFF (0)
- **Control:** Automatic based on level
- **Thresholds:** Start at 20%, Stop at 95%

### Flow Rate (F)
- **Range:** 0-100 units
- **Simulation:** Potentiometer A0
- **Mapping:** 0-1023 ADC → 0-100 units

### Pressure (Pr)
- **Range:** 0-10 units
- **Simulation:** Potentiometer A1
- **Mapping:** 0-1023 ADC → 0-10 units

---

## 🛠️ Troubleshooting

### Common Issues

**Serial port not available (COM2)**
```bash
# Check port availability
mode COM2

# Install virtual serial port driver
# Configure COM2 in device manager
# Ensure no other application is using COM2
```

**Proteus cannot connect to Arduino**
```bash
# Verify Arduino IDE is installed
# Check ESP32 board support is installed
# Export hex file from Arduino IDE
# Load hex file in Proteus ESP32 properties
```

**MQTT broker connection failed**
```bash
# Verify MQTT broker is running
netstat -an | findstr 1883

# Start Python alternative broker
python ../mqtt_broker.py
```

**No data in virtual terminal**
```bash
# Check Proteus virtual terminal configuration
# Verify baud rate is 9600
# Ensure ESP32 is running in simulation
# Check serial port wiring in circuit
```

**Bridge script not receiving data**
```bash
# Verify Proteus simulation is running
# Check virtual terminal output in Proteus
# Test serial port with terminal software
# Check bridge script configuration
```

---

## 🔧 Advanced Configuration

### Custom Data Ranges
Modify mapping in Arduino code:
```cpp
// Custom flow rate mapping
int flow = map(analogRead(POT_FLOW_PIN), 0, 1023, 0, 200); // 0-200 range

// Custom pressure mapping  
int press = map(analogRead(POT_PRESS_PIN), 0, 1023, 0, 20); // 0-20 range
```

### Different Serial Port
Modify in bridge script:
```python
SERIAL_PORT = 'COM3'  # Use COM3 instead of COM2
```

### Custom MQTT Topic
Modify in bridge script:
```python
MQTT_TOPIC = "custom/sensor/topic"
```

### Additional Sensor Data
Add to Arduino code:
```cpp
// Add temperature sensor
int temp = map(analogRead(A2), 0, 1023, 0, 100);

// Add to JSON output
Serial.print(",\"T\":"); Serial.print(temp);
```

---

## 📈 Performance

### Data Rates
- **Sensor Update Rate:** 1 Hz (1 second)
- **Serial Baud Rate:** 9600 baud
- **MQTT Publish Rate:** 1 Hz
- **End-to-End Latency:** < 2 seconds

### System Load
- **CPU Usage:** Minimal (Python bridge)
- **Memory Usage:** < 50 MB
- **Network Usage:** < 1 KB/s (MQTT)

---

## 🔒 Security

### Serial Communication
- Local communication only
- No authentication required (development)
- Hardware isolation in production

### MQTT Security
- Currently unauthenticated (development)
- For production: implement MQTT authentication
- Use TLS/SSL for secure communication

---

## 📚 Additional Resources

### Documentation
- [Arduino Language Reference](https://www.arduino.cc/reference/en/)
- [Proteus Documentation](https://www.labcenter.com/)
- [MQTT Protocol](https://mqtt.org/)
- [ESP32 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf)

### Related Kora Documentation
- [Integration Testing Guide](../INTEGRATION_TESTING_GUIDE.md)
- [MQTT Topics Reference](../MQTT_TOPICS.md)
- [Engine Documentation](../kora_engine/README.md)

---

## 🚀 Future Enhancements

### Planned Features
- [ ] Additional sensor simulations (temperature, pH)
- [ ] Multiple tank simulation
- [ ] Complex control logic implementation
- [ ] Historical data logging
- [ ] Web-based simulation control
- [ ] Real-time plotting interface

### Hardware Extensions
- [ ] Modbus slave simulation
- [ ] OPC-UA server simulation
- [ ] Additional PLC protocols
- [ ] Industrial network simulation

---

## 🤝 Contributing

### Adding New Sensors
1. Add sensor to Arduino circuit in Proteus
2. Update Arduino code to read sensor
3. Modify JSON output format
4. Update bridge script for new data
5. Document new sensor ranges

### Creating New Simulations
1. Design circuit in Proteus
2. Write Arduino firmware
3. Create bridge script if needed
4. Update documentation
5. Test integration with Kora system

---

## 📄 License

Part of the **Kora Control System**. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Automation Testing**

![Arduino](https://img.shields.io/badge/Arduino-C++-00878F)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![Proteus](https://img.shields.io/badge/Proteus-8.0-purple)
![Simulation](https://img.shields.io/badge/Simulation-Ready-green)

</div>