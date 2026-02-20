# 🧠 Kora AI: Anomaly Detection

Kora AI is the machine learning engine behind the Kora Control System. It specializes in **Anomaly Detection** for industrial sensor data, identifying potential hardware failures or process deviations before they become critical.

---

## 🚀 Key Features

- **📉 Data Simulation:** Generate realistic industrial sensor data with hidden faults for training and testing.
- **🤖 Isolation Forest:** Utilizes the robust `IsolationForest` algorithm (unsupervised learning) for anomaly detection.
- **⚡ Pre-trained Artifacts:** Exports trained models to `.pkl` files for instant integration with the Django backend.
- **📊 Metric Tracking:** Built-in labeling and data export for model evaluation and historical analysis.

---

## 🛠️ Tech Stack

- **🐍 Python 3.9+:** The core programming language for AI development.
- **🧪 Scikit-learn:** For implementing the `IsolationForest` model.
- **🐼 Pandas:** High-performance data manipulation and analysis.
- **🔢 NumPy:** Scientific computing and sensor pattern simulation.
- **📦 Joblib:** Efficient serialization of trained machine learning models.

---

## 📂 Project Structure

```text
kora_ai
├── generate_training_data.py # Simulates 30 days of sensor data (sinewave + noise)
├── model_trainer.py          # Trains the IsolationForest model on sensor history
├── sensor_history.csv        # Generated dataset for training
└── anomaly_model.pkl        # The serialized AI model for production use
```

---

## 🏁 How to Use

### 1. Generate Training Data
Create a synthetic dataset with normal patterns and injected anomalies:
```bash
python generate_training_data.py
```

### 2. Train the Model
Fit the `IsolationForest` algorithm to the generated data and export the model:
```bash
python model_trainer.py
```

---

## ⚙️ Model Configuration
- **Contamination:** Set to `0.01` (1% expected anomalies).
- **Features:** Currently trains on `value` (e.g., Temperature/Pressure).
- **Target:** Exports to `anomaly_model.pkl`.

---

## 📜 License
Part of the **Kora Control System**. All rights reserved.
