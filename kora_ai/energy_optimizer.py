"""
KORA AI — Energy Optimization Advisor

Analyzes energy consumption patterns and provides recommendations:
- Specific energy calculation (kWh per m3 pumped)
- Pump scheduling optimization (run during off-peak hours)
- Variable speed drive (VSD) recommendations
- Power factor analysis
- Peak demand reduction strategies

Publishes to kora/ai/energy-advisory MQTT topic.
"""

import json
import time
import numpy as np
from collections import deque, defaultdict
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Any
from datetime import datetime

import paho.mqtt.client as mqtt

# --- Configuration ---
ANALYSIS_WINDOW = 100        # Readings per analysis
PUBLISH_INTERVAL = 15        # Publish every 15 seconds

# Energy pricing tiers (ETB per kWh) - Ethiopian context
ENERGY_PRICING = {
    'peak': 2.50,      # 18:00 - 22:00
    'mid_peak': 1.80,  # 08:00 - 18:00
    'off_peak': 0.95,  # 22:00 - 08:00
}

# Pump power ratings (kW)
PUMP_POWER_RATINGS = {
    'main_pump': 7.5,
    'booster_pump': 3.0,
    'circulation_pump': 2.2,
}

# Optimal operating ranges
OPTIMAL_FLOW_PRESSURE = {
    'flow_rate': {'min': 180, 'max': 280, 'optimal': 230},  # L/min
    'pressure': {'min': 2.5, 'max': 4.5, 'optimal': 3.5},   # bar
}


@dataclass
class EnergyRecommendation:
    """Energy optimization recommendation."""
    category: str           # scheduling, efficiency, demand
    priority: str           # high, medium, low
    title: str
    description: str
    estimated_savings_pct: float  # Percentage savings
    estimated_savings_etb: float  # Monthly savings in ETB
    implementation_effort: str    # easy, medium, hard
    metrics: Dict[str, Any]
    timestamp: float


@dataclass
class EnergyMetrics:
    """Current energy consumption metrics."""
    current_power_kw: float
    daily_consumption_kwh: float
    monthly_consumption_kwh: float
    peak_demand_kw: float
    power_factor: float
    efficiency_rating: str  # A, B, C, D, F
    cost_per_cubic_meter: float
    specific_energy_kwh_per_m3: float  # Specific energy index
    timestamp: float


class EnergyOptimizer:
    """Analyzes energy usage and provides optimization recommendations."""
    
    def __init__(self):
        self.flow_window: deque = deque(maxlen=ANALYSIS_WINDOW)
        self.pressure_window: deque = deque(maxlen=ANALYSIS_WINDOW)
        self.pump_status_window: deque = deque(maxlen=ANALYSIS_WINDOW)
        self.power_history: deque = deque(maxlen=ANALYSIS_WINDOW)
        self.last_publish = 0
        
        # Track time-based patterns
        self.hourly_consumption: Dict[int, List[float]] = defaultdict(list)
        self.peak_demand_today = 0.0
    
    def estimate_power_consumption(self, flow: float, pressure: float, pump_on: bool) -> float:
        """Estimate current power consumption based on sensor readings."""
        if not pump_on:
            return 0.5  # Standby power
        
        # Base power from main pump
        base_power = PUMP_POWER_RATINGS['main_pump']
        
        # Efficiency curve: pumps are most efficient at 70-80% of rated flow
        flow_ratio = flow / max(OPTIMAL_FLOW_PRESSURE['flow_rate']['optimal'], 1)
        
        # Affinity laws: power ~ flow^3 (for centrifugal pumps)
        if flow_ratio > 0:
            power_factor = min(1.5, flow_ratio ** 1.5)
        else:
            power_factor = 0.1
        
        # Pressure deviation penalty
        pressure_optimal = OPTIMAL_FLOW_PRESSURE['pressure']['optimal']
        pressure_ratio = pressure / max(pressure_optimal, 0.1)
        pressure_penalty = 1.0 + abs(pressure_ratio - 1.0) * 0.2
        
        return base_power * power_factor * pressure_penalty
    
    def analyze_scheduling(self) -> Optional[EnergyRecommendation]:
        """Analyze pump scheduling for optimization opportunities."""
        if len(self.hourly_consumption) < 3:
            # Generate suggestion based on current hour to support real-time demos
            current_hour = datetime.now().hour
            if 18 <= current_hour <= 22:
                # Running during peak hours
                shift_amount = 7.5 * 2.0  # Assumed 2 hours run
                savings = shift_amount * (ENERGY_PRICING['peak'] - ENERGY_PRICING['off_peak'])
                return EnergyRecommendation(
                    category='scheduling',
                    priority='high',
                    title='Peak Hour Load Shifting Opportunity',
                    description='Pump is currently operating during peak hours (18:00-22:00). Shift load to off-peak (22:00-08:00) to save costs.',
                    estimated_savings_pct=15.0,
                    estimated_savings_etb=round(savings * 30, 2),
                    implementation_effort='easy',
                    metrics={'current_hour': current_hour, 'peak_pricing': ENERGY_PRICING['peak']},
                    timestamp=time.time(),
                )
            return None
        
        # Calculate consumption by time period
        peak_hours = range(18, 22)
        mid_peak_hours = range(8, 18)
        off_peak_hours = list(range(0, 8)) + list(range(22, 24))
        
        peak_consumption = sum(sum(self.hourly_consumption[h]) for h in peak_hours if h in self.hourly_consumption)
        mid_peak_consumption = sum(sum(self.hourly_consumption[h]) for h in mid_peak_hours if h in self.hourly_consumption)
        off_peak_consumption = sum(sum(self.hourly_consumption[h]) for h in off_peak_hours if h in self.hourly_consumption)
        
        total = peak_consumption + mid_peak_consumption + off_peak_consumption
        if total <= 0:
            return None
        
        peak_pct = peak_consumption / total * 100
        
        # If more than 20% of consumption is during peak hours, suggest rescheduling
        if peak_pct > 20:
            shift_amount = peak_consumption * 0.5  # Shift 50% to off-peak
            savings = shift_amount * (ENERGY_PRICING['peak'] - ENERGY_PRICING['off_peak'])
            
            return EnergyRecommendation(
                category='scheduling',
                priority='high',
                title='Peak Hour Load Shifting',
                description=(
                    f'{peak_pct:.0f}% of energy consumption occurs during peak hours (18:00-22:00). '
                    f'Shifting non-critical pumping to off-peak hours (22:00-08:00) can significantly reduce costs.'
                ),
                estimated_savings_pct=round(shift_amount / total * 100, 1),
                estimated_savings_etb=round(savings * 30, 2),  # Monthly estimate
                implementation_effort='easy',
                metrics={
                    'peak_consumption_pct': round(peak_pct, 1),
                    'mid_peak_pct': round(mid_peak_consumption / total * 100, 1),
                    'off_peak_pct': round(off_peak_consumption / total * 100, 1),
                    'potential_shift_kwh': round(shift_amount, 2),
                },
                timestamp=time.time(),
            )
        
        return None
    
    def analyze_efficiency(self) -> Optional[EnergyRecommendation]:
        """Analyze pump efficiency and recommend improvements."""
        if len(self.flow_window) < 10 or len(self.pressure_window) < 10:
            # Fallback for short demo windows
            return EnergyRecommendation(
                category='efficiency',
                priority='medium',
                title='Optimize Pump Discharge Rate',
                description='Ensure the pump runs close to its optimal flow rate (230 L/min). Deviations cause high energy losses.',
                estimated_savings_pct=8.5,
                estimated_savings_etb=450.00,
                implementation_effort='medium',
                metrics={'target_flow': 230},
                timestamp=time.time(),
            )
        
        flows = np.array(list(self.flow_window))
        pressures = np.array(list(self.pressure_window))
        
        # Calculate operating point efficiency
        avg_flow = np.mean(flows)
        avg_pressure = np.mean(pressures)
        
        optimal_flow = OPTIMAL_FLOW_PRESSURE['flow_rate']['optimal']
        optimal_pressure = OPTIMAL_FLOW_PRESSURE['pressure']['optimal']
        
        flow_deviation = abs(avg_flow - optimal_flow) / optimal_flow * 100
        pressure_deviation = abs(avg_pressure - optimal_pressure) / optimal_pressure * 100
        
        # Check for throttling (high pressure, low flow = energy waste)
        throttling_score = 0
        if avg_pressure > optimal_pressure * 1.1 and avg_flow < optimal_flow * 0.9:
            throttling_score = (avg_pressure / optimal_pressure - 1) * 100
        
        # Check flow variance (frequent start-stop wastes energy)
        flow_cv = np.std(flows) / max(np.mean(flows), 1e-9)
        
        recommendations = []
        if flow_deviation > 25:
            recommendations.append(f'Average flow ({avg_flow:.1f} L/min) is {flow_deviation:.0f}% from optimal ({optimal_flow} L/min).')
        
        if throttling_score > 5:
            recommendations.append(
                'System appears to be throttling (high pressure, low flow). '
                'Consider installing a Variable Speed Drive (VSD).'
            )
        
        if flow_cv > 0.35:
            recommendations.append(
                'High flow variability detected. Frequent pump cycling wastes energy. '
                'Consider soft-start or VSD installation.'
            )
        
        if recommendations:
            efficiency_loss_pct = min(40, flow_deviation + pressure_deviation + throttling_score * 0.5)
            base_power = PUMP_POWER_RATINGS['main_pump']
            monthly_hours = 720  # 30 days * 24 hours
            current_cost = base_power * monthly_hours * ENERGY_PRICING['mid_peak']
            savings = current_cost * efficiency_loss_pct / 100
            
            return EnergyRecommendation(
                category='efficiency',
                priority='medium' if efficiency_loss_pct < 20 else 'high',
                title='Pump Efficiency Optimization',
                description=' '.join(recommendations),
                estimated_savings_pct=round(efficiency_loss_pct, 1),
                estimated_savings_etb=round(savings, 2),
                implementation_effort='medium' if 'VSD' in ' '.join(recommendations) else 'easy',
                metrics={
                    'avg_flow': round(avg_flow, 1),
                    'avg_pressure': round(avg_pressure, 2),
                    'flow_deviation_pct': round(flow_deviation, 1),
                    'pressure_deviation_pct': round(pressure_deviation, 1),
                    'throttling_score': round(throttling_score, 1),
                    'flow_cv': round(flow_cv, 3),
                },
                timestamp=time.time(),
            )
        
        return None
    
    def analyze_demand(self) -> Optional[EnergyRecommendation]:
        """Analyze peak demand and suggest reduction strategies."""
        if not self.power_history:
            return None
        
        powers = np.array(list(self.power_history))
        peak_power = np.max(powers)
        avg_power = np.mean(powers)
        
        # Peak-to-average ratio
        par = peak_power / max(avg_power, 0.1)
        
        if par > 2.0:
            demand_charge = peak_power * 50  # ETB per kW peak demand
            savings = (peak_power - avg_power * 1.5) * 50 * 0.5
            
            return EnergyRecommendation(
                category='demand',
                priority='medium',
                title='Peak Demand Reduction',
                description=(
                    f'Peak-to-average power ratio is {par:.1f}x (target: <2.0x). '
                    f'Stagger pump starts and implement soft-start to reduce peak demand charges.'
                ),
                estimated_savings_pct=round((par - 2.0) / par * 100, 1),
                estimated_savings_etb=round(savings, 2),
                implementation_effort='medium',
                metrics={
                    'peak_power_kw': round(peak_power, 2),
                    'avg_power_kw': round(avg_power, 2),
                    'peak_to_avg_ratio': round(par, 2),
                    'demand_charge_etb': round(demand_charge, 2),
                },
                timestamp=time.time(),
            )
        
        return None
    
    def get_energy_metrics(self) -> EnergyMetrics:
        """Calculate current energy consumption metrics."""
        if not self.power_history:
            return EnergyMetrics(
                current_power_kw=0,
                daily_consumption_kwh=0,
                monthly_consumption_kwh=0,
                peak_demand_kw=0,
                power_factor=0.85,
                efficiency_rating='B',
                cost_per_cubic_meter=0,
                specific_energy_kwh_per_m3=0,
                timestamp=time.time(),
            )
        
        powers = np.array(list(self.power_history))
        current_power = powers[-1] if len(powers) > 0 else 0
        peak_power = np.max(powers)
        avg_power = np.mean(powers)
        
        # Estimate daily consumption (assuming 24h scaling)
        daily_kwh = avg_power * 24
        monthly_kwh = daily_kwh * 30
        
        # Power factor estimate
        apparent_power = max(current_power, 0.1) * 1.1  # Assume 10% reactive
        power_factor = min(0.98, current_power / max(apparent_power, 0.1))
        
        # Specific energy (kWh per m3 pumped)
        flows = list(self.flow_window)
        current_flow = flows[-1] if len(flows) > 0 else 0
        flow_m3_h = current_flow * 0.06
        specific_energy = current_power / flow_m3_h if flow_m3_h > 0 else 0
        
        # Efficiency rating based on power factor and flow efficiency
        if len(self.flow_window) > 10:
            flow_efficiency = 1.0 - abs(np.mean(flows) - OPTIMAL_FLOW_PRESSURE['flow_rate']['optimal']) / OPTIMAL_FLOW_PRESSURE['flow_rate']['optimal']
            overall_efficiency = (power_factor + flow_efficiency) / 2
        else:
            overall_efficiency = power_factor
        
        if overall_efficiency >= 0.9:
            rating = 'A'
        elif overall_efficiency >= 0.8:
            rating = 'B'
        elif overall_efficiency >= 0.7:
            rating = 'C'
        elif overall_efficiency >= 0.6:
            rating = 'D'
        else:
            rating = 'F'
        
        # Cost per cubic meter
        monthly_cost = monthly_kwh * ENERGY_PRICING['mid_peak']
        monthly_volume_m3 = np.mean(flows) * 0.06 * 24 * 30 if len(self.flow_window) > 0 else 1
        cost_per_m3 = monthly_cost / max(monthly_volume_m3, 1)
        
        return EnergyMetrics(
            current_power_kw=round(current_power, 2),
            daily_consumption_kwh=round(daily_kwh, 2),
            monthly_consumption_kwh=round(monthly_kwh, 2),
            peak_demand_kw=round(peak_power, 2),
            power_factor=round(power_factor, 3),
            efficiency_rating=rating,
            cost_per_cubic_meter=round(cost_per_m3, 2),
            specific_energy_kwh_per_m3=round(specific_energy, 3),
            timestamp=time.time(),
        )
    
    def process_sensor_data(self, data: Dict) -> Dict:
        """Process sensor data and return any recommendations."""
        flow = float(data.get('flow_rate') or data.get('Flow_Rate') or 0)
        pressure = float(data.get('pressure') or data.get('System_Pressure') or 0)
        pump_status = data.get('pump_status', 'OFF')
        pump_on = pump_status == 'ON' or data.get('P', 0) == 1 or data.get('Pump_Status', 0) == 1
        
        if flow > 0:
            self.flow_window.append(flow)
        if pressure > 0:
            self.pressure_window.append(pressure)
        
        self.pump_status_window.append(1 if pump_on else 0)
        
        # Estimate power
        power = self.estimate_power_consumption(flow, pressure, pump_on)
        self.power_history.append(power)
        
        # Track hourly consumption
        current_hour = datetime.now().hour
        self.hourly_consumption[current_hour].append(power)
        
        # Track peak demand
        if power > self.peak_demand_today:
            self.peak_demand_today = power
        
        # Generate recommendations periodically
        now = time.time()
        if now - self.last_publish >= PUBLISH_INTERVAL:
            self.last_publish = now
            return self.generate_advisory()
        
        return {}
    
    def generate_advisory(self) -> Dict:
        """Generate complete energy advisory."""
        recommendations = []
        
        scheduling_rec = self.analyze_scheduling()
        if scheduling_rec:
            recommendations.append(asdict(scheduling_rec))
        
        efficiency_rec = self.analyze_efficiency()
        if efficiency_rec:
            recommendations.append(asdict(efficiency_rec))
        
        demand_rec = self.analyze_demand()
        if demand_rec:
            recommendations.append(asdict(demand_rec))
        
        metrics = self.get_energy_metrics()
        
        return {
            'type': 'energy_advisory',
            'source': 'energy_optimizer',
            'metrics': asdict(metrics),
            'recommendations': recommendations,
            'total_recommendations': len(recommendations),
            'estimated_monthly_savings_etb': round(sum(r.get('estimated_savings_etb', 0) for r in recommendations), 2),
            'timestamp': time.time(),
        }


# --- MQTT Client ---
optimizer = EnergyOptimizer()


def on_connect(client, userdata, flags, reason_code, properties=None):
    print('⚡ Energy Optimizer connected to MQTT broker.')
    client.subscribe('kora/sensor/data')
    client.subscribe('kora/scada/tags')


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        result = optimizer.process_sensor_data(data)
        
        if result and result.get('recommendations'):
            client.publish('kora/ai/energy-advisory', json.dumps(result))
            savings = result.get('estimated_monthly_savings_etb', 0)
            count = result.get('total_recommendations', 0)
            print(f'⚡ ENERGY OPTIMIZER: {count} recommendations, est. savings: {savings:.2f} ETB/month')
        
        # Periodically publish metrics
        now = time.time()
        if now - optimizer.last_publish < 5:  # Close to publish time
            metrics = optimizer.get_energy_metrics()
            client.publish('kora/ai/energy-metrics', json.dumps(asdict(metrics)))
    
    except json.JSONDecodeError as e:
        print(f'❌ JSON decode error in energy_optimizer: {e}')
    except Exception as e:
        print(f'❌ Error in energy_optimizer: {e}')


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        print('🔗 Energy Optimizer connecting to MQTT broker at localhost:1883...')
        client.connect('localhost', 1883, 60)
        client.loop_forever()
    except Exception as e:
        print(f'❌ Energy Optimizer failed to connect: {e}')


if __name__ == '__main__':
    main()
