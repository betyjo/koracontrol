"""
Command Handler for Kora Engine
Processes MQTT commands for pump, valve, and emergency control
"""

import json
import logging

logger = logging.getLogger(__name__)


class CommandHandler:
    """Handles incoming MQTT commands for device control"""
    
    def __init__(self, tag_manager):
        self.tag_manager = tag_manager
    
    def handle_command(self, topic, payload):
        """
        Route command to appropriate handler based on topic
        """
        try:
            if topic == "kora/command/pump":
                self.handle_pump_command(payload)
            elif topic == "kora/command/valve":
                self.handle_valve_command(payload)
            elif topic == "kora/command/emergency":
                self.handle_emergency_command(payload)
            elif topic == "kora/command/set_tag":
                self.handle_set_tag_command(payload)
            else:
                logger.warning(f"Unknown command topic: {topic}")
                
        except Exception as e:
            logger.error(f"Error handling command on topic {topic}: {e}")
    
    def handle_pump_command(self, payload):
        """Handle pump control commands"""
        command = payload.get("command")
        pump_id = payload.get("pump_id", "P01")
        
        if command == "START":
            logger.info(f"🔄 Pump {pump_id} START command received")
            self.tag_manager.update_tag(pump_id, 1.0)
        elif command == "STOP":
            logger.info(f"🛑 Pump {pump_id} STOP command received")
            self.tag_manager.update_tag(pump_id, 0.0)
        else:
            logger.warning(f"Unknown pump command: {command}")
    
    def handle_valve_command(self, payload):
        """Handle valve control commands"""
        command = payload.get("command")
        valve_id = payload.get("valve_id", "V01")
        
        if command == "OPEN":
            logger.info(f"🔓 Valve {valve_id} OPEN command received")
            self.tag_manager.update_tag(valve_id, 1.0)
        elif command == "CLOSE":
            logger.info(f"🔒 Valve {valve_id} CLOSE command received")
            self.tag_manager.update_tag(valve_id, 0.0)
        else:
            logger.warning(f"Unknown valve command: {command}")
    
    def handle_emergency_command(self, payload):
        """Handle emergency stop commands"""
        command = payload.get("command")
        
        if command == "STOP_ALL":
            logger.warning("🚨 EMERGENCY STOP command received")
            # Stop all pumps
            self.tag_manager.update_tag("P01", 0.0)
            self.tag_manager.update_tag("P02", 0.0)
            # Close all valves
            self.tag_manager.update_tag("V01", 0.0)
            self.tag_manager.update_tag("V02", 0.0)
            # Additional emergency actions can be added here
        else:
            logger.warning(f"Unknown emergency command: {command}")
    
    def handle_set_tag_command(self, payload):
        """Handle generic tag setting commands"""
        tag_name = payload.get("tag_name")
        value = payload.get("value")
        
        if tag_name and value is not None:
            logger.info(f"📝 Set tag {tag_name} = {value}")
            self.tag_manager.update_tag(tag_name, value)
        else:
            logger.warning("Invalid set_tag command: missing tag_name or value")