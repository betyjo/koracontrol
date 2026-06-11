import json
import time
import os
import pandas as pd
import paho.mqtt.client as mqtt
from sklearn.ensemble import IsolationForest
import numpy as np
import joblib
from collections import deque

# Load the pre-trained anomaly detection model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'anomaly_model.pkl')

print("🤖 Loading AI Model for Anomaly Detection...")
try:
    model = joblib.load(MODEL_PATH)
    print("✅ AI Model loaded successfully from anomaly_model.pkl")
except Exception as e:
    print(f"⚠️ Could not load model from {MODEL_PATH}: {e}")
    print("🔄 Fallback: Training temporary model for demonstration...")
    normal_data = pd.DataFrame({
        'value': np.random.normal(50, 5, 1000),   # Normal sensor values
    })
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(normal_data)
    print("✅ Temporary AI Model Ready.")

# --- Trend Window Analysis ---
WINDOW_SIZE = 30  # Keep last 30 readings per sensor
sensor_windows = {
    'flow_rate': deque(maxlen=WINDOW_SIZE),
    'pressure': deque(maxlen=WINDOW_SIZE),
    'temperature': deque(maxlen=WINDOW_SIZE),
    'tank_level': deque(maxlen=WINDOW_SIZE),
}
# Track consecutive variance increases for predictive maintenance
variance_history = {key: deque(maxlen=5) for key in sensor_windows}
last_variance = {key: None for key in sensor_windows}

# Track simultaneous deviations for correlated alarm detection
recent_anomalies = deque(maxlen=10)  # (timestamp, sensor_type, value)
CORRELATION_WINDOW_SECONDS = 30

# --- Root Cause Analysis ---
# Historical event patterns for root cause inference
event_history = deque(maxlen=50)  # (timestamp, sensor_type, value, features)
KNOWN_PATTERNS = {
    'pipe_leak': {
        'description': 'Pipe leakage detected',
        'conditions': {'flow_rate': 'high', 'pressure': 'low'},
        'recommendation': 'Inspect pipe sections for physical damage. Check joints and connections.',
    },
    'valve_failure': {
        'description': 'Valve malfunction suspected',
        'conditions': {'pressure': 'fluctuating', 'flow_rate': 'inconsistent'},
        'recommendation': 'Inspect valve actuator. Check for stuck or partially open valve.',
    },
    'pump_cavitation': {
        'description': 'Pump cavitation suspected',
        'conditions': {'flow_rate': 'low', 'pressure': 'fluctuating'},
        'recommendation': 'Check pump inlet for blockage. Verify NPSH requirements are met.',
    },
    'sensor_fault': {
        'description': 'Sensor fault suspected',
        'conditions': {'any': 'out_of_range_extreme'},
        'recommendation': 'Verify sensor calibration. Check wiring and connections.',
    },
    'tank_overflow_risk': {
        'description': 'Tank overflow risk',
        'conditions': {'tank_level': 'high', 'flow_rate': 'high'},
        'recommendation': 'Reduce inlet flow. Check outlet valve operation.',
    },
}


def analyze_root_cause(sensor_type, sensor_value, features):
    """Perform root cause analysis based on sensor data and known failure patterns."""
    if not features:
        return None
    
    root_causes = []
    
    # Get recent multi-sensor context
    recent_context = {}
    now = time.time()
    for ts, st, sv in recent_anomalies:
        if now - ts < CORRELATION_WINDOW_SECONDS * 2:
            recent_context[st] = sv
    
    # Pattern matching for known failure modes
    for pattern_name, pattern in KNOWN_PATTERNS.items():
        match_score = 0
        conditions = pattern['conditions']
        
        for cond_sensor, cond_state in conditions.items():
            if cond_sensor == 'any':
                # Check for extreme out-of-range values
                if features.get('z_score_latest', 0) > 3.5:
                    match_score += 1
                continue
            
            # Check current sensor
            if cond_sensor == sensor_type:
                current = sensor_value
            elif cond_sensor in recent_context:
                current = recent_context[cond_sensor]
            else:
                continue
            
            # Evaluate condition
            if cond_state == 'high':
                normal_ranges = {'flow_rate': 300, 'pressure': 5.5, 'tank_level': 95}
                if current > normal_ranges.get(cond_sensor, float('inf')) * 0.9:
                    match_score += 1
            elif cond_state == 'low':
                normal_ranges = {'flow_rate': 150, 'pressure': 2.0, 'tank_level': 20}
                if current < normal_ranges.get(cond_sensor, 0) * 1.1:
                    match_score += 1
            elif cond_state == 'fluctuating':
                if features.get('variance', 0) > 50:
                    match_score += 1
            elif cond_state == 'inconsistent':
                if abs(features.get('z_score_latest', 0)) > 2.5:
                    match_score += 1
        
        if match_score >= 2:
            root_causes.append({
                'pattern': pattern_name,
                'description': pattern['description'],
                'recommendation': pattern['recommendation'],
                'confidence': min(0.95, match_score / 3),
            })
    
    # If no specific pattern matched, provide generic analysis
    if not root_causes and features.get('z_score_latest', 0) > 2.5:
        root_causes.append({
            'pattern': 'unknown_anomaly',
            'description': f'Abnormal {sensor_type} reading detected (z-score: {features["z_score_latest"]:.2f})',
            'recommendation': f'Investigate {sensor_type} sensor and associated equipment.',
            'confidence': min(0.8, features['z_score_latest'] / 5),
        })
    
    return root_causes


def compute_window_features(window):
    """Compute statistical features from a sensor reading window."""
    if len(window) < 5:
        return None
    arr = np.array(window)
    return {
        'mean': float(np.mean(arr)),
        'std': float(np.std(arr)),
        'variance': float(np.var(arr)),
        'min': float(np.min(arr)),
        'max': float(np.max(arr)),
        'range': float(np.max(arr) - np.min(arr)),
        'z_score_latest': float((arr[-1] - np.mean(arr)) / max(np.std(arr), 1e-9)),
    }


def check_predictive_maintenance(client, sensor_type, features):
    """Heuristic: if variance is increasing over consecutive windows, publish degradation alert."""
    current_var = features['variance']
    hist = variance_history[sensor_type]

    if last_variance[sensor_type] is not None:
        hist.append(current_var > last_variance[sensor_type])
    last_variance[sensor_type] = current_var

    # If variance increased in 4 of last 5 windows, equipment may be degrading
    if len(hist) >= 4 and sum(list(hist)[-4:]) >= 3:
        degradation_msg = {
            'type': 'degradation',
            'source': 'predictive_maintenance',
            'message': f'Increasing variance in {sensor_type} suggests equipment degradation.',
            'sensor_type': sensor_type,
            'variance': round(current_var, 4),
            'trend': 'degrading',
            'recommended_action': f'Schedule inspection for {sensor_type} equipment.',
            'timestamp': time.time()
        }
        client.publish('kora/ai/alerts', json.dumps(degradation_msg))
        print(f'🔧 PREDICTIVE: Degradation alert for {sensor_type} (variance={current_var:.4f})')


def check_correlated_alarms(client, sensor_type, sensor_value):
    """Check if multiple sensors are deviating simultaneously."""
    now = time.time()
    recent_anomalies.append((now, sensor_type, sensor_value))

    # Count distinct sensor types with anomalies in the correlation window
    correlated = set()
    for ts, st, sv in recent_anomalies:
        if now - ts < CORRELATION_WINDOW_SECONDS:
            correlated.add(st)

    if len(correlated) >= 3:
        corr_msg = {
            'type': 'correlated_alarm',
            'source': 'correlation_detector',
            'message': f'Multiple sensors deviating simultaneously: {", ".join(sorted(correlated))}',
            'correlated_sensors': list(correlated),
            'count': len(correlated),
            'timestamp': now
        }
        client.publish('kora/ai/alerts', json.dumps(corr_msg))
        print(f'🔗 CORRELATED: {len(correlated)} sensors deviating: {", ".join(sorted(correlated))}')


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"✅ AI Module Connected to MQTT Broker. Listening for data...")
    client.subscribe("kora/sensor/data")  # Standardized MQTT topic
    client.subscribe("kora/scada/tags")  # Alternative standardized topic

def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        
        # Handle both old and new data formats
        flow = data.get("flow_rate") or data.get("Flow_Rate") or 0
        pressure = data.get("pressure") or data.get("System_Pressure") or 0
        temperature = data.get("temperature") or data.get("Temperature") or 0
        tank_level = data.get("tank_level") or data.get("Tank_Level") or data.get("tank_a_level") or 0
        
        # Use the most relevant sensor value for AI analysis
        sensor_value = 0
        sensor_type = "unknown"
        
        if flow > 0:
            sensor_value = flow
            sensor_type = "flow_rate"
        elif pressure > 0:
            sensor_value = pressure
            sensor_type = "pressure"
        elif temperature > 0:
            sensor_value = temperature
            sensor_type = "temperature"
        elif tank_level > 0:
            sensor_value = tank_level
            sensor_type = "tank_level"
        
        if sensor_value > 0:
            # 0. Trend window analysis
            if sensor_type in sensor_windows:
                sensor_windows[sensor_type].append(sensor_value)
                features = compute_window_features(sensor_windows[sensor_type])
                if features:
                    check_predictive_maintenance(client, sensor_type, features)

            # 1. Rule-based checks for critical conditions
            if flow > 70 and pressure < 2.0:
                print("🚨 CRITICAL: Rule-based Leakage Detected! (High Flow, Low Pressure)")
                # Publish critical alert to MQTT
                alert_msg = {
                    "type": "critical",
                    "source": "rule_based",
                    "message": "Rule-based Leakage Detected! (High Flow, Low Pressure)",
                    "flow_rate": flow,
                    "pressure": pressure,
                    "timestamp": time.time()
                }
                client.publish("kora/ai/alerts", json.dumps(alert_msg))
                
            # 2. AI-based anomaly detection using the trained model
            try:
                # Format data for prediction - use the value feature the model was trained on
                df = pd.DataFrame({'value': [sensor_value]})
                prediction = model.predict(df)[0]  # 1 is normal, -1 is anomaly
                
                # Calculate anomaly score (confidence)
                anomaly_score = model.score_samples(df)[0]
                confidence = abs(anomaly_score) if prediction == -1 else 1.0 - abs(anomaly_score)
                confidence = min(max(confidence, 0.0), 1.0)  # Clamp between 0 and 1
                
                if prediction == -1:
                    # Perform root cause analysis
                    current_features = None
                    if sensor_type in sensor_windows:
                        current_features = compute_window_features(sensor_windows[sensor_type])
                    root_causes = analyze_root_cause(sensor_type, sensor_value, current_features)
                    
                    print(f"🤖 AI ALERT: Abnormal pattern detected. {sensor_type}: {sensor_value:.2f}, confidence: {confidence:.2f}")
                    # Publish AI anomaly detection to MQTT
                    ai_alert = {
                        "type": "anomaly",
                        "source": "ai_model",
                        "message": f"AI detected abnormal pattern. {sensor_type}: {sensor_value:.2f}",
                        "sensor_type": sensor_type,
                        "sensor_value": sensor_value,
                        "is_anomaly": True,
                        "confidence": round(confidence, 2),
                        "root_causes": root_causes if root_causes else [],
                        "features": current_features if current_features else {},
                        "timestamp": time.time()
                    }
                    client.publish("kora/ai/analysis", json.dumps(ai_alert))

                    # Check for correlated alarms
                    check_correlated_alarms(client, sensor_type, sensor_value)
                else:
                    # Publish normal status less frequently to reduce noise
                    if int(time.time()) % 10 == 0:  # Every 10 seconds
                        status_msg = {
                            "type": "status",
                            "source": "ai_model",
                            "message": "Normal pattern detected",
                            "sensor_type": sensor_type,
                            "sensor_value": sensor_value,
                            "is_anomaly": False,
                            "confidence": round(confidence, 2),
                            "timestamp": time.time()
                        }
                        client.publish("kora/ai/analysis", json.dumps(status_msg))
                        
            except Exception as e:
                print(f"❌ AI prediction error: {e}")
            
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
    except Exception as e:
        print(f"❌ Message processing error: {e}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

try:
    print("🔗 Connecting to MQTT broker at localhost:1883...")
    client.connect("localhost", 1883, 60)
    client.loop_forever()
except Exception as e:
    print(f"❌ Failed to connect to MQTT broker: {e}")