# 🏭 Kora Control - Industrial Control System Backend

<div align="center">

![Django](https://img.shields.io/badge/Django-6.0-green?style=for-the-badge&logo=django)
![DRF](https://img.shields.io/badge/DRF-3.16-red?style=for-the-badge&logo=django)
![Python](https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python)
![JWT](https://img.shields.io/badge/JWT-Auth-orange?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Powered-purple?style=for-the-badge)

**A comprehensive Django REST API for industrial control systems with role-based access, billing, complaints, and AI-powered anomaly detection.**

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Database Models](#-database-models)
- [Authentication](#-authentication)
- [Testing](#-testing)
- [MQTT Integration](#-mqtt-integration)

---

## ✨ Features

### 🔐 Authentication & Authorization
- **👤 Custom User Model** with role-based access control (Admin, Operator, Customer)
- **🔑 JWT Authentication** with access and refresh tokens
- **🛡️ Role-based permissions** for different user types
- **👨‍💼 Admin Panel Integration** with Django Unfold
- **🔒 Secure password handling** with validation
- **🎭 Face Recognition** for biometric authentication

### 🏷️ Industrial Tag Management
- **🏷️ Tag System** for tracking industrial sensors and equipment
- **📊 Tag Logs** for historical data storage
- **⏰ Real-time data** tracking with timestamps
- **🔍 Quality codes** for data validation
- **📈 Dashboard widgets** for tag visualization
- **🎚️ Alarm thresholds** and monitoring

### 💳 Billing & Payments
- **📋 Bill Management** for customer invoices
- **💰 Chapa Payment Integration** for Ethiopian payment processing
- **💳 Payment Tracking** with transaction history
- **📊 Automated bill status** updates
- **💵 Usage-based billing** calculation
- **🔔 Payment reminders** and notifications

### 🎫 Customer Support
- **📝 Complaint System** with lifecycle tracking (Pending → Investigating → Resolved)
- **🎯 Priority Levels** (Low, Medium, High)
- **👤 Role-based access**: Customers see only their complaints, Staff see all
- **📊 Support analytics** and performance metrics
- **🔔 Notifications** for status updates

### 🤖 AI-Powered Analytics
- **🔍 Anomaly Detection** for industrial sensor data
- **💬 AI Chat Assistant** for customer support
- **🎯 Confidence Scoring** for AI predictions
- **📊 Analysis History** tracking
- **� File Analysis** support
- **🧠 ML Model integration** via Kora AI

### 🚨 Alarm System
- **🚨 Real-time alarm monitoring** and detection
- **⚠️ Severity levels** (Critical, High, Medium, Low)
- **🎯 Rule-based alarm triggers** with thresholds
- **📊 Alarm KPIs** and statistics
- **🔔 Notification system** via MQTT
- **📝 Alarm acknowledgment** and shelving

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Django** | 6.0 | Web framework |
| **Django REST Framework** | 3.16 | API development |
| **Simple JWT** | Latest | JWT authentication |
| **drf-spectacular** | Latest | API documentation (Swagger/OpenAPI) |
| **SQLite** | Latest | Database (development) |
| **PostgreSQL** | Latest | Database (production) |
| **CORS Headers** | Latest | Cross-origin resource sharing |
| **Requests** | Latest | HTTP client for Chapa integration |
| **Django Unfold** | Latest | Enhanced admin interface |
| **APScheduler** | Latest | Task scheduling |
| **paho-mqtt** | Latest | MQTT integration |

---

## 📁 Project Structure

```
kora_backend/
├── core/                          # Main application
│   ├── models.py                  # Database models
│   ├── serializers.py             # DRF serializers
│   ├── views.py                   # API views
│   ├── urls.py                    # API routes
│   ├── admin.py                   # Django admin configuration
│   ├── chapa_service.py           # Payment gateway integration
│   ├── ai_service.py              # AI logic (mock for now)
│   ├── mqtt_service.py            # MQTT publishing service
│   ├── signals.py                 # Django signals for automation
│   ├── middleware.py              # Custom middleware
│   └── migrations/                # Database migrations
├── kora_control/                  # Project settings
│   ├── settings.py                # Django settings
│   ├── urls.py                    # Root URL configuration
│   └── wsgi.py                    # WSGI configuration
├── manage.py                      # Django management script
├── requirements.txt                # Python dependencies
└── db.sqlite3                     # SQLite database (development)
```

---

## 🚀 Installation

### Prerequisites

- Python 3.14+
- pip
- PostgreSQL (optional, for production)

### Setup Steps

#### 1. Clone the repository

```bash
git clone <repository-url>
cd koracontrol/kora_backend
```

#### 2. Install dependencies

```bash
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers requests drf-spectacular django-unfold django-apscheduler paho-mqtt python-dotenv face_recognition
```

Or use requirements.txt:

```bash
pip install -r requirements.txt
```

#### 3. Configure the database

**For development (SQLite):**
```bash
set DB_ENGINE=sqlite
```

**For production (PostgreSQL):**
```bash
set DB_ENGINE=postgresql
set DB_NAME=kora_db
set DB_USER=kora_user
set DB_PASSWORD=kora_password123
set DB_HOST=localhost
set DB_PORT=5432
```

#### 4. Run migrations

```bash
python manage.py migrate
```

#### 5. Create a superuser

```bash
python manage.py createsuperuser
```

#### 6. Run the development server

```bash
python manage.py runserver
```

#### 7. Access the API

- **API Base**: `http://127.0.0.1:8000/api/`
- **Admin Panel**: `http://127.0.0.1:8000/admin/`
- **Swagger Docs**: `http://127.0.0.1:8000/api/docs/`
- **OpenAPI Schema**: `http://127.0.0.1:8000/api/schema/`

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Database Configuration
DB_ENGINE=sqlite
DB_NAME=kora_db
DB_USER=kora_user
DB_PASSWORD=kora_password
DB_HOST=localhost
DB_PORT=5432

# Frontend Configuration
FRONTEND_BASE_URL=http://localhost:3000

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=postmessage

# Chapa Payment (Optional)
CHAPA_SECRET_KEY=your-chapa-secret-key
CHAPA_CURRENCY=ETB
CHAPA_TIMEOUT_SECONDS=20

# MQTT Configuration
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883
MQTT_ENABLED=true
```

### CORS Configuration

CORS is configured for development:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
```

---

## 📚 API Documentation

### Interactive Documentation

Visit **`http://127.0.0.1:8000/api/docs/`** for interactive Swagger UI documentation.

### OpenAPI Schema

Download the OpenAPI schema at **`http://127.0.0.1:8000/api/schema/`**

---

## 🌐 API Endpoints

### 🔐 Authentication

| Method | Endpoint                | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | `/api/auth/register/` | Register a new user      |
| POST   | `/api/auth/login/`    | Login and get JWT tokens |
| POST   | `/api/auth/refresh/`  | Refresh access token     |

### 🏷️ Tags

| Method | Endpoint       | Description            |
| ------ | -------------- | ---------------------- |
| GET    | `/api/tags/` | List all tags          |
| POST   | `/api/tags/` | Create a new tag       |
| POST   | `/api/logs/` | Create a tag log entry |

### 💳 Billing & Payments

| Method | Endpoint                              | Description              |
| ------ | ------------------------------------- | ------------------------ |
| GET    | `/api/billing/`                     | List user's bills        |
| POST   | `/api/payments/initiate/<bill_id>/` | Initiate Chapa payment   |
| GET    | `/api/payments/callback/<tx_ref>/`  | Payment callback (Chapa) |

### 🎫 Complaints

| Method | Endpoint                  | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| GET    | `/api/complaints/`      | List complaints (filtered by role) |
| POST   | `/api/complaints/`      | Create a complaint                 |
| GET    | `/api/complaints/<id>/` | Get complaint details              |
| PATCH  | `/api/complaints/<id>/` | Update complaint (staff only)      |

### 🤖 AI & Analytics

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| POST   | `/api/ai/analyze/` | Run anomaly detection on tag |
| POST   | `/api/ai/chat/`    | Chat with AI assistant       |

### 🚨 Alarms

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/api/alarms/events/`         | List alarm events             |
| GET    | `/api/alarms/kpis/`           | Get alarm KPIs                |
| POST   | `/api/alarms/events/<id>/ack/` | Acknowledge alarm            |
| POST   | `/api/alarms/events/<id>/shelve/` | Shelving alarm            |

---

## 🗄️ Database Models

### User

Custom user model with roles:
- **Fields**: `username`, `email`, `password`, `role`, `phone_number`, `meter_tag`, `billing_rate`, `profile_photo`, `face_encoding`
- **Roles**: `admin`, `operator`, `customer`
- **Features**: Biometric authentication, meter assignment

### Tag

Industrial sensor/equipment tracking:
- **Fields**: `name`, `description`, `data_type`, `unit`
- **Usage**: Represents physical sensors and actuators

### TagLog

Historical data for tags:
- **Fields**: `tag`, `value`, `quality_code`, `source_timestamp`, `timestamp`
- **Features**: Quality codes, source timestamps, automatic ordering

### Bill

Customer invoices:
- **Fields**: `user`, `amount`, `usage_kwh`, `is_paid`, `created_at`
- **Features**: Usage tracking, payment status

### PaymentTransaction

Payment tracking:
- **Fields**: `user`, `bill`, `amount`, `tx_ref`, `status`, `created_at`
- **Features**: Chapa integration, transaction history

### Complaint

Customer support tickets:
- **Fields**: `user`, `subject`, `description`, `status`, `priority`, `created_at`, `updated_at`
- **Features**: Lifecycle tracking, priority levels

### AlarmEvent

Alarm monitoring:
- **Fields**: `rule`, `tag`, `severity`, `level`, `state`, `triggered_value`, `message`
- **Features**: Real-time monitoring, acknowledgment, shelving

---

## 🔑 Authentication

### JWT Token Flow

#### 1. Register

```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "operator1",
  "password": "password123",
  "role": "operator"
}
```

#### 2. Login

```http
POST /api/auth/login/
Content-Type: application/json

{
  "username": "operator1",
  "password": "password123"
}
```

**Response:**

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "operator1",
    "role": "operator"
  }
}
```

#### 3. Use Access Token

```http
GET /api/tags/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

#### 4. Refresh Token

```http
POST /api/auth/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

---

## 📡 MQTT Integration

### MQTT Service

The backend includes an MQTT publishing service for real-time integration:

```python
from core.mqtt_service import publish_tag_update, publish_alarm_notification

# Publish tag update
publish_tag_update("L01", 85.5)

# Publish alarm notification
publish_alarm_notification({
    'id': 1,
    'severity': 'critical',
    'message': 'Tank level critical',
    'tag_name': 'L01'
})
```

### Automatic Publishing

Django signals automatically publish to MQTT:

- **TagLog Creation**: Automatically publishes tag updates to MQTT
- **Alarm Events**: Automatically publishes alarm notifications

### Configuration

```python
# Enable/disable MQTT
MQTT_ENABLED = os.environ.get('MQTT_ENABLED', 'true').lower() == 'true'

# MQTT broker settings
MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test core

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
```

### Test Coverage

- Models and serializers
- API endpoints
- Authentication flows
- Business logic
- MQTT integration (mocked)

---

## 🔒 Security

### Authentication Security
- JWT token validation
- Token expiration handling
- Secure password hashing
- CSRF protection
- CORS configuration

### Data Security
- SQL injection protection
- XSS protection
- Role-based access control
- Input validation
- Secure file uploads

### API Security
- Rate limiting (optional)
- Request throttling
- API key authentication (optional)
- HTTPS enforcement (production)

---

## 🛠️ Maintenance

### Database Backup

```bash
# SQLite
cp db.sqlite3 db.sqlite3.backup

# PostgreSQL
pg_dump kora_db > backup.sql
```

### Media Files

```bash
# Collect static files
python manage.py collectstatic

# Clear media files (careful!)
rm -rf media/*
```

### Log Monitoring

```bash
# Check Django logs
tail -f /var/log/django/error.log

# Monitor database queries
python manage.py showmigrations
```

---

## � Monitoring

### Django Debug Toolbar (Development)

```python
# Add to INSTALLED_APPS in settings.py
'django.contrib.staticfiles',
'debug_toolbar',
```

### Performance Monitoring

- **APScheduler**: Task scheduling and monitoring
- **Query optimization**: Use Django Debug Toolbar
- **Response time monitoring**: API response times
- **Database query analysis**: Slow query identification

---

## 🚨 Troubleshooting

### Common Issues

**Migration conflicts**
```bash
# Resolve migration conflicts
python manage.py migrate --fake-initial
python manage.py migrate --merge
```

**CORS errors**
```bash
# Check CORS settings in settings.py
# Verify FRONTEND_BASE_URL
# Check browser console for specific errors
```

**Database connection errors**
```bash
# Check database configuration
# Verify PostgreSQL is running
# Test connection string
```

**MQTT connection failures**
```bash
# Verify MQTT broker is running
# Check MQTT configuration
# Test MQTT broker connectivity
python -c "import paho.mqtt.client as mqtt; client = mqtt.Client(); client.connect('localhost', 1883)"
```

---

## � Additional Documentation

- [Django Documentation](https://docs.djangoproject.com/)
- [DRF Documentation](https://www.django-rest-framework.org/)
- [Integration Summary](../INTEGRATION_SUMMARY.md)
- [MQTT Topics Reference](../MQTT_TOPICS.md)
- [Integration Testing Guide](../INTEGRATION_TESTING_GUIDE.md)

---

## 🎯 Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Advanced analytics dashboard
- [ ] Mobile API optimization
- [ ] Enhanced AI capabilities
- [ ] Multi-tenancy support
- [ ] Advanced reporting features
- [ ] API rate limiting
- [ ] Enhanced security features

---

## 🤝 Contributing

### Development Guidelines
- Follow Django best practices
- Write comprehensive tests
- Update documentation
- Use meaningful commit messages
- Follow PEP 8 style guide

### Code Review Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit pull request
5. Code review and approval

---

## 📄 License

Part of the **Kora Control System**. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Automation**

![Django](https://img.shields.io/badge/Django-6.0-green?style=for-the-badge&logo=django)
![DRF](https://img.shields.io/badge/DRF-3.16-red?style=for-the-badge&logo=django)
![Python](https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python)

</div>