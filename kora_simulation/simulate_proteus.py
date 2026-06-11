import serial
import json
import time
import random

SERIAL_PORT = 'COM7'  # Send to COM7 (com0com pair: COM7 <-> COM8)
BAUD_RATE = 9600

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    print(f"Simulating Proteus on {SERIAL_PORT}...")
    print("Sending test data every 2 seconds...")
    
    while True:
        # Simulate sensor data
        data = {
            "L": random.randint(50, 100),  # Tank level
            "P": random.choice([0, 1]),    # Pump status  
            "F": random.randint(30, 60),   # Flow rate
            "Pr": random.randint(1, 5)     # Pressure
        }
        
        json_str = json.dumps(data)
        ser.write(json_str.encode('utf-8'))
        print(f"Sent to COM1: {json_str}")
        
        time.sleep(2)
        
except KeyboardInterrupt:
    print("\nSimulation stopped")
    ser.close()
except Exception as e:
    print(f"Error: {e}")