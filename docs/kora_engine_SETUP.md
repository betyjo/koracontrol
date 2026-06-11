# Kora Engine Setup Instructions

## Environment Configuration

Create a `.env` file in the `kora_engine` directory with the following content:

```env
# Kora Engine Configuration
# Use a backend account that can access /api/tags/ and /api/logs/
KORA_ENGINE_USERNAME=admin
KORA_ENGINE_PASSWORD=admin123

# Optional: use this instead of username/password login
# KORA_ENGINE_TOKEN=your_access_token
```

## Prerequisites

1. **MQTT Broker**: Ensure MQTT broker is running on `localhost:1883`
2. **Kora Backend**: Ensure Django backend is running on `http://127.0.0.1:8000`
3. **Backend User**: Create a user in Django admin with permissions to access `/api/tags/` and `/api/logs/`
4. **Tags Configuration**: Create required tags in Django admin before starting the engine

## Required Tags

Create these tags in Django admin (`/admin/core/tag/`):
- `L01` - Tank Level
- `P01` - Pump Status  
- `F01` - Flow Rate
- `Pr01` - Pressure

## Running the Engine

```bash
cd kora_engine
python engine.py
```

## Integration Notes

The engine:
1. Subscribes to MQTT topic `water/tank/data`
2. Maps MQTT data to internal tags
3. Logs data to Django backend via REST API
4. Checks alarm thresholds every 2 seconds
5. Handles JWT authentication automatically