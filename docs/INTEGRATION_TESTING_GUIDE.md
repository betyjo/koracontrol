# Kora Control System - Integration Testing Guide

## Overview

This guide provides step-by-step instructions for testing the complete integration of all Kora system components.

## Prerequisites Checklist

### 1. MQTT Broker Setup

- [X] Install MQTT broker (Mosquitto recommended)
- [X] Configure broker to run on `localhost:1883`
- [X] Test broker connectivity
- [X] Document broker credentials (if authentication enabled)

**Quick MQTT Setup:**

```bash
# Windows: Download and install Mosquitto from https://mosquitto.org/download/
# Or use the Python broker alternative provided in mqtt_broker.py
```

### 2. Backend Setup

- [X] Django backend running on `http://127.0.0.1:8000`
- [X] Database migrations run (`python manage.py migrate`)
- [X] Admin user created (`python manage.py createsuperuser`)
- [X] paho-mqtt installed (`pip install paho-mqtt`)
- [X] Required tags created in Django admin:
  - L01 (Tank Level)
  - P01 (Pump Status)
  - F01 (Flow Rate)
  - Pr01 (Pressure)
  - V01 (Valve Status)
  - P02 (Secondary Pump)
  - V02 (Secondary Valve)

**Backend Environment:**

```bash
cd kora_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 3. Engine Setup

- [X] `.env` file created in `kora_engine/`
- [X] Backend credentials configured
- [X] paho-mqtt installed
- [X] Tags exist in backend before starting engine

**Engine Configuration:**

```bash
cd kora_engine
# Create .env file with:
# KORA_ENGINE_USERNAME=admin
# KORA_ENGINE_PASSWORD=admin123
```

### 4. Frontend Setup

- [X] Node.js dependencies installed (`npm install`)
- [X] Environment configured (`NEXT_PUBLIC_API_BASE_URL`)
- [X] Development server running (`npm run dev`)

**Frontend Setup:**

```bash
cd kora_frontend
npm install
npm run dev
```

### 5. Desktop Setup

- [X] Java 21+ installed
- [X] Maven dependencies resolved
- [X] Application builds successfully
- [X] MQTT client libraries available

**Desktop Setup:**

```bash
cd kora_desktop
mvn compile
mvn javafx:run
```

### 6. Simulation Setup

- [X] Proteus simulation configured
- [X] Virtual serial port (COM2) set up
- [X] Arduino code loaded in Proteus
- [X] Serial-to-MQTT bridge ready

## Integration Test Sequence

### Phase 1: Basic Connectivity Tests

#### Test 1.1: MQTT Broker Connectivity

```bash
# Test MQTT broker is running
# Using mosquitto_pub or Python client
python -c "
import paho.mqtt.client as mqtt
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect('localhost', 1883, 60)
client.publish('test/topic', 'Hello MQTT')
print('✅ MQTT broker is responding')
"
```

**Expected Result:** ✅ MQTT broker is responding

#### Test 1.2: Backend API Connectivity

```bash
# Test backend is accessible
curl http://127.0.0.1:8000/api/
```

**Expected Result:** API endpoint responds (404 or valid response)

#### Test 1.3: Frontend Connectivity

```bash
# Access frontend in browser
# http://localhost:3000
```

**Expected Result:** Frontend loads without errors

### Phase 2: Component Integration Tests

#### Test 2.1: Engine to Backend Integration

```bash
cd kora_engine
python engine.py
```

**Expected Results:**

- ✅ Engine connects to MQTT broker
- ✅ Engine fetches tags from backend
- ✅ Engine logs data to backend
- ✅ No authentication errors

#### Test 2.2: Backend MQTT Publishing

1. Create a TagLog entry via Django admin or API
2. Monitor MQTT topic `kora/scada/tags`
3. Verify tag update is published

**Expected Results:**

- ✅ Tag updates appear on MQTT topic
- ✅ JSON payload is valid
- ✅ Tag name and value are correct

#### Test 2.3: Alarm MQTT Publishing

1. Trigger an alarm via Django admin
2. Monitor MQTT topic `kora/alarm/notifications`
3. Verify alarm notification is published

**Expected Results:**

- ✅ Alarm notifications appear on MQTT topic
- ✅ Alarm details are accurate
- ✅ Severity level is correct

#### Test 2.4: Desktop MQTT Subscription

1. Start Kora Desktop application
2. Verify MQTT connection
3. Check topic subscriptions

**Expected Results:**

- ✅ Desktop connects to MQTT broker
- ✅ Subscribes to `kora/sensor/data`
- ✅ Subscribes to `kora/scada/tags`
- ✅ Subscribes to `kora/alarm/notifications`

### Phase 3: End-to-End Data Flow Tests

#### Test 3.1: Simulation to Frontend Data Flow

1. Start Proteus simulation
2. Start serial-to-MQTT bridge
3. Monitor MQTT topic `kora/sensor/data`
4. Check backend TagLog entries
5. Verify frontend dashboard updates

**Expected Results:**

- ✅ Simulation data appears on MQTT
- ✅ Engine receives and processes data
- ✅ Data logged to backend
- ✅ Frontend displays real-time data

#### Test 3.2: Command Flow (Desktop to Simulation)

1. Start all components
2. Send pump command from Desktop
3. Verify command reaches MQTT
4. Check if simulation/hardware responds

**Expected Results:**

- ✅ Commands published to MQTT
- ✅ Engine/subscribers receive commands
- ✅ Hardware state changes accordingly
- ✅ Feedback loop completes

#### Test 3.3: Alarm End-to-End Flow

1. Configure alarm thresholds in backend
2. Trigger alarm condition via simulation
3. Verify alarm propagation:
   - MQTT notification
   - Backend database entry
   - Frontend alert
   - Desktop notification

**Expected Results:**

- ✅ Alarm detected by engine
- ✅ Alarm published to MQTT
- ✅ Backend stores alarm event
- ✅ Frontend shows alarm
- ✅ Desktop displays alarm

### Phase 4: Performance and Reliability Tests

#### Test 4.1: Concurrent Data Handling

1. Start all components
2. Generate high-frequency sensor data
3. Monitor system performance
4. Check for data loss or delays

**Expected Results:**

- ✅ No significant data loss
- ✅ Acceptable latency (< 2 seconds)
- ✅ System remains stable

#### Test 4.2: Error Recovery

1. Stop MQTT broker temporarily
2. Verify component reconnection behavior
3. Restart MQTT broker
4. Check automatic recovery

**Expected Results:**

- ✅ Components attempt reconnection
- ✅ Automatic recovery works
- ✅ No manual intervention required

#### Test 4.3: Authentication Testing

1. Test with invalid credentials
2. Test with expired tokens
3. Verify authentication flow

**Expected Results:**

- ✅ Invalid credentials rejected
- ✅ Token refresh works correctly
- ✅ Authentication errors handled gracefully

## Common Issues and Solutions

### Issue: MQTT Connection Refused

**Solution:**

- Verify broker is running: `netstat -an | findstr 1883`
- Check broker configuration
- Ensure firewall allows port 1883

### Issue: Engine Authentication Fails

**Solution:**

- Verify `.env` file exists in `kora_engine/`
- Check credentials match Django admin user
- Ensure user has proper permissions

### Issue: Serial Port Not Found

**Solution:**

- Verify virtual serial port configuration (COM2)
- Check Proteus virtual terminal settings
- Test serial port with terminal software

### Issue: Frontend Cannot Connect to Backend

**Solution:**

- Verify CORS settings in Django settings.py
- Check backend is running on correct port
- Ensure API URL is correct in frontend environment

## Success Criteria

✅ **Basic Integration:**

- All components start without errors
- MQTT broker communication established
- Backend API accessible from all components

✅ **Data Flow:**

- Sensor data flows from simulation to frontend
- Commands flow from desktop to simulation
- Alarms propagate through entire system

✅ **Reliability:**

- System handles normal operation continuously
- Automatic recovery from temporary failures
- No data loss during normal operation

✅ **Performance:**

- End-to-end latency < 2 seconds
- UI updates are smooth and responsive
- System handles concurrent operations

## Next Steps After Testing

1. **Production Setup:**

   - Configure production MQTT broker with authentication
   - Set up proper database (PostgreSQL)
   - Configure SSL/TLS for secure communication
   - Set up monitoring and logging
2. **Documentation:**

   - Document custom configurations
   - Create user manuals for operators
   - Establish maintenance procedures
3. **Optimization:**

   - Tune database queries
   - Optimize MQTT QoS levels
   - Implement data archiving policies
   - Add caching where appropriate

## Support Resources

- **Backend Issues:** Check Django logs at `kora_backend/logs/`
- **Engine Issues:** Check console output and `kora_engine/` logs
- **Desktop Issues:** Check Java console output
- **MQTT Issues:** Use MQTT explorer or similar tools for debugging
- **Serial Issues:** Use serial port monitoring tools
