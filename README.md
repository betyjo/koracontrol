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
- [API Documentation](#-api-documentation)
- [API Endpoints](#-api-endpoints)
- [Database Models](#-database-models)
- [Authentication](#-authentication)
- [Testing](#-testing)

---

## ✨ Features

### 🔐 Authentication & Authorization
- **Custom User Model** with role-based access control (Admin, Operator, Customer)
- **JWT Authentication** with access and refresh tokens
- **Role-based permissions** for different user types

### 🏷️ Industrial Tag Management
- **Tag System** for tracking industrial sensors and equipment
- **Tag Logs** for historical data storage
- **Real-time data** tracking with timestamps

### 💳 Billing & Payments
- **Bill Management** for customer invoices
- **Chapa Payment Integration** for Ethiopian payment processing
- **Payment Tracking** with transaction history
- **Automated bill status** updates

### 🎫 Customer Support
- **Complaint System** with lifecycle tracking (Pending → Investigating → Resolved)
- **Priority Levels** (Low, Medium, High)
- **Role-based access**: Customers see only their complaints, Staff see all

### 🤖 AI-Powered Analytics
- **Anomaly Detection** for industrial sensor data
- **AI Chat Assistant** for customer support
- **Confidence Scoring** for AI predictions
- **Analysis History** tracking

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Django 6.0** | Web framework |
| **Django REST Framework 3.16** | API development |
| **Simple JWT** | JWT authentication |
| **drf-spectacular** | API documentation (Swagger/OpenAPI) |
| **SQLite** | Database (development) |
| **CORS Headers** | Cross-origin resource sharing |
| **Requests** | HTTP client for Chapa integration |

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
│   └── migrations/                # Database migrations
├── kora_control/                  # Project settings
│   ├── settings.py                # Django settings
│   └── urls.py                    # Root URL configuration
├── manage.py                      # Django management script
└── db.sqlite3                     # SQLite database
```

---

## 🚀 Installation

### Prerequisites
- Python 3.14+
- pip

### Setup Steps

1. **Clone the repository**
```bash
cd kora_backend
```

2. **Install dependencies**
```bash
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers requests drf-spectacular
```

3. **Run migrations**
```bash
python manage.py migrate
```

4. **Create a superuser**
```bash
python manage.py createsuperuser
```

5. **Run the development server**
```bash
python manage.py runserver
```

6. **Access the API**
- API Base: `http://127.0.0.1:8000/api/`
- Admin Panel: `http://127.0.0.1:8000/admin/`
- **Swagger Docs**: `http://127.0.0.1:8000/api/docs/`

---

## 📚 API Documentation

### Interactive Documentation
Visit **`http://127.0.0.1:8000/api/docs/`** for interactive Swagger UI documentation.

### OpenAPI Schema
Download the OpenAPI schema at **`http://127.0.0.1:8000/api/schema/`**

---

## 🌐 API Endpoints

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login and get JWT tokens |
| POST | `/api/auth/refresh/` | Refresh access token |

### 🏷️ Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags/` | List all tags |
| POST | `/api/tags/` | Create a new tag |
| POST | `/api/logs/` | Create a tag log entry |

### 💳 Billing & Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/` | List user's bills |
| POST | `/api/payments/initiate/<bill_id>/` | Initiate Chapa payment |
| GET | `/api/payments/callback/<tx_ref>/` | Payment callback (Chapa) |

### 🎫 Complaints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/complaints/` | List complaints (filtered by role) |
| POST | `/api/complaints/` | Create a complaint |
| GET | `/api/complaints/<id>/` | Get complaint details |
| PATCH | `/api/complaints/<id>/` | Update complaint (staff only) |

### 🤖 AI & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze/` | Run anomaly detection on tag |
| POST | `/api/ai/chat/` | Chat with AI assistant |

---

## 🗄️ Database Models

### User
- Custom user model with roles: `admin`, `operator`, `customer`
- Fields: `username`, `email`, `password`, `role`

### Tag
- Industrial sensor/equipment tracking
- Fields: `name`, `description`, `created_at`

### TagLog
- Historical data for tags
- Fields: `tag`, `value`, `timestamp`

### Bill
- Customer invoices
- Fields: `user`, `amount`, `usage_kwh`, `is_paid`, `created_at`

### PaymentTransaction
- Payment tracking
- Fields: `user`, `bill`, `amount`, `tx_ref`, `status`, `created_at`

### Complaint
- Customer support tickets
- Fields: `user`, `subject`, `description`, `status`, `priority`, `created_at`, `updated_at`

### AIAnalysis
- AI anomaly detection results
- Fields: `tag`, `is_anomaly`, `confidence_score`, `explanation`, `detected_at`

---

## 🔑 Authentication

### JWT Token Flow

1. **Register**: `POST /api/auth/register/`
```json
{
  "username": "operator1",
  "password": "password123",
  "role": "operator"
}
```

2. **Login**: `POST /api/auth/login/`
```json
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
  "role": "operator"
}
```

3. **Use Token**: Add to headers
```
Authorization: Bearer <access_token>
```

---

## 🧪 Testing

### Manual Testing
Use tools like:
- **Postman**
- **Thunder Client** (VS Code)
- **cURL**
- **Swagger UI** (built-in at `/api/docs/`)

### Example Request
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

---

## 🎯 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all endpoints |
| **Operator** | View all data, manage complaints, run AI analysis |
| **Customer** | View own bills, create complaints, use AI chat |

---

## 🔮 AI Integration

The AI service (`core/ai_service.py`) currently uses **mock logic** for demonstration:

- **Anomaly Detection**: Flags values > 100 as anomalies
- **Chat Assistant**: Returns random helpful responses

**For Production**: Replace with actual ML models (TensorFlow, Scikit-learn, etc.)

---

## 📝 License

This project is part of an industrial control system capstone project.

---

## 👥 Team

**Backend Lead** - Responsible for API development, database design, and system architecture

---

## 🚀 Next Steps

- [ ] Integrate real ML models for AI analysis
- [ ] Add comprehensive unit tests
- [ ] Deploy to production server
- [ ] Add WebSocket support for real-time updates
- [ ] Implement data visualization endpoints
- [ ] Add email notifications for complaints

---

<div align="center">

**Built with ❤️ using Django & Django REST Framework**

</div>
