import argparse
import json
import random
import threading
import paho.mqtt.client as mqtt
import time
import math

try:
    import serial
    HAS_SERIAL = True
except ImportError:
    HAS_SERIAL = False

# --- Configuration ---
SERIAL_PORT = 'COM8'
BAUD_RATE = 9600

MQTT_BROKER = "localhost"
MQTT_TOPIC = "kora/sensor/data"
MQTT_TAGS_TOPIC = "kora/scada/tags"
# ---------------------

parser = argparse.ArgumentParser(description="Serial to MQTT Bridge for Kora SCADA")
parser.add_argument("--sim", action="store_true", help="Force simulation mode (no serial port needed)")
parser.add_argument("--cascade", action="store_true", help="Enable multi-tank cascade simulation")
args = parser.parse_args()


# --- PID Controller Class ---
class PIDController:
    """Simple PID controller for simulation."""
    
    def __init__(self, kp=2.0, ki=0.5, kd=1.0, setpoint=50.0):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.setpoint = setpoint
        self.integral = 0.0
        self.prev_error = 0.0
        self.last_time = time.time()
    
    def compute(self, current_value):
        now = time.time()
        dt = now - self.last_time
        if dt <= 0:
            dt = 0.01
        self.last_time = now
        
        error = self.setpoint - current_value
        
        # Proportional
        p_term = self.kp * error
        
        # Integral (with anti-windup)
        self.integral += error * dt
        self.integral = max(-100, min(100, self.integral))
        i_term = self.ki * self.integral
        
        # Derivative
        derivative = (error - self.prev_error) / dt if dt > 0 else 0
        d_term = self.kd * derivative
        self.prev_error = error
        
        output = p_term + i_term + d_term
        return max(-100, min(100, output))


# --- Multi-Tank Cascade Simulation ---
class TankSimulation:
    """Simulates a single water tank with level, inflow, outflow."""
    
    def __init__(self, name, capacity=100.0, initial_level=50.0):
        self.name = name
        self.capacity = capacity
        self.level = initial_level  # percentage
        self.inflow_rate = 0.0  # L/min
        self.outflow_rate = 0.0  # L/min
        self.temperature = 25.0  # °C
        self.pressure = 3.0  # bar
        self.ph = 7.0
        self.turbidity = 10  # NTU
        self.pump_on = False
        self.inlet_valve = False
        self.outlet_valve = False
    
    def update(self, dt_seconds):
        """Update tank state based on flows."""
        # Net flow affects level
        net_flow = self.inflow_rate - self.outflow_rate  # L/min
        volume_change = (net_flow * dt_seconds / 60.0) / self.capacity * 100
        self.level = max(0, min(100, self.level + volume_change))
        
        # Simulate pressure based on level (hydrostatic)
        self.pressure = 1.0 + (self.level / 100) * 4.0 + random.uniform(-0.2, 0.2)
        
        # Temperature slowly drifts
        self.temperature += random.uniform(-0.3, 0.3)
        self.temperature = max(15, min(45, self.temperature))
        
        # pH based on turbidity
        self.ph = 7.0 + random.uniform(-0.5, 0.5) + (self.turbidity - 10) * 0.01
        
        # Turbidity influenced by flow
        base_turbidity = 10 + abs(net_flow) * 0.1
        self.turbidity = max(0, min(100, int(base_turbidity + random.uniform(-5, 5))))
    
    def get_data(self):
        return {
            f"{self.name}_level": round(self.level, 1),
            f"{self.name}_inflow": round(self.inflow_rate, 1),
            f"{self.name}_outflow": round(self.outflow_rate, 1),
            f"{self.name}_pressure": round(self.pressure, 2),
            f"{self.name}_temperature": round(self.temperature, 1),
            f"{self.name}_ph": round(self.ph, 2),
            f"{self.name}_turbidity": self.turbidity,
            f"{self.name}_pump": "ON" if self.pump_on else "OFF",
            f"{self.name}_inlet_valve": "OPEN" if self.inlet_valve else "CLOSED",
            f"{self.name}_outlet_valve": "OPEN" if self.outlet_valve else "CLOSED",
        }


class CascadeSimulation:
    """Multi-tank cascade system simulation."""
    
    def __init__(self):
        self.tank_a = TankSimulation("tank_a", capacity=100.0, initial_level=50.0)
        self.tank_b = TankSimulation("tank_b", capacity=80.0, initial_level=30.0)
        self.tank_c = TankSimulation("tank_c", capacity=60.0, initial_level=20.0)
        
        # PID controllers for each tank
        self.pid_a = PIDController(kp=1.5, ki=0.3, kd=0.8, setpoint=70.0)
        self.pid_b = PIDController(kp=2.0, ki=0.4, kd=1.0, setpoint=50.0)
        self.pid_c = PIDController(kp=2.5, ki=0.5, kd=1.2, setpoint=40.0)
        
        # Main flow parameters
        self.main_flow_rate = 50.0  # L/min base flow
    
    def update(self):
        """Update entire cascade system."""
        dt = 1.0  # 1 second updates
        
        # Tank A: Primary intake tank
        pid_output_a = self.pid_a.compute(self.tank_a.level)
        self.tank_a.inflow_rate = self.main_flow_rate + random.uniform(-5, 5)
        self.tank_a.inlet_valve = pid_output_a > 10
        self.tank_a.pump_on = self.tank_a.level < 30
        self.tank_a.outflow_rate = max(0, pid_output_a) * 0.5
        self.tank_a.update(dt)
        
        # Tank B: Receives from Tank A overflow/outflow
        pid_output_b = self.pid_b.compute(self.tank_b.level)
        self.tank_b.inflow_rate = self.tank_a.outflow_rate * 0.8  # 80% transfer efficiency
        self.tank_b.inlet_valve = self.tank_a.outlet_valve
        self.tank_b.pump_on = self.tank_b.level < 25
        self.tank_b.outflow_rate = max(0, pid_output_b) * 0.4
        self.tank_b.update(dt)
        
        # Tank C: Final treatment tank
        pid_output_c = self.pid_c.compute(self.tank_c.level)
        self.tank_c.inflow_rate = self.tank_b.outflow_rate * 0.9  # 90% transfer
        self.tank_c.inlet_valve = self.tank_b.outlet_valve
        self.tank_c.pump_on = self.tank_c.level < 20
        self.tank_c.outflow_rate = max(0, pid_output_c) * 0.3
        self.tank_c.update(dt)
        
        # Update outlet valves based on downstream needs
        self.tank_a.outlet_valve = self.tank_b.level < 60
        self.tank_b.outlet_valve = self.tank_c.level < 55
    
    def get_all_data(self):
        data = {}
        data.update(self.tank_a.get_data())
        data.update(self.tank_b.get_data())
        data.update(self.tank_c.get_data())
        # Add combined metrics
        data["flow_rate"] = round(self.main_flow_rate + random.uniform(-5, 5), 1)
        data["system_pressure"] = round(
            (self.tank_a.pressure + self.tank_b.pressure + self.tank_c.pressure) / 3, 2
        )
        data["temperature"] = round(
            (self.tank_a.temperature + self.tank_b.temperature + self.tank_c.temperature) / 3, 1
        )
        data["total_volume"] = round(
            self.tank_a.level * self.tank_a.capacity / 100 +
            self.tank_b.level * self.tank_b.capacity / 100 +
            self.tank_c.level * self.tank_c.capacity / 100, 1
        )
        # Cascade-level valve & pump aggregates
        data["inlet_valve"] = "OPEN" if self.tank_a.inlet_valve else "CLOSED"
        data["outlet_valve"] = "OPEN" if self.tank_c.outlet_valve else "CLOSED"
        data["bypass_valve"] = "CLOSED"  # no bypass in the simulation
        data["pump_status"] = "ON" if self.tank_a.pump_on else "OFF"
        return data


def generate_simulated_data():
    """Generate realistic simulated sensor data for single-tank mode."""
    base_level = 50 + 20 * math.sin(time.time() / 60)  # Slow oscillation
    return {
        "tank_level": round(base_level + random.uniform(-5, 5), 1),
        "pump_status": "ON" if base_level < 40 else "OFF",
        "flow_rate": round(random.randint(30, 60) + random.uniform(-5, 5), 1),
        "pressure": round(random.uniform(2.0, 5.0) + random.uniform(-0.3, 0.3), 2),
        "temperature": round(25 + random.uniform(-3, 3), 1),
        "ph_level": round(7.0 + random.uniform(-0.5, 0.5), 2),
        "turbidity": random.randint(5, 25),
    }


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"Connected to MQTT Broker with result code {reason_code}")


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect

try:
    client.connect(MQTT_BROKER, 1883, 60)
    client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT Broker: {e}")
    exit(1)

# --- Try serial port, fall back to simulation mode ---
use_serial = False
ser = None
use_cascade = args.cascade

if use_cascade:
    print("🌊 CASCADE MODE: Multi-tank simulation enabled.")
    cascade = CascadeSimulation()
elif HAS_SERIAL and not args.sim:
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"Listening on {SERIAL_PORT}...")
        use_serial = True
    except Exception as e:
        print(f"Could not open serial port: {e}")
        print(f"Falling back to SIMULATION MODE (generating fake sensor data)...")
else:
    if args.sim:
        print("Simulation mode forced via --sim flag.")
    else:
        print("pyserial not installed. Running in SIMULATION MODE.")

if not use_serial and not use_cascade:
    print("[SIMULATION] Generating sensor data every 2 seconds...")

try:
    while True:
        if use_serial:
            # --- Real serial mode ---
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                try:
                    data = json.loads(line)
                    print(f"Received from Proteus: {data}")

                    if "L_A" in data:
                        # Cascade payload from upgraded firmware
                        level_a = data.get("L_A", 0)
                        level_b = data.get("L_B", 0)
                        level_c = data.get("L_C", 0)
                        
                        mqtt_payload = {
                            "tank_a_level": level_a,
                            "tank_b_level": level_b,
                            "tank_c_level": level_c,
                            "tank_a_pump": "ON" if data.get("P_A", 0) == 1 else "OFF",
                            "tank_b_pump": "ON" if data.get("P_B", 0) == 1 else "OFF",
                            "tank_c_pump": "ON" if data.get("P_C", 0) == 1 else "OFF",
                            "tank_a_temperature": data.get("T_A", 25.0),
                            "tank_b_temperature": data.get("T_B", 25.0),
                            "tank_c_temperature": data.get("T_C", 25.0),
                            "flow_rate": data.get("F", 0),
                            "system_pressure": data.get("Pr", 0),
                            "total_volume": round(level_a * 1.0 + level_b * 0.8 + level_c * 0.6, 1),
                            "pump_vibration": data.get("Vib", 0.0),
                            "pump_vfd_speed": data.get("VFD", 0.0),
                            "inlet_valve": "OPEN" if data.get("IV", 0) else "CLOSED",
                            "outlet_valve": "OPEN" if data.get("OV", 0) else "CLOSED",
                            "bypass_valve": "OPEN" if data.get("BV", 0) else "CLOSED",
                            "pid_output": data.get("PID", 0),
                        }
                    else:
                        # Legacy single-tank payload
                        mqtt_payload = {
                            "tank_level": data.get("L", 0),
                            "pump_status": "ON" if data.get("P", 0) == 1 else "OFF",
                            "flow_rate": data.get("F", 0),
                            "pressure": data.get("Pr", 0),
                            "temperature": data.get("T", 25.0),
                            "ph_level": data.get("pH", 7.0),
                            "turbidity": data.get("Tu", 10),
                            "inlet_valve": "OPEN" if data.get("IV", 0) else "CLOSED",
                            "outlet_valve": "OPEN" if data.get("OV", 0) else "CLOSED",
                            "bypass_valve": "OPEN" if data.get("BV", 0) else "CLOSED",
                            "pid_output": data.get("PID", 0),
                        }

                    client.publish(MQTT_TOPIC, json.dumps(mqtt_payload))
                    client.publish(MQTT_TAGS_TOPIC, json.dumps(mqtt_payload))
                    print(f"Published to MQTT: {mqtt_payload}")

                except json.JSONDecodeError:
                    if line:
                        print(f"Serial: {line}")
            time.sleep(0.01)
        
        elif use_cascade:
            # --- Cascade simulation mode ---
            cascade.update()
            data = cascade.get_all_data()
            print(f"[CASCADE] Tank A: {data.get('tank_a_level', 0):.1f}% | "
                  f"Tank B: {data.get('tank_b_level', 0):.1f}% | "
                  f"Tank C: {data.get('tank_c_level', 0):.1f}%")
            
            client.publish(MQTT_TOPIC, json.dumps(data))
            client.publish(MQTT_TAGS_TOPIC, json.dumps(data))
            time.sleep(1)
        
        else:
            # --- Single tank simulation mode ---
            data = generate_simulated_data()
            print(f"[SIM] Generated sensor data: {data}")

            client.publish(MQTT_TOPIC, json.dumps(data))
            client.publish(MQTT_TAGS_TOPIC, json.dumps(data))
            print(f"[SIM] Published to MQTT: {data}")

            time.sleep(2)

except KeyboardInterrupt:
    print("\nBridge stopped.")
finally:
    if ser and ser.is_open:
        ser.close()
    client.loop_stop()
    client.disconnect()
