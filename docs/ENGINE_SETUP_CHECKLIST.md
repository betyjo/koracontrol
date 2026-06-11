# Kora Engine Setup - Completion Checklist

**Date**: May 26, 2026  
**Status**: ✅ **COMPLETE**

---

## Setup Completion Summary

### ✅ All Tasks Completed (4/4)

#### 1. ✅ `.env` file created in `kora_engine/`
- **Location**: `kora_engine/.env`
- **Status**: Created and configured
- **Content**:
  ```
  KORA_ENGINE_USERNAME=admin
  KORA_ENGINE_PASSWORD=admin123
  ```

#### 2. ✅ Backend credentials configured
- **Username**: `admin`
- **Password**: `admin123`
- **Authentication Type**: JWT (via `/api/auth/login/`)
- **Verified**: Yes ✅

#### 3. ✅ paho-mqtt installed
- **Package**: paho-mqtt
- **Version**: 2.1.0
- **Status**: Installed and ready
- **Also installed**:
  - requests: 2.31.0
  - python-dotenv: 1.2.2

#### 4. ✅ Tags exist in backend
- **Total Tags**: 11 (4 existing + 7 new)
- **New Required Tags**: All created
  - ✅ L01 (Tank Level) - %
  - ✅ P01 (Pump Status) - ON/OFF
  - ✅ F01 (Flow Rate) - L/min
  - ✅ Pr01 (Pressure) - Bar
  - ✅ V01 (Valve Status) - OPEN/CLOSE
  - ✅ P02 (Secondary Pump) - ON/OFF
  - ✅ V02 (Secondary Valve) - OPEN/CLOSE

---

## Backend API Verification

### ✅ All API Tests Passed

| Test | Result | Details |
|------|--------|---------|
| **Authentication** | ✅ PASSED | JWT token obtained successfully |
| **Tags Endpoint** | ✅ PASSED | 11 tags accessible (all 7 new tags present) |
| **Logs Endpoint** | ✅ PASSED | Engine can write sensor data |
| **API Response** | ✅ PASSED | All endpoints responding correctly |

---

## Engine Configuration Details

### Environment Variables
```
KORA_ENGINE_USERNAME=admin
KORA_ENGINE_PASSWORD=admin123

# Optional (not currently used):
# KORA_ENGINE_TOKEN=your_access_token
```

### Backend API Endpoints
- **Authentication**: `POST /api/auth/login/`
- **Tags**: `GET /api/tags/`
- **Logs**: `GET/POST /api/logs/`
- **Base URL**: `http://127.0.0.1:8000`

### Required Services
| Service | Status | Address |
|---------|--------|---------|
| Django Backend | ✅ Running | `http://127.0.0.1:8000` |
| MQTT Broker | ✅ Running | `localhost:1883` (Mosquitto) |
| Database | ✅ Available | SQLite |

---

## Engine Functionality Overview

### Data Flow
```
1. MQTT Subscribe → kora/sensor/data
   ↓
2. Parse sensor data payload
   ↓
3. Map to internal tags (L01, P01, F01, etc.)
   ↓
4. Log to Django backend via REST API
   ↓
5. Check alarm thresholds (every 2 seconds)
   ↓
6. Publish alarms if triggered
```

### Features
- ✅ MQTT topic subscription for `kora/sensor/data`
- ✅ Automatic JWT authentication
- ✅ REST API logging to backend
- ✅ Alarm threshold checking (2-second cycle)
- ✅ Command handling support (command_handler.py available)
- ✅ Tag mapping to sensor values

---

## Next Steps to Start Engine

### Prerequisites Check
- [x] Django backend running on http://127.0.0.1:8000
- [x] MQTT broker running on localhost:1883
- [x] Database populated with 11 tags
- [x] .env file configured with credentials

### To Start the Engine
```bash
cd kora_engine
python engine.py
```

### Expected Output
```
✅ Connected to MQTT Broker with result code 0
✅ Engine running, waiting for sensor data...
📡 Subscribed to kora/sensor/data
📡 Subscribed to kora/command/pump (and other topics)
```

---

## Configuration Files

### Files Created
- ✅ `kora_engine/.env` - Credentials and configuration

### Files Referenced
- `kora_engine/.env.example` - Template (already in repo)
- `kora_engine/engine.py` - Main engine implementation
- `kora_engine/tag_manager.py` - Tag management
- `kora_engine/alarm_manager.py` - Alarm threshold checking
- `kora_engine/command_handler.py` - Command processing
- `kora_engine/drivers.py` - Hardware drivers
- `kora_engine/SETUP.md` - Setup documentation
- `kora_engine/INTEGRATION_NOTES.md` - Integration details

---

## Docker/Production Considerations

### Current Setup
- Development mode with local credentials
- Direct REST API calls (not recommended for production)

### Production Recommendations
1. Use environment variables for all secrets
2. Store credentials in secure vault (e.g., HashiCorp Vault)
3. Use API tokens instead of username/password
4. Enable TLS/SSL for MQTT and API communications
5. Implement proper error handling and logging
6. Add monitoring and alerting
7. Use Docker for containerization

---

## Troubleshooting

### Issue: "Cannot connect to MQTT broker"
**Solution**: Verify Mosquitto is running
```bash
tasklist | find "mosquitto"
# or
Get-NetTCPConnection -LocalPort 1883
```

### Issue: "Authentication failed"
**Solution**: Verify backend is running and credentials are correct
```bash
# Backend must be running:
cd kora_backend
python manage.py runserver
```

### Issue: "Tags not found"
**Solution**: Verify tags exist in database
```bash
cd kora_backend
python manage.py shell -c "from core.models import Tag; print(Tag.objects.count())"
```

### Issue: "Cannot import dotenv"
**Solution**: Install python-dotenv
```bash
pip install python-dotenv
```

---

## Verification Commands

### Verify Environment
```bash
# Check .env file exists
ls kora_engine/.env

# Check packages installed
pip show paho-mqtt requests python-dotenv

# Test backend connectivity
python test_engine_backend.py
```

### Monitor Engine
```bash
# Watch engine output
cd kora_engine
python engine.py

# In another terminal, monitor MQTT messages
mosquitto_sub -h localhost -p 1883 -t 'kora/#' -v
```

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│          Kora Engine (Python)                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │         engine.py (main loop)           │   │
│  │  - MQTT Subscriber                      │   │
│  │  - REST API Client                      │   │
│  │  - Alarm Manager                        │   │
│  │  - Tag Manager                          │   │
│  └─────────────────────────────────────────┘   │
│        ↓              ↓              ↓          │
│    MQTT Broker   Backend API    Database       │
│    (localhost)   (127.0.0.1)    (SQLite)       │
│    :1883         :8000                         │
└─────────────────────────────────────────────────┘
```

---

## Environment File Example

**File**: `kora_engine/.env`

```env
# Backend Authentication
KORA_ENGINE_USERNAME=admin
KORA_ENGINE_PASSWORD=admin123

# Optional Token (for advanced authentication)
# KORA_ENGINE_TOKEN=your_jwt_token_here

# Note: Engine will prefer token if provided,
#       otherwise uses username/password
```

---

## Sign-Off

**Setup Task**: Kora Engine Configuration  
**Status**: ✅ COMPLETE  
**Date Completed**: May 26, 2026  
**Verification**: All tests passing, engine ready to start  

All prerequisites met:
- ✅ .env configured with valid credentials
- ✅ Backend authentication verified
- ✅ All required tags available in database
- ✅ API endpoints accessible and functional
- ✅ MQTT broker running and operational
- ✅ All dependencies installed

**Engine is ready to start!**

---

## Quick Start Summary

1. **Verify prerequisites**:
   ```bash
   python test_engine_backend.py
   ```

2. **Start MQTT broker** (if not running):
   ```bash
   # Already running (Mosquitto on localhost:1883)
   ```

3. **Start backend** (if not running):
   ```bash
   cd kora_backend
   python manage.py runserver
   ```

4. **Start engine**:
   ```bash
   cd kora_engine
   python engine.py
   ```

5. **Monitor MQTT topics**:
   ```bash
   mosquitto_sub -h localhost -p 1883 -t 'kora/#' -v
   ```

---

**For detailed information, refer to**:
- `kora_engine/SETUP.md` - Setup instructions
- `kora_engine/INTEGRATION_NOTES.md` - Integration details
- `kora_engine/README.md` - Complete documentation
