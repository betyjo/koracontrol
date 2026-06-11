# 🏭 Kora Control System

<div align="center">

![Kora Control](https://img.shields.io/badge/Kora-Control-Industrial%20Automation-blue)
![Integration Status](https://img.shields.io/badge/Integration-Complete-success)
![Components](https://img.shields.io/badge/Components-7-informational)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)

**A comprehensive industrial control system with real-time monitoring, SCADA capabilities, AI-powered anomaly detection, and seamless multi-component integration.**

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Integration](#-integration)

</div>

---

## 🌟 Features

### 🔧 Core Capabilities
- **🎛️ SCADA HMI**: JavaFX-based desktop interface for industrial operators
- **🌐 Web Dashboard**: Next.js frontend for customer and operator access
- **⚙️ Industrial Engine**: Python-based processing engine with MQTT integration
- **🤖 AI Analytics**: Machine learning anomaly detection for predictive maintenance
- **📊 Real-time Monitoring**: 2-second scan cycle for high-frequency data logging
- **🚨 Alarm Management**: Comprehensive alarm system with real-time notifications

### 🔄 Integration Features
- **📡 MQTT Communication**: Standardized pub/sub messaging across all components
- **🔌 REST API**: Django backend with comprehensive API endpoints
- **🔐 Authentication**: JWT-based security with role-based access control
- **💾 Multi-Database**: Support for PostgreSQL and SQLite
- **🔗 Serial Integration**: Hardware simulation via Proteus and Arduino

### 🎯 Advanced Features
- **💳 Billing & Payments**: Chapa integration for Ethiopian payment processing
- **🎫 Customer Support**: Complaint management with priority tracking
- **📈 Analytics**: Usage statistics, cost analysis, and trend visualization
- **👤 Biometric Auth**: Face recognition for secure access
- **🚀 Emergency Systems**: One-click emergency stop and safety controls

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    KORA CONTROL SYSTEM                      │
└─────────────────────────────────────────────────────────────┘

                        ┌──────────────┐
                        │ MQTT Broker  │
                        │ localhost:1883│
                        └──────┬───────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼────────┐    ┌──────▼──────┐
│   Simulation   │    │   Kora Engine   │    │   Backend   │
│  (Proteus)     │    │  (Python)       │    │  (Django)   │
│               │    │                 │    │             │
│ Arduino Code  │───▶│ MQTT Subscribe │───▶│ REST API    │
│ Serial Bridge │    │ Command Handler│    │ MQTT Publish│
└───────────────┘    └─────────────────┘    └──────┬──────┘
        │                      │                      │
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼────────┐    ┌──────▼──────┐
│  Desktop HMI   │    │   Frontend      │    │  Kora AI    │
│  (JavaFX)      │    │   (Next.js)     │    │  (Python)    │
│               │    │                 │    │             │
│ MQTT Client   │    │ REST Client     │    │ Analysis    │
│ Control UI    │    │ Dashboard       │    │ Service     │
└───────────────┘    └─────────────────┘    └─────────────┘
```

---

## 📦 Components

### 🖥️ Kora Backend (Django)
**Central API server and database management**
- 🗄️ Database models and ORM
- 🔐 JWT authentication and authorization
- 📡 REST API endpoints
- 📊 MQTT integration service
- 🚨 Alarm management system
- 💳 Billing and payment processing

**Tech Stack:** Django 6.0, DRF, PostgreSQL, paho-mqtt

### 🌐 Kora Frontend (Next.js)
**Web-based dashboard for users and operators**
- 🎨 Modern UI with Tailwind CSS
- 📊 Real-time data visualization
- 👤 User authentication interface
- 💰 Billing and payment UI
- 🎫 Customer support center
- 🤖 AI chat interface

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts

### 🖥️ Kora Desktop (JavaFX)
**Professional SCADA HMI for industrial operators**
- 📊 Real-time process monitoring
- 🎛️ Equipment control interface
- 🚨 Emergency stop functionality
- 📈 Trend charts and analytics
- 🔔 Real-time alarm notifications
- 🎨 Industrial-grade UI design

**Tech Stack:** Java 21, JavaFX 21, Maven, paho-mqtt, Gson

### ⚙️ Kora Engine (Python)
**Industrial data processing and control engine**
- 🔄 2-second scan cycle
- 📡 MQTT communication
- 🎯 Command processing
- 📊 Data logging to backend
- 🚨 Alarm threshold monitoring
- 🔗 Hardware abstraction layer

**Tech Stack:** Python 3.8+, paho-mqtt, requests

### 🧪 Kora Simulation (Proteus + Arduino)
**Hardware simulation environment**
- 🔌 Virtual serial port communication
- 📡 Serial-to-MQTT bridge
- 🎮 Arduino code integration
- 💻 Proteus simulation support
- 📊 Realistic sensor data generation

**Tech Stack:** Arduino C++, Python, PySerial, paho-mqtt

### 🤖 Kora AI (Python)
**Machine learning anomaly detection**
- 📈 Isolation Forest algorithm
- 🎯 Predictive maintenance
- 📊 Sensor pattern analysis
- 💾 Model training pipeline
- 🔍 Confidence scoring

**Tech Stack:** Python 3.9+, scikit-learn, pandas, numpy, joblib

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ (for backend, engine, AI)
- Node.js 18+ (for frontend)
- Java 21+ (for desktop)
- Maven 3.8+ (for desktop)
- MQTT Broker (Mosquitto or alternative)

### Installation Steps

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd koracontrol
```

#### 2. Backend Setup
```bash
cd kora_backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
**Access:** http://127.0.0.1:8000

#### 3. Frontend Setup
```bash
cd kora_frontend
npm install
npm run dev
```
**Access:** http://localhost:3000

#### 4. Desktop Setup
```bash
cd kora_desktop
mvn compile
mvn javafx:run
```

#### 5. Engine Setup
```bash
cd kora_engine
# Create .env file with backend credentials
# Reference kora_engine/SETUP.md
python engine.py
```

#### 6. AI Model Training
```bash
cd kora_ai
pip install -r requirements.txt
python generate_training_data.py
python model_trainer.py
```

#### 7. MQTT Broker Setup
```bash
# Option 1: Install Mosquitto
# Download from https://mosquitto.org/download/

# Option 2: Use Python alternative
python mqtt_broker.py
```

---

## 📚 Documentation

### 📖 Component Documentation
- [Backend Documentation](kora_backend/README.md) - Django API and database
- [Frontend Documentation](kora_frontend/README.md) - Next.js dashboard
- [Desktop Documentation](kora_desktop/README.md) - JavaFX HMI
- [Engine Documentation](kora_engine/SETUP.md) - Python processing engine
- [AI Documentation](kora_ai/README.md) - Machine learning service
- [Simulation Documentation](kora_simulation/) - Hardware simulation

### 🔧 Integration Documentation
- [Integration Summary](INTEGRATION_SUMMARY.md) - Complete integration overview
- [Integration Testing Guide](INTEGRATION_TESTING_GUIDE.md) - Testing procedures
- [MQTT Topics Reference](MQTT_TOPICS.md) - Topic standardization
- [Serial Communication Test](test_serial_communication.py) - Automated testing

### 🔗 API Documentation
- **Swagger UI:** http://127.0.0.1:8000/api/docs/
- **OpenAPI Schema:** http://127.0.0.1:8000/api/schema/
- **Django Admin:** http://127.0.0.1:8000/admin/

---

## 🔌 Integration Status

### ✅ Completed Integrations
- ✅ MQTT topic standardization across all components
- ✅ Backend-to-MQTT real-time publishing
- ✅ Command processing and control flow
- ✅ Alarm synchronization system
- ✅ Serial communication for simulation
- ✅ JWT authentication across components

### 🔄 Communication Flow
```
📡 Data Flow: Simulation → MQTT → Engine → Backend → Frontend/Desktop
🎮 Control Flow: Desktop → MQTT → Engine → Hardware/Simulation
🚨 Alarm Flow: Engine → MQTT → Backend → All Components
```

### 📊 Test Results
```
Serial Port Communication: ✅ PASS
MQTT Broker Connectivity: ✅ PASS
Data Format Validation: ✅ PASS
Total: 3/3 tests passed
```

---

## 🛠️ Configuration

### Environment Variables

#### Backend (.env)
```env
SECRET_KEY=your-secret-key
DEBUG=True
DB_ENGINE=sqlite
FRONTEND_BASE_URL=http://localhost:3000
CHAPA_SECRET_KEY=your-chapa-key
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_ENABLED=true
```

#### Engine (.env)
```env
KORA_ENGINE_USERNAME=admin
KORA_ENGINE_PASSWORD=admin123
KORA_ENGINE_TOKEN=optional-token
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/
```

---

## 🚨 Troubleshooting

### Common Issues

**MQTT Connection Failed**
```bash
# Check if broker is running
netstat -an | findstr 1883

# Start Python alternative broker
python mqtt_broker.py
```

**Engine Authentication Failed**
```bash
# Verify .env file exists in kora_engine/
# Check credentials match Django admin user
# Ensure user has proper permissions
```

**Serial Port Not Found**
```bash
# Verify virtual serial port configuration
# Check Proteus virtual terminal settings
# Test with: python test_serial_communication.py
```

**Frontend Cannot Connect to Backend**
```bash
# Verify CORS settings in Django settings.py
# Check backend is running on correct port
# Ensure API URL is correct in frontend environment
```

---

## 📈 Development Roadmap

### 🎯 Phase 1: Core Integration (Current)
- ✅ Component standardization
- ✅ MQTT integration
- ✅ Command processing
- ✅ Real-time data flow

### 🔮 Phase 2: Enhanced Features
- ⏳ Advanced analytics dashboard
- ⏳ Mobile application
- ⏳ Cloud deployment
- ⏳ Advanced AI models

### 🚀 Phase 3: Production Ready
- ⏳ Security hardening
- ⏳ Performance optimization
- ⏳ Comprehensive testing
- ⏳ Documentation completion

---

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `python test_serial_communication.py`
5. Submit a pull request

### Code Style
- Python: PEP 8
- JavaScript: ESLint
- Java: Google Java Style
- Django: Django Style Guide

---

## 📄 License

Part of the **Kora Control System**. All rights reserved.

---

## 👥 Support

### 📧 Contact
- **Issues:** GitHub Issues
- **Documentation:** See `/docs` directory
- **Testing:** Run `python test_serial_communication.py`

### 📚 Resources
- [Django Documentation](https://docs.djangoproject.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [JavaFX Documentation](https://openjfx.io/)
- [MQTT Protocol](https://mqtt.org/)

---

<div align="center">

**Built with ❤️ for Industrial Automation**

![Python](https://img.shields.io/badge/Python-3.8+-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Java](https://img.shields.io/badge/Java-21-orange)
![Django](https://img.shields.io/badge/Django-6.0-darkgreen)

</div>