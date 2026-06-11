"""
KORA AI — Trend Analyzer Module

Statistical trend analysis with:
- Moving average computation
- Rate of change tracking
- Variance tracking
- Abnormality scoring using sliding window z-score
- Publishes findings to kora/ai/trend-analysis MQTT topic
"""

import json
import time
import numpy as np
from collections import deque

import paho.mqtt.client as mqtt

# --- Configuration ---
WINDOW_SIZE = 60          # Sliding window size (readings)
PUBLISH_INTERVAL = 10     # Publish analysis every N seconds
Z_SCORE_THRESHOLD = 2.5   # Z-score above which a reading is considered abnormal
ROC_THRESHOLD = 5.0       # Rate-of-change threshold for rapid change detection

# Sensor tag configuration with expected normal ranges
SENSOR_CONFIG = {
    'flow_rate':    {'normal_min': 180, 'normal_max': 300, 'unit': 'L/min'},
    'pressure':     {'normal_min': 2.5, 'normal_max': 5.5, 'unit': 'bar'},
    'temperature':  {'normal_min': 50,  'normal_max': 80,  'unit': '°C'},
    'tank_a_level': {'normal_min': 20,  'normal_max': 95,  'unit': '%'},
    'tank_b_level': {'normal_min': 20,  'normal_max': 95,  'unit': '%'},
    'ph_level':     {'normal_min': 6.5, 'normal_max': 8.0, 'unit': ''},
}

# Sliding windows per sensor
windows = {tag: deque(maxlen=WINDOW_SIZE) for tag in SENSOR_CONFIG}
last_publish = {}


def compute_moving_average(data, period=5):
    """Compute simple moving average of the last `period` values."""
    if len(data) < period:
        return float(np.mean(data)) if data else 0.0
    return float(np.mean(list(data)[-period:]))


def compute_rate_of_change(data):
    """Compute average rate of change over the last 5 readings."""
    if len(data) < 2:
        return 0.0
    recent = list(data)[-5:]
    changes = [recent[i] - recent[i - 1] for i in range(1, len(recent))]
    return float(np.mean(changes))


def compute_variance_trend(data):
    """Compare variance of first half vs second half of window."""
    if len(data) < 10:
        return 'insufficient_data', 0.0, 0.0
    arr = np.array(data)
    mid = len(arr) // 2
    var_first = float(np.var(arr[:mid]))
    var_second = float(np.var(arr[mid:]))
    if var_second > var_first * 1.5:
        return 'increasing', var_first, var_second
    elif var_second < var_first * 0.5:
        return 'decreasing', var_first, var_second
    return 'stable', var_first, var_second


def compute_z_score_abnormality(data):
    """Compute z-score for the latest reading against the window statistics."""
    if len(data) < 5:
        return 0.0, False
    arr = np.array(data)
    mean = np.mean(arr)
    std = max(np.std(arr), 1e-9)
    z = abs(float((arr[-1] - mean) / std))
    return z, z > Z_SCORE_THRESHOLD


def detect_trend_direction(data):
    """Detect if the trend is rising, falling, or stable using linear regression slope."""
    if len(data) < 5:
        return 'insufficient_data'
    arr = np.array(list(data)[-10:])
    x = np.arange(len(arr))
    slope = np.polyfit(x, arr, 1)[0]
    if slope > 0.5:
        return 'rising'
    elif slope < -0.5:
        return 'falling'
    return 'stable'


def analyze_sensor(sensor_type, value, config):
    """Run full trend analysis on a sensor reading."""
    window = windows[sensor_type]
    window.append(value)

    if len(window) < 5:
        return None

    data = list(window)
    normal_min = config['normal_min']
    normal_max = config['normal_max']

    # Compute all features
    moving_avg = compute_moving_average(data)
    roc = compute_rate_of_change(data)
    var_trend, var_first, var_second = compute_variance_trend(data)
    z_score, is_z_abnormal = compute_z_score_abnormality(data)
    trend_dir = detect_trend_direction(data)

    # Abnormality scoring (0-100)
    score = 0
    reasons = []

    # Z-score contribution
    if is_z_abnormal:
        score += min(40, z_score * 10)
        reasons.append(f'High z-score: {z_score:.2f}')

    # Out-of-range contribution
    if value < normal_min or value > normal_max:
        deviation = max(abs(value - normal_min), abs(value - normal_max))
        range_size = normal_max - normal_min
        score += min(30, (deviation / max(range_size, 1e-9)) * 30)
        reasons.append(f'Out of range: {value:.1f} (expected {normal_min}-{normal_max})')

    # Rapid change contribution
    if abs(roc) > ROC_THRESHOLD:
        score += min(20, abs(roc) * 2)
        reasons.append(f'Rapid change: {roc:.2f}/reading')

    # Variance trend contribution
    if var_trend == 'increasing':
        score += 10
        reasons.append('Increasing variance (possible degradation)')

    score = min(100, score)
    is_abnormal = score >= 50

    return {
        'sensor_type': sensor_type,
        'current_value': round(value, 2),
        'moving_average': round(moving_avg, 2),
        'rate_of_change': round(roc, 4),
        'z_score': round(z_score, 3),
        'trend_direction': trend_dir,
        'variance_trend': var_trend,
        'abnormality_score': round(score, 1),
        'is_abnormal': is_abnormal,
        'reasons': reasons,
        'unit': config['unit'],
        'window_size': len(data),
        'timestamp': time.time(),
    }


def on_connect(client, userdata, flags, reason_code, properties=None):
    print('📈 Trend Analyzer connected to MQTT broker.')
    client.subscribe('kora/sensor/data')
    client.subscribe('kora/scada/tags')


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        now = time.time()

        for sensor_type, config in SENSOR_CONFIG.items():
            # Check various key names for the sensor value
            value = data.get(sensor_type)
            if value is None:
                # Try legacy names
                legacy_map = {
                    'tank_a_level': ['tank_level', 'Tank_Level'],
                    'flow_rate': ['Flow_Rate'],
                    'temperature': ['Temperature'],
                    'pressure': ['System_Pressure'],
                }
                for legacy in legacy_map.get(sensor_type, []):
                    value = data.get(legacy)
                    if value is not None:
                        break

            if value is None or not isinstance(value, (int, float)) or value == 0:
                continue

            result = analyze_sensor(sensor_type, float(value), config)
            if result and result['is_abnormal']:
                # Publish abnormal trend finding
                client.publish('kora/ai/trend-analysis', json.dumps(result))
                print(f"📈 TREND ABNORMALITY: {sensor_type} score={result['abnormality_score']}, "
                      f"z={result['z_score']}, trend={result['trend_direction']}")

            # Periodically publish all analysis results
            last_pub = last_publish.get(sensor_type, 0)
            if now - last_pub >= PUBLISH_INTERVAL and result:
                client.publish('kora/ai/trend-analysis', json.dumps(result))
                last_publish[sensor_type] = now

    except json.JSONDecodeError as e:
        print(f'❌ JSON decode error in trend_analyzer: {e}')
    except Exception as e:
        print(f'❌ Error in trend_analyzer: {e}')


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        print('🔗 Trend Analyzer connecting to MQTT broker at localhost:1883...')
        client.connect('localhost', 1883, 60)
        client.loop_forever()
    except Exception as e:
        print(f'❌ Trend Analyzer failed to connect: {e}')


if __name__ == '__main__':
    main()
