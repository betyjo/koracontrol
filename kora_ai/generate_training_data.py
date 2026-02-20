import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_sensor_data(days=30):
    np.random.seed(42)
    start_time = datetime.now() - timedelta(days=days)
    data = []

    for i in range(days * 24 * 60):  # Every minute for 30 days
        timestamp = start_time + timedelta(minutes=i)
        
        # NORMAL PATTERN: Sine wave (daily temp cycle) + noise
        hour = timestamp.hour
        base_temp = 70 + 10 * np.sin(hour * np.pi / 12) 
        temp = base_temp + np.random.normal(0, 2)
        
        # INJECT ANOMALIES (Hidden Faults)
        is_anomaly = 0
        if np.random.random() > 0.999: # 0.1% chance of a spike
            temp += np.random.uniform(30, 50)
            is_anomaly = 1
            
        data.append([timestamp, temp, is_anomaly])

    df = pd.DataFrame(data, columns=['timestamp', 'value', 'label'])
    df.to_csv('sensor_history.csv', index=False)
    print("✅ Training dataset 'sensor_history.csv' created.")

if __name__ == "__main__":
    generate_sensor_data()
