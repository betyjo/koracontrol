"""
MQTT Service for Django Backend
Publishes tag updates and alarm notifications to MQTT broker for real-time integration
"""

import json
import logging
import os
import threading
import time
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

try:
    import paho.mqtt.client as mqtt
    PAHO_AVAILABLE = True
except ImportError:
    PAHO_AVAILABLE = False
    logger.warning("paho-mqtt not available. MQTT features will be disabled.")


class MQTTService:
    """
    Singleton MQTT service for Django backend
    Publishes real-time updates to MQTT broker for SCADA integration
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, 'initialized'):
            return
        
        self.client = None
        self.connected = False
        self.broker_host = os.environ.get('MQTT_BROKER_HOST', 'localhost')
        self.broker_port = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
        self.enabled = PAHO_AVAILABLE and os.environ.get('MQTT_ENABLED', 'true').lower() == 'true'
        self.initialized = True
        
        if self.enabled:
            self._connect()
    
    def _connect(self):
        """Connect to MQTT broker"""
        if not PAHO_AVAILABLE:
            logger.warning("Cannot connect to MQTT: paho-mqtt not installed")
            return False
        
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            
            self.client.connect(self.broker_host, self.broker_port, 60)
            self.client.loop_start()
            
            logger.info(f"🚀 MQTT Service connecting to {self.broker_host}:{self.broker_port}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to MQTT broker: {e}")
            self.connected = False
            return False
    
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        """Callback when MQTT connection is established"""
        self.connected = True
        logger.info(f"✅ MQTT Service connected to broker (code: {reason_code})")
    
    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        """Callback when MQTT connection is lost"""
        self.connected = False
        logger.warning(f"⚠️ MQTT Service disconnected (code: {reason_code})")
    
    def publish_tag_update(self, tag_name: str, value: Any, timestamp: Optional[str] = None):
        """
        Publish tag update to MQTT
        Topic: kora/scada/tags
        """
        if not self.enabled or not self.connected:
            return False
        
        try:
            payload = {
                'tag_name': tag_name,
                'value': value,
                'timestamp': timestamp
            }
            
            # Publish to both individual tag and aggregated tags topic
            self.client.publish(f"kora/tag/{tag_name}", json.dumps(payload))
            
            # Also publish to aggregated topic for compatibility
            aggregated_payload = {tag_name: value}
            self.client.publish("kora/scada/tags", json.dumps(aggregated_payload))
            
            logger.debug(f"📤 Published tag update: {tag_name} = {value}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to publish tag update: {e}")
            return False
    
    def publish_alarm_notification(self, alarm_data: Dict[str, Any]):
        """
        Publish alarm notification to MQTT
        Topic: kora/alarm/notifications
        """
        if not self.enabled or not self.connected:
            return False
        
        try:
            payload = {
                'alarm_id': alarm_data.get('id'),
                'severity': alarm_data.get('severity'),
                'message': alarm_data.get('message'),
                'tag_name': alarm_data.get('tag_name'),
                'triggered_value': alarm_data.get('triggered_value'),
                'timestamp': alarm_data.get('timestamp')
            }
            
            self.client.publish("kora/alarm/notifications", json.dumps(payload))
            logger.info(f"🚨 Published alarm notification: {alarm_data.get('message')}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to publish alarm notification: {e}")
            return False
    
    def publish_system_status(self, status_data: Dict[str, Any]):
        """
        Publish system status to MQTT
        Topic: kora/system/status
        """
        if not self.enabled or not self.connected:
            return False
        
        try:
            self.client.publish("kora/system/status", json.dumps(status_data))
            logger.debug(f"📊 Published system status")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to publish system status: {e}")
            return False
    
    def publish_ai_analysis(self, ai_data: Dict[str, Any]):
        """
        Publish AI analysis results to MQTT
        Topic: kora/ai/analysis
        """
        if not self.enabled or not self.connected:
            return False
        
        try:
            self.client.publish("kora/ai/analysis", json.dumps(ai_data))
            logger.info(f"🤖 Published AI analysis: {ai_data.get('message', 'N/A')}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to publish AI analysis: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from MQTT broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
            logger.info("🛑 MQTT Service disconnected")


# Global singleton instance
mqtt_service = MQTTService()


def publish_tag_update(tag_name: str, value: Any, timestamp: Optional[str] = None):
    """
    Convenience function to publish tag updates
    """
    return mqtt_service.publish_tag_update(tag_name, value, timestamp)


def publish_alarm_notification(alarm_data: Dict[str, Any]):
    """
    Convenience function to publish alarm notifications
    """
    return mqtt_service.publish_alarm_notification(alarm_data)


def publish_ai_analysis(ai_data: Dict[str, Any]):
    """
    Convenience function to publish AI analysis results
    """
    return mqtt_service.publish_ai_analysis(ai_data)