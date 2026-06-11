# Kora Engine Integration Notes

## Command Handling Integration

The engine now includes a `command_handler.py` module for processing MQTT commands. To integrate this into the main engine:

### Option 1: Manual Integration
Add this to your `engine.py`:

```python
from command_handler import CommandHandler

class KoraEngine:
    def __init__(self):
        self.tags = TagManager()
        self.alarms = AlarmManager()
        self.command_handler = CommandHandler(self.tags)  # Add this
        # ... rest of init
```

Then modify `on_mqtt_message`:
```python
def on_mqtt_message(self, client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        topic = msg.topic
        
        # Handle sensor data
        if topic == "kora/sensor/data":
            # ... existing sensor data handling ...
            
        # Handle all commands via command handler
        elif topic.startswith("kora/command/"):
            self.command_handler.handle_command(topic, payload)
            
    except json.JSONDecodeError:
        pass
```

### Option 2: Quick Integration
For now, the command logic is documented in `command_handler.py`. You can:
1. Reference the command logic when implementing control features
2. Import the handler directly when ready for full integration
3. Use the logic as a template for your own implementation

## Current Status
- ✅ MQTT topics standardized
- ✅ Command handler module created
- ✅ Backend MQTT service created
- ✅ Django signals for MQTT publishing added
- ⏳ Engine command integration (manual step required)
- ⏳ MQTT broker setup (manual step required)

## Next Steps
1. Manually integrate command_handler into engine.py (or use as reference)
2. Install and configure MQTT broker (Mosquitto or alternative)
3. Test end-to-end command flow
4. Verify serial communication for simulation