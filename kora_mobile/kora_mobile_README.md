# 💧 Kora Control — Mobile App

A **Flutter** mobile application for individual water-utility customers.  
Monitor water usage, check quality, view billing history, make payments, receive real-time alerts, and control your water valve remotely.

> **Status:** Phase 1 complete — all feature modules implemented with working data layer and polished UI.

---

## 🚀 Quick Start

### 📋 Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| 🔧 Flutter SDK | `>=3.24.0` (stable) | [flutter.dev/install](https://docs.flutter.dev/get-started/install/windows) |
| 🐦 Dart SDK | `>=3.5.0` | Bundled with Flutter |
| 📱 Android Studio | Latest | [developer.android.com](https://developer.android.com/studio) |
| 🌐 Chrome | Latest | For Flutter Web |

### 🔨 Step 1 — Install Flutter

1. Download Flutter stable from [flutter.dev](https://docs.flutter.dev/get-started/install/windows).
2. Extract to `C:\src\flutter` (avoid `C:\Program Files\`).
3. Add `C:\src\flutter\bin` to your `PATH` environment variable.
4. Verify installation:
   ```powershell
   flutter doctor
   ```
5. Fix any missing dependencies (Android Studio, Xcode on macOS, Chrome).

### 📂 Step 2 — Navigate to the project

```powershell
cd C:\Users\eyu\Desktop\koracontrol\kora_mobile
```

### 🏗️ Step 3 — Generate platform folders

This step creates `android/`, `ios/`, `web/`, `linux/`, `macos/`, `windows/` directories:

```powershell
flutter create . --project-name kora_mobile --org com.koracontrol
```

> 💡 This will **not** overwrite your existing `lib/` directory.

### ⚙️ Step 4 — Configure environment

Copy the example and edit for your setup:

```powershell
copy .env.example .env
```

Edit `.env` and set your backend URL:

| Platform | Default URL |
|----------|-------------|
| 📱 Android Emulator | `http://10.0.2.2:8000/api/` |
| 🍎 iOS Simulator | `http://localhost:8000/api/` |
| 📲 Physical Device | `http://<your-lan-ip>:8000/api/` |
| 🌐 Flutter Web | `http://localhost:8000/api/` |

Or pass at build time:

```powershell
flutter run --dart-define=KORA_API_BASE_URL=http://10.0.2.2:8000/api/
```

### 📦 Step 5 — Install dependencies

```powershell
flutter pub get
```

### 🌍 Step 6 — Generate localizations (optional)

```powershell
flutter gen-l10n
```

This generates localization classes from `lib/l10n/app_en.arb` and `lib/l10n/app_am.arb`.

### ▶️ Step 7 — Run the app

```powershell
# Default device (emulator or connected device)
flutter run

# Chrome (web)
flutter run -d chrome

# Specific Android emulator
flutter run -d emulator-5554
```

### 📦 Step 8 — Build for release

```powershell
# Android APK
flutter build apk --release

# Android App Bundle (Play Store)
flutter build appbundle --release

# iOS
flutter build ios --release
```

---

## 🏛️ Architecture

```
kora_mobile/
├── lib/
│   ├── main.dart                          # 🚪 App entry point + providers
│   │
│   ├── core/                              # 🔧 App-wide infrastructure
│   │   ├── api/
│   │   │   ├── api_client.dart            # 🌐 Dio + JWT interceptor + 401 refresh
│   │   │   ├── api_endpoints.dart         # 🔗 All backend endpoint paths
│   │   │   └── api_exceptions.dart        # ❌ Typed exception hierarchy
│   │   ├── auth/
│   │   │   ├── auth_state.dart            # 🔑 Auth user + session management
│   │   │   ├── auth_token_store.dart      # 🔒 Secure storage (Keychain/Keystore)
│   │   │   └── jwt_decoder.dart           # 🎫 Minimal JWT claim parser
│   │   ├── config/
│   │   │   └── env.dart                   # 🌍 Build-time env (--dart-define)
│   │   ├── theme/
│   │   │   ├── app_theme.dart             # 🎨 Light + dark Material 3 themes
│   │   │   ├── app_colors.dart            # 🎨 Kora blue/indigo + slate palette
│   │   │   └── theme_controller.dart      # 🌙 Theme mode ValueNotifier
│   │   ├── router/
│   │   │   └── app_router.dart            # 🧭 go_router with auth guard
│   │   ├── widgets/                       # 🧩 Shared UI components
│   │   │   ├── app_card.dart              # 📦 Rounded-2xl card
│   │   │   ├── kpi_tile.dart              # 📊 KPI display tile
│   │   │   ├── status_badge.dart          # 🏷️ Color-coded status pill
│   │   │   ├── loading_view.dart          # ⏳ Spinner + shimmer skeleton
│   │   │   ├── empty_state.dart           # 📭 Empty state illustration
│   │   │   └── error_state.dart           # ⚠️ Error + retry button
│   │   └── utils/
│   │       ├── date_format.dart           # 📅 Relative + short date formats
│   │       └── formatters.dart            # 💰 ETB currency, usage, percent
│   │
│   ├── features/                          # 📱 Feature-first modules
│   │   ├── auth/                          # 🔐 Login, Register, Forgot/Reset
│   │   │   ├── auth_controller.dart
│   │   │   ├── data/
│   │   │   │   ├── auth_repository.dart
│   │   │   │   └── models/user_model.dart
│   │   │   └── presentation/
│   │   │       ├── login_screen.dart
│   │   │       ├── register_screen.dart
│   │   │       ├── forgot_password_screen.dart
│   │   │       └── reset_password_screen.dart
│   │   │
│   │   ├── monitoring/                    # 🏠 Home/dashboard (live data)
│   │   │   ├── monitoring_controller.dart
│   │   │   ├── data/
│   │   │   │   ├── monitoring_repository.dart
│   │   │   │   └── models/monitoring_models.dart
│   │   │   └── presentation/
│   │   │       ├── monitoring_screen.dart
│   │   │       └── widgets/
│   │   │           ├── live_flow_chart.dart
│   │   │           ├── recent_readings_list.dart
│   │   │           └── service_alert_banner.dart
│   │   │
│   │   ├── trends/                        # 📈 Usage & cost analytics
│   │   ├── quality/                       # 💧 Water quality metrics
│   │   ├── alarms/                        # 🚨 Real-time alarm events
│   │   ├── billing/                       # 💰 Bills + Chapa payments
│   │   ├── complaints/                    # 🎫 Support tickets
│   │   ├── valve_control/                 # 🔧 Remote valve on/off
│   │   ├── ai_assistant/                  # 🤖 Chat with AI (threads)
│   │   ├── analytics/                     # 📉 AI anomaly insights
│   │   ├── notifications/                 # 🔔 In-app notifications
│   │   ├── settings/                      # ⚙️ Profile, theme, password
│   │   └── help/                          # ❓ Static FAQ
│   │
│   ├── shell/
│   │   └── app_shell.dart                 # 📱 Bottom navigation bar (5 tabs)
│   │
│   └── l10n/                              # 🌐 Localization ARB files
│       ├── app_en.arb                     # 🇬🇧 English
│       └── app_am.arb                     # 🇪🇹 Amharic
│
├── assets/
│   ├── images/                            # 🖼️ App images
│   └── icons/                             # 🎯 App icons
│
├── pubspec.yaml                           # 📋 Dependencies
├── analysis_options.yaml                  # 🔍 Lint rules
├── l10n.yaml                              # 🌐 Localization config
├── .env.example                           # ⚙️ Environment template
└── PLAN.md                                # 📝 Feature plan & roadmap
```

---

## 🎨 Theme & Branding

The app mirrors the Kora web dashboard's visual language:

| Element | Value |
|---------|-------|
| 🟦 Primary | `#2563EB` (blue-600) |
| 🟪 Secondary | `#4F46E5` (indigo-600) |
| 🌑 Surface (light) | `#F8FAFC` (slate-50) |
| 🌑 Surface (dark) | `#020617` (slate-950) |
| ✅ Success | `#10B981` (emerald-500) |
| ⚠️ Warning | `#F59E0B` (amber-500) |
| ❌ Danger | `#EF4444` (red-500) |
| 📐 Card radius | `20px` (rounded-2xl) |
| 🌙 Dark mode | First-class, follows system |

---

## 📱 Features

| Feature | Screen | Status |
|---------|--------|--------|
| 🔐 **Authentication** | Login, Register, Forgot/Reset Password | ✅ Complete |
| 🏠 **Monitoring** | Home dashboard with live flow, KPIs, alerts | ✅ Complete |
| 📈 **Trends** | Usage/cost charts, month comparison, bill forecast | ✅ Complete |
| 💧 **Quality** | Water quality metrics with threshold bars | ✅ Complete |
| 🚨 **Alarms** | Real-time alarm events with acknowledge action | ✅ Complete |
| 💰 **Billing** | Bill list + Chapa payment webview | ✅ Complete |
| 🎫 **Complaints** | Support ticket list + create new | ✅ Complete |
| 🔧 **Valve Control** | Remote on/off toggle with cooldown + history | ✅ Complete (see ⚠️ below) |
| 🤖 **AI Assistant** | Threaded chat with AI responses | ✅ Complete |
| 📉 **Analytics** | AI anomaly dashboard + findings | ✅ Complete |
| 🔔 **Notifications** | In-app notifications with mark-read | ✅ Complete |
| ⚙️ **Settings** | Profile, theme, change password, sign out | ✅ Complete |
| ❓ **Help** | Static FAQ content | ✅ Complete |

---

## ⚠️ Backend Gap — Valve Control

The **valve control** feature (`POST /api/valve/control/`, `GET /api/valve/status/`) requires a **customer-scoped backend endpoint** that does **not yet exist** in `kora_backend`.

### Current state
- ✅ Mobile app fully implements the valve toggle UI, cooldown, haptic feedback, and history.
- ✅ API endpoints defined in `api_endpoints.dart` (`valveStatus`, `valveControl`).
- ❌ Backend has **no** customer-scoped valve endpoints (only operator-only setpoint views).

### Required backend changes
Add to `kora_backend/core/urls.py` + a new view in `core/views.py`:

```
POST /api/valve/control/     # body: { "command": "open" | "close" }
GET  /api/valve/status/      # returns { "state": "open"|"closed", "last_changed_at": "..." }
```

These views should:
1. Authenticate the customer via JWT.
2. Look up the customer's assigned device/asset.
3. Write a setpoint + log an operator action, or call the MQTT service directly.

> 📖 See `PLAN.md §6` for the full specification.

---

## 🔑 Key Dependencies

| Package | Purpose |
|---------|---------|
| `provider` | State management (ChangeNotifier) |
| `go_router` | Navigation with auth guard |
| `dio` | HTTP client with JWT interceptor |
| `flutter_secure_storage` | JWT persistence (Keychain/Keystore) |
| `fl_chart` | Usage, cost, and flow charts |
| `webview_flutter` | Chapa payment checkout |
| `shimmer` | Loading skeleton animations |
| `google_fonts` | Inter font family |
| `intl` | Date/currency formatting |

---

## 🗂️ API Endpoints Consumed

The mobile app reuses the same `/api/*` endpoints as the web app. See `lib/core/api/api_endpoints.dart` for the complete list:

| Category | Key Endpoints |
|----------|---------------|
| 🔐 Auth | `auth/login/`, `auth/register/`, `auth/refresh/`, `auth/forgot-password/` |
| 📊 Dashboard | `dashboard/stats/`, `dashboard/kpis/`, `dashboard/usage/`, `dashboard/cost/` |
| 🚨 Alarms | `alarms/events/`, `alarms/kpis/`, `alarms/events/{id}/ack/` |
| 💰 Billing | `billing/`, `payments/initiate/{id}/`, `payments/transactions/` |
| 🤖 AI | `ai/threads/`, `ai/threads/{id}/messages/`, `ai/anomaly-dashboard/` |
| 🔧 Valve | `valve/status/`, `valve/control/` ⚠️ *not yet implemented* |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `flutter: command not found` | Add `C:\src\flutter\bin` to your `PATH` and restart terminal |
| Android build fails | Run `flutter doctor` and install missing Android SDK components |
| `10.0.2.2` not working | Ensure the Android emulator is running and the backend is on port 8000 |
| iOS Simulator can't connect | Use `http://localhost:8000/api/` instead |
| Physical device can't connect | Use your PC's LAN IP (e.g., `http://192.168.1.100:8000/api/`) |
| `flutter gen-l10n` fails | Ensure `lib/l10n/app_en.arb` and `app_am.arb` exist |

---

## 📄 License

This project is part of the Kora Control industrial water management platform.
