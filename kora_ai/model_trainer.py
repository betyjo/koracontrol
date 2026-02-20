import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

def train_anomaly_model():
    # 1. Load data
    df = pd.read_csv('sensor_history.csv')
    X = df[['value']] # Training on the 'value' column

    # 2. Initialize Model (Contamination = expected % of anomalies)
    model = IsolationForest(contamination=0.01, random_state=42)
    
    # 3. Train
    print("🧠 Training AI Model...")
    model.fit(X)

    # 4. Save the model so the Django Backend can use it
    joblib.dump(model, 'anomaly_model.pkl')
    print("💾 Model saved as 'anomaly_model.pkl'")

if __name__ == "__main__":
    train_anomaly_model()
