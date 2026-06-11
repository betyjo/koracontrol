"""
KORA AI — Predictive Maintenance Module

Monitors sensor data streams for equipment degradation patterns:
- Increasing variance (bearing wear)
- Decreased responsiveness (valve sticking)
- Efficiency loss (flow/pressure ratio degradation)
- Publishes maintenance recommendations via MQTT
"""

import json
import time
import numpy as np
from collections import deque, defaultdict
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Any

import paho.mqtt.client as mqtt

# --- Configuration ---
WINDOW_SIZE = 50            # Readings per analysis window
HISTORY_WINDOWS = 10        # Keep last 10 windows for trend analysis
PUBLISH_INTERVAL = 15       # Publish every 15 seconds
DEGRADATION_THRESHOLD = 0.3 # 30% change triggers alert
EFFICIENCY_WINDOW = 20      # Window for efficiency calculations


@dataclass
class EquipmentHealth:
    """Health assessment for a piece of equipment."""
    equipment_type: str       # pump, valve, pipe, sensor
    equipment_id: str         # e.g., 'pump_1', 'valve_main'
    health_score: float       # 0.0 (failed) to 1.0 (healthy)
    status: str               # healthy, degrading, warning, critical
    issues: List[str]         # List of detected issues
    recommendations: List[str] # Suggested actions
    metrics: Dict[str, Any]   # Raw metrics
    timestamp: float


@dataclass
class MaintenanceAlert:
    """Predictive maintenance alert."""
    alert_type: str           # degradation, efficiency_loss, stuck, wear
    severity: str             # info, warning, critical
    equipment_type: str
    equipment_id: str
    message: str
    confidence: float         # 0.0 to 1.0
    recommended_action: str
    estimated_days_to_failure: Optional[int]
    metrics: Dict[str, Any]
    timestamp: float


class PredictiveMaintenanceAnalyzer:
    """Analyzes sensor data for predictive maintenance insights."""
    
    def __init__(self):
        # Sensor data windows
        self.windows: Dict[str, deque] = defaultdict(lambda: deque(maxlen=WINDOW_SIZE))
        # Historical window statistics for trend detection
        self.history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=HISTORY_WINDOWS))
        # Equipment health states
        self.equipment_health: Dict[str, EquipmentHealth] = {}
        # Last publish timestamps
        self.last_publish: Dict[str, float] = {}
        # Flow/pressure pairs for efficiency analysis
        self.efficiency_pairs: deque = deque(maxlen=EFFICIENCY_WINDOW)
    
    def compute_window_stats(self, window: deque) -> Optional[Dict]:
        """Compute statistical features from a window of readings."""
        if len(window) < 10:
            return None
        arr = np.array(window)
        return {
            'mean': float(np.mean(arr)),
            'std': float(np.std(arr)),
            'variance': float(np.var(arr)),
            'min': float(np.min(arr)),
            'max': float(np.max(arr)),
            'range': float(np.max(arr) - np.min(arr)),
            'trend': self._compute_trend(arr),
            'count': len(arr),
        }
    
    def _compute_trend(self, data: np.ndarray) -> str:
        """Compute trend direction using linear regression."""
        if len(data) < 5:
            return 'insufficient'
        x = np.arange(len(data))
        slope = np.polyfit(x, data, 1)[0]
        if slope > 0.5:
            return 'rising'
        elif slope < -0.5:
            return 'falling'
        return 'stable'
    
    def check_variance_trend(self, sensor_type: str, current_variance: float) -> Dict:
        """Check if variance is increasing over time (bearing wear indicator)."""
        hist = self.history[sensor_type]
        hist.append({'variance': current_variance, 'timestamp': time.time()})
        
        if len(hist) < 4:
            return {'increasing': False, 'trend_strength': 0.0}
        
        # Check if variance is consistently increasing
        variances = [h['variance'] for h in hist]
        increases = sum(1 for i in range(1, len(variances)) if variances[i] > variances[i-1])
        trend_strength = increases / (len(variances) - 1)
        
        return {
            'increasing': trend_strength > 0.7,
            'trend_strength': round(trend_strength, 2),
            'variance_change': round((variances[-1] - variances[0]) / max(variances[0], 1e-9) * 100, 1),
        }
    
    def check_responsiveness(self, sensor_type: str, stats: Dict) -> Dict:
        """Check for decreased responsiveness (valve sticking, slow actuators)."""
        # Low range despite expected activity suggests sticking
        normal_ranges = {
            'pressure': (1.0, 5.0),
            'flow_rate': (20, 80),
            'tank_level': (10, 90),
        }
        
        expected = normal_ranges.get(sensor_type)
        if not expected:
            return {'responsive': True}
        
        expected_range = expected[1] - expected[0]
        actual_range = stats['range']
        
        # If actual range is less than 20% of expected, equipment may be stuck
        responsiveness = actual_range / max(expected_range, 1e-9)
        
        return {
            'responsive': responsiveness > 0.2,
            'responsiveness_ratio': round(responsiveness, 2),
            'actual_range': round(actual_range, 2),
            'expected_range': round(expected_range, 2),
        }
    
    def check_efficiency(self, flow: float, pressure: float) -> Optional[Dict]:
        """Analyze pump efficiency from flow/pressure relationship."""
        if flow <= 0 or pressure <= 0:
            return None
        
        # Efficiency proxy: flow per unit pressure
        efficiency = flow / max(pressure, 0.1)
        self.efficiency_pairs.append({
            'flow': flow,
            'pressure': pressure,
            'efficiency': efficiency,
            'timestamp': time.time(),
        })
        
        if len(self.efficiency_pairs) < 5:
            return None
        
        # Calculate efficiency trend
        efficiencies = [p['efficiency'] for p in self.efficiency_pairs]
        mean_eff = np.mean(efficiencies)
        
        # Check for degradation (decreasing efficiency)
        if len(efficiencies) >= 5:
            x = np.arange(len(efficiencies))
            slope = np.polyfit(x, efficiencies, 1)[0]
            efficiency_trend = 'degrading' if slope < -0.5 else ('improving' if slope > 0.5 else 'stable')
        else:
            slope = 0
            efficiency_trend = 'insufficient'
        
        # Compare current to historical mean
        current_eff = efficiencies[-1]
        deviation = (current_eff - mean_eff) / max(abs(mean_eff), 1e-9) * 100
        
        return {
            'current_efficiency': round(current_eff, 2),
            'mean_efficiency': round(mean_eff, 2),
            'efficiency_trend': efficiency_trend,
            'slope': round(slope, 4),
            'deviation_pct': round(deviation, 1),
        }
    
    def assess_equipment_health(self, sensor_type: str, stats: Dict, 
                                 variance_check: Dict, responsiveness: Dict) -> EquipmentHealth:
        """Assess overall equipment health."""
        issues = []
        recommendations = []
        health_score = 1.0
        
        # Variance degradation
        if variance_check.get('increasing'):
            health_score -= 0.3
            change = variance_check.get('variance_change', 0)
            issues.append(f'Increasing variance ({change}% change) - possible bearing wear')
            recommendations.append(f'Schedule vibration analysis for {sensor_type} equipment')
        
        # Responsiveness issues
        if not responsiveness.get('responsive', True):
            health_score -= 0.25
            ratio = responsiveness.get('responsiveness_ratio', 0)
            issues.append(f'Decreased responsiveness (ratio: {ratio}) - possible sticking')
            recommendations.append(f'Inspect actuator/valve for {sensor_type}')
        
        # Out of normal range
        mean = stats['mean']
        normal_ranges = {
            'pressure': (2.0, 6.0),
            'flow_rate': (150, 350),
            'tank_level': (15, 95),
            'temperature': (15, 40),
        }
        expected = normal_ranges.get(sensor_type)
        if expected:
            if mean < expected[0] or mean > expected[1]:
                health_score -= 0.2
                issues.append(f'Mean value {mean:.1f} outside normal range {expected}')
                recommendations.append(f'Investigate {sensor_type} operating conditions')
        
        # High variance relative to mean (noisy sensor)
        cv = stats['std'] / max(abs(stats['mean']), 1e-9)
        if cv > 0.3:
            health_score -= 0.15
            issues.append(f'High coefficient of variation ({cv:.2f}) - sensor may need calibration')
            recommendations.append(f'Calibrate {sensor_type} sensor')
        
        health_score = max(0.0, min(1.0, health_score))
        
        if health_score >= 0.8:
            status = 'healthy'
        elif health_score >= 0.6:
            status = 'degrading'
        elif health_score >= 0.4:
            status = 'warning'
        else:
            status = 'critical'
        
        return EquipmentHealth(
            equipment_type=sensor_type,
            equipment_id=f'{sensor_type}_primary',
            health_score=round(health_score, 2),
            status=status,
            issues=issues,
            recommendations=recommendations,
            metrics=stats,
            timestamp=time.time(),
        )
    
    def generate_maintenance_alert(self, health: EquipmentHealth, 
                                     variance_check: Dict, 
                                     efficiency: Optional[Dict]) -> List[MaintenanceAlert]:
        """Generate maintenance alerts based on health assessment."""
        alerts = []
        
        # Degradation alert
        if variance_check.get('increasing') and health.health_score < 0.7:
            change = variance_check.get('variance_change', 0)
            alerts.append(MaintenanceAlert(
                alert_type='degradation',
                severity='warning' if health.health_score > 0.5 else 'critical',
                equipment_type=health.equipment_type,
                equipment_id=health.equipment_id,
                message=f'{health.equipment_type} showing degradation pattern (variance +{change}%)',
                confidence=min(0.9, variance_check.get('trend_strength', 0.5)),
                recommended_action=f'Inspect {health.equipment_type} within 7 days',
                estimated_days_to_failure=30 if health.health_score > 0.5 else 7,
                metrics={'variance_change': change},
                timestamp=time.time(),
            ))
        
        # Sticking alert
        if not variance_check.get('responsive', True):
            alerts.append(MaintenanceAlert(
                alert_type='stuck',
                severity='warning',
                equipment_type=health.equipment_type,
                equipment_id=health.equipment_id,
                message=f'{health.equipment_type} showing decreased responsiveness',
                confidence=0.7,
                recommended_action=f'Check actuator/valve operation for {health.equipment_type}',
                estimated_days_to_failure=14,
                metrics={'responsiveness_ratio': variance_check.get('responsiveness_ratio', 0)},
                timestamp=time.time(),
            ))
        
        # Efficiency loss alert
        if efficiency and efficiency.get('efficiency_trend') == 'degrading':
            deviation = abs(efficiency.get('deviation_pct', 0))
            if deviation > 20:
                alerts.append(MaintenanceAlert(
                    alert_type='efficiency_loss',
                    severity='warning' if deviation < 40 else 'critical',
                    equipment_type='pump',
                    equipment_id='pump_primary',
                    message=f'Pump efficiency degrading ({deviation:.1f}% below normal)',
                    confidence=min(0.85, deviation / 100),
                    recommended_action='Inspect pump impeller and seals',
                    estimated_days_to_failure=21 if deviation < 40 else 5,
                    metrics=efficiency,
                    timestamp=time.time(),
                ))
        
        return alerts
    
    def process_sensor_data(self, data: Dict) -> List[Dict]:
        """Process incoming sensor data and return any alerts."""
        alerts = []
        now = time.time()
        
        # Extract sensor values
        sensors = {
            'flow_rate': data.get('flow_rate') or data.get('Flow_Rate'),
            'pressure': data.get('pressure') or data.get('System_Pressure'),
            'tank_level': data.get('tank_level') or data.get('tank_a_level') or data.get('Tank_Level'),
            'temperature': data.get('temperature') or data.get('Temperature'),
        }
        
        flow = sensors.get('flow_rate', 0) or 0
        pressure = sensors.get('pressure', 0) or 0
        
        # Check pump efficiency
        efficiency = None
        if flow > 0 and pressure > 0:
            efficiency = self.check_efficiency(float(flow), float(pressure))
        
        # Analyze each sensor
        for sensor_type, value in sensors.items():
            if value is None or not isinstance(value, (int, float)) or value == 0:
                continue
            
            # Add to window
            self.windows[sensor_type].append(float(value))
            
            # Compute statistics
            stats = self.compute_window_stats(self.windows[sensor_type])
            if not stats:
                continue
            
            # Run checks
            variance_check = self.check_variance_trend(sensor_type, stats['variance'])
            responsiveness = self.check_responsiveness(sensor_type, stats)
            
            # Assess health
            health = self.assess_equipment_health(sensor_type, stats, variance_check, responsiveness)
            self.equipment_health[sensor_type] = health
            
            # Generate alerts if needed
            if health.status in ('degrading', 'warning', 'critical'):
                new_alerts = self.generate_maintenance_alert(health, variance_check, efficiency)
                alerts.extend([asdict(a) for a in new_alerts])
        
        # Periodically publish equipment health summary
        if now - self.last_publish.get('health', 0) >= PUBLISH_INTERVAL:
            self.last_publish['health'] = now
            # Health summary is published by the caller
        
        return alerts
    
    def get_health_summary(self) -> Dict:
        """Get current health summary for all equipment."""
        summary = {}
        for sensor_type, health in self.equipment_health.items():
            summary[sensor_type] = {
                'health_score': health.health_score,
                'status': health.status,
                'issues': health.issues,
                'recommendations': health.recommendations,
            }
        return summary


# --- MQTT Client ---
analyzer = PredictiveMaintenanceAnalyzer()


def on_connect(client, userdata, flags, reason_code, properties=None):
    print('🔧 Predictive Maintenance Analyzer connected to MQTT broker.')
    client.subscribe('kora/sensor/data')
    client.subscribe('kora/scada/tags')


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        
        # Process sensor data
        alerts = analyzer.process_sensor_data(data)
        
        # Publish alerts
        for alert in alerts:
            alert['source'] = 'predictive_maintenance'
            client.publish('kora/ai/maintenance-alerts', json.dumps(alert))
            severity = alert.get('severity', 'info').upper()
            equip = alert.get('equipment_type', 'unknown')
            msg_text = alert.get('message', '')
            print(f'🔧 MAINTENANCE [{severity}]: {equip} - {msg_text}')
        
        # Periodically publish health summary
        now = time.time()
        if now - analyzer.last_publish.get('summary', 0) >= PUBLISH_INTERVAL:
            analyzer.last_publish['summary'] = now
            summary = analyzer.get_health_summary()
            if summary:
                client.publish('kora/ai/equipment-health', json.dumps({
                    'equipment_health': summary,
                    'timestamp': now,
                }))
    
    except json.JSONDecodeError as e:
        print(f'❌ JSON decode error in predictive_maintenance: {e}')
    except Exception as e:
        print(f'❌ Error in predictive_maintenance: {e}')


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        print('🔗 Predictive Maintenance connecting to MQTT broker at localhost:1883...')
        client.connect('localhost', 1883, 60)
        client.loop_forever()
    except Exception as e:
        print(f'❌ Predictive Maintenance failed to connect: {e}')


if __name__ == '__main__':
    main()
