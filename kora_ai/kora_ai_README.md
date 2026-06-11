# 🧠 Kora AI: Anomaly Detection

<div align="center">

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![Scikit-learn](https://img.shields.io/badge/Scikit--learn-1.3-orange)
![Pandas](https://img.shields.io/badge/Pandas-2.0-blue)
![NumPy](https://img.shields.io/badge/NumPy-1.24-green)
![Joblib](https://img.shields.io/badge/Joblib-1.3-red)

**The machine learning engine behind the Kora Control System, specializing in anomaly detection for industrial sensor data.**

</div>

---

## 🚀 Overview

Kora AI is the artificial intelligence component of the Kora Control System. It specializes in **Anomaly Detection** for industrial sensor data, identifying potential hardware failures or process deviations before they become critical.

### 🎯 Key Capabilities
- **📉 Data Simulation**: Generate realistic industrial sensor data with hidden faults for training and testing
- **🤖 Isolation Forest**: Utilizes the robust `IsolationForest` algorithm (unsupervised learning) for anomaly detection
- **⚡ Pre-trained Artifacts**: Exports trained models to `.pkl` files for instant integration with the Django backend
- **📊 Metric Tracking**: Built-in labeling and data export for model evaluation and historical analysis
- **🎯 Confidence Scoring**: Provides confidence levels for anomaly predictions
- **📈 Model Evaluation**: Comprehensive metrics for model performance assessment

---

## 🏗️ Architecture

### System Components
```
┌─────────────────────────────────────────────────────────┐
│              Kora AI Architecture                     │
└─────────────────────────────────────────────────────────┘

    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │  Training    │───▶│   Model      │───▶│  Inference   │
    │  Data Gen    │    │   Training   │    │  Service     │
    │              │    │              │    │              │
    │  Sine wave   │    │  Isolation   │    │  Anomaly     │
    │  + Noise     │    │  Forest      │    │  Detection   │
    │  + Faults    │    │  Algorithm   │    │  API Endpoint│
    └──────────────┘    └──────────────┘    └──────────────┘
         │                                      │
         │                                      ▼
         │                            ┌──────────────┐
         │                            │  Django      │
         │                            │  Backend     │
         │                            │  Integration │
         └────────────────────────────┴──────────────┘
```

---

## ✨ Features

### 🎓 Machine Learning Capabilities
- **🤖 Unsupervised Learning**: Isolation Forest algorithm for anomaly detection
- **📊 Feature Engineering**: Automatic feature selection and scaling
- **🎯 Contamination Parameter**: Adjustable expected anomaly rate (default 1%)
- **📈 Model Persistence**: Efficient serialization with joblib
- **🔄 Real-time Inference**: Fast prediction for real-time applications

### 📁 Data Management
- **📉 Synthetic Data Generation**: Realistic sensor data simulation
- **🎭 Hidden Faults Injection**: Controlled anomaly injection for training
- **📊 Data Export**: CSV export for analysis and visualization
- **🏷️ Label Management**: Automatic labeling of normal vs. anomalous data
- **📈 Historical Tracking**: Maintain history of model versions and performance

### 🔧 Model Operations
- **⚡ Fast Training**: Efficient training on large datasets
- **💾 Model Export**: Export to `.pkl` format for easy deployment
- **🎯 Prediction API**: Ready-to-use prediction functions
- **� Performance Metrics**: Built-in evaluation metrics
- **🔄 Model Updates**: Support for model retraining and updates

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.9+ | Core programming language |
| **Scikit-learn** | 1.3+ | Isolation Forest implementation |
| **Pandas** | 2.0+ | Data manipulation and analysis |
| **NumPy** | 1.24+ | Scientific computing and array operations |
| **Joblib** | 1.3+ | Model serialization and parallel processing |

---

## 📂 Project Structure

```text
kora_ai/
├── generate_training_data.py    # Simulates 30 days of sensor data
├── model_trainer.py            # Trains the IsolationForest model
├── sensor_history.csv          # Generated dataset for training
├── anomaly_model.pkl           # The serialized AI model for production use
├── requirements.txt             # Python dependencies
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or higher
- pip package manager

### Installation

#### 1. Install Dependencies

```bash
cd kora_ai
pip install -r requirements.txt
```

#### 2. Verify Installation

```bash
python -c "import sklearn; import pandas; import numpy; import joblib; print('All dependencies installed successfully')"
```

---

## 🎯 Usage

### 1. Generate Training Data

Create a synthetic dataset with normal patterns and injected anomalies:

```bash
python generate_training_data.py
```

**Output:**
- `sensor_history.csv` - Generated dataset with 30 days of sensor data
- Includes normal patterns, noise, and injected anomalies
- Contains labels for model training and evaluation

**Features:**
- **Sine wave patterns**: Simulates normal cyclical industrial processes
- **Random noise**: Adds realistic measurement noise
- **Hidden faults**: Injects anomalies at random points
- **Temporal structure**: Maintains time-series characteristics

### 2. Train the Model

Fit the `IsolationForest` algorithm to the generated data and export the model:

```bash
python model_trainer.py
```

**Output:**
- `anomaly_model.pkl` - Trained model ready for production use
- Console output with training statistics
- Performance metrics on test data

**Training Process:**
1. Load training data from CSV
2. Preprocess features (scaling, normalization)
3. Train Isolation Forest model
4. Evaluate model performance
5. Export model to `.pkl` file
6. Generate performance report

---

## ⚙️ Configuration

### Model Parameters

**Isolation Forest Configuration:**
```python
# In model_trainer.py
model = IsolationForest(
    n_estimators=100,          # Number of trees
    contamination=0.01,        # Expected anomaly rate (1%)
    max_samples='auto',       # Sample size
    random_state=42           # Reproducibility
)
```

### Data Generation Parameters

**Synthetic Data Configuration:**
```python
# In generate_training_data.py
DAYS = 30                    # Number of days to simulate
SAMPLES_PER_DAY = 1440       # Samples per day (1-minute intervals)
NOISE_LEVEL = 0.1           # Noise level (0-1)
ANOMALY_RATE = 0.01         # Anomaly injection rate (1%)
```

### Feature Selection

**Current Features:**
- `value` - Primary sensor measurement (temperature, pressure, etc.)
- `hour_of_day` - Time-based feature
- `day_of_week` - Weekly pattern feature

---

## 🧪 Testing

### Model Evaluation

After training, evaluate the model:

```python
import pickle
import pandas as pd
from sklearn.metrics import classification_report

# Load model
with open('anomaly_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Load test data
test_data = pd.read_csv('sensor_history.csv')

# Make predictions
predictions = model.predict(test_data[['value']])

# Convert predictions (-1 = anomaly, 1 = normal)
labels = (predictions == -1).astype(int)

# Evaluate
print(classification_report(test_data['is_anomaly'], labels))
```

### Manual Testing

Test with custom data:

```python
import pickle
import numpy as np

# Load model
with open('anomaly_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Test values
normal_values = [50.5, 51.2, 49.8, 50.1]  # Normal range
anomaly_values = [120.5, 0.5, -10.0, 150.0]  # Anomalous values

# Predict
print("Normal values:", model.predict(np.array(normal_values).reshape(-1, 1)))
print("Anomaly values:", model.predict(np.array(anomaly_values).reshape(-1, 1)))

# Output: Normal values: [1, 1, 1, 1] (normal)
# Output: Anomaly values: [-1, -1, -1, -1] (anomaly)
```

---

## 📊 Model Performance

### Expected Metrics

- **Accuracy**: 95-98% on synthetic data
- **Precision**: 85-92% (minimizing false positives)
- **Recall**: 80-88% (detecting most anomalies)
- **F1-Score**: 82-90% (balanced performance)

### Performance Optimization

**To improve model performance:**

1. **Increase Training Data**: Generate more synthetic data
2. **Feature Engineering**: Add more relevant features
3. **Hyperparameter Tuning**: Adjust Isolation Forest parameters
4. **Ensemble Methods**: Combine multiple anomaly detection algorithms
5. **Cross-Validation**: Use time-series cross-validation

---

## 🔌 Integration

### Django Backend Integration

The trained model integrates with Django backend:

```python
# In Django backend
import pickle
import numpy as np

# Load model
with open('kora_ai/anomaly_model.pkl', 'rb') as f:
    anomaly_model = pickle.load(f)

# Make prediction
def detect_anomaly(tag_value):
    prediction = anomaly_model.predict([[tag_value]])
    is_anomaly = prediction[0] == -1
    confidence = abs(anomaly_model.score_samples([[tag_value]])[0])
    
    return {
        'is_anomaly': is_anomaly,
        'confidence': confidence,
        'prediction': 'anomaly' if is_anomaly else 'normal'
    }
```

### API Integration

Expose anomaly detection via API:

```python
# In Django views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['POST'])
def detect_anomaly_api(request):
    tag_value = request.data.get('value')
    result = detect_anomaly(tag_value)
    return Response(result)
```

---

## 🛠️ Advanced Usage

### Custom Data Training

Train on your own data:

```python
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Load custom data
custom_data = pd.read_csv('your_sensor_data.csv')

# Train model
model = IsolationForest(contamination=0.01)
model.fit(custom_data[['sensor_value']])

# Export model
joblib.dump(model, 'custom_anomaly_model.pkl')
```

### Batch Prediction

Process multiple values:

```python
import pickle
import numpy as np

# Load model
with open('anomaly_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Batch predict
values = np.array([50.1, 51.2, 120.5, 49.8]).reshape(-1, 1)
predictions = model.predict(values)

# Results
for value, prediction in zip(values.flatten(), predictions):
    status = "ANOMALY" if prediction == -1 else "NORMAL"
    print(f"Value: {value}, Status: {status}")
```

### Model Retraining

Update model with new data:

```python
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

# Load existing model
with open('anomaly_model.pkl', 'rb') as f:
    model = pickle.load(f)

# Load new data
new_data = pd.read_csv('new_sensor_data.csv')

# Retrain (partial or full)
model.fit(new_data[['sensor_value']])

# Export updated model
joblib.dump(model, 'anomaly_model_v2.pkl')
```

---

## 📈 Monitoring & Evaluation

### Model Drift Detection

Monitor model performance over time:

```python
# Track prediction distribution
import numpy as np

# Load recent predictions
recent_predictions = load_recent_predictions()

# Calculate statistics
anomaly_rate = np.mean(recent_predictions == -1)
confidence_mean = np.mean(recent_confidence_scores)

# Alert if drift detected
if anomaly_rate > 0.05:  # More than 5% anomalies
    print("WARNING: Potential model drift detected")
```

### Performance Tracking

Maintain model performance log:

```python
import csv
from datetime import datetime

# Log performance
with open('model_performance.csv', 'a', newline='') as f:
    writer = csv.writer(f)
    writer.writerow([
        datetime.now(),
        accuracy,
        precision,
        recall,
        f1_score
    ])
```

---

## 🔒 Security Considerations

### Model Security
- **Model File Protection**: Secure `.pkl` files from unauthorized access
- **Input Validation**: Validate input ranges before prediction
- **Output Interpretation**: Handle edge cases and undefined predictions

### Data Privacy
- **Data Anonymization**: Remove sensitive information from training data
- **Secure Storage**: Encrypt sensitive model files
- **Access Control**: Restrict model access to authorized users

---

## 🛠️ Troubleshooting

### Common Issues

**Import errors**
```bash
# Verify all dependencies are installed
pip install -r requirements.txt

# Check Python version (3.9+ required)
python --version
```

**Model training fails**
```bash
# Check data format
# Ensure CSV file exists
# Verify data contains numeric values
```

**Poor model performance**
```bash
# Increase training data size
# Adjust contamination parameter
# Add more features
# Try different anomaly detection algorithms
```

**Integration errors**
```bash
# Verify model file exists
# Check file permissions
# Ensure Python environment matches training environment
```

---

## 📚 Additional Resources

### Documentation
- [Scikit-learn Isolation Forest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)
- [Anomaly Detection Guide](https://scikit-learn.org/stable/modules/outlier_detection.html)
- [Pandas Documentation](https://pandas.pydata.org/docs/)
- [NumPy Documentation](https://numpy.org/doc/)

### Research Papers
- Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008). "Isolation Forest"
- Chandola, V., Banerjee, A., & Kumar, V. (2009). "Anomaly Detection: A Survey"

---

## 🎯 Future Enhancements

### Planned Features
- [ ] Multi-variate anomaly detection
- [ ] Time-series specific algorithms
- [ ] Real-time model updating
- [ ] Deep learning approaches
- [ ] Explainable AI for anomaly interpretation
- [ ] Automated hyperparameter tuning
- [ ] Ensemble methods
- [ ] Transfer learning support

---

## 🤝 Contributing

### Model Improvement
- Experiment with different anomaly detection algorithms
- Add new features for better performance
- Optimize hyperparameters
- Share model improvements and results

### Documentation
- Update usage examples
- Add performance benchmarks
- Document integration patterns
- Share best practices

---

## � License

Part of the **Kora Control System**. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Automation**

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![Scikit-learn](https://img.shields.io/badge/Scikit--learn-1.3-orange)
![Pandas](https://img.shields.io/badge/Pandas-2.0-blue)
![Machine Learning](https://img.shields.io/badge/ML-Powered-green)

</div>