# 🚀 Kora Industrial Engine

The **Kora Industrial Engine** is the core processing unit of the Kora Control system. It acts as an intermediary layer between industrial hardware (PLCs, sensors, actuators) and the central management dashboard.

---

## 🏗️ Architecture

The engine is built on a modular architecture to ensure reliability and easy hardware abstraction:

| Component | Responsibility |
| :--- | :--- |
| **`engine.py`** | 🫀 **The Heart**: Orchestrates the 2-second scan cycle. It reads data from drivers, updates the tag cache, verifies alarm conditions, and synchronizes data with the Django backend. |
| **`tag_manager.py`** | 📂 **Data Repository**: Maintains the in-memory state of all industrial tags. It handles values, units, and operational limits for components like boilers, pressure systems, and flow meters. |
| **`alarm_manager.py`** | ⚠️ **Safety Monitor**: Automatically monitors tag values against safety thresholds. If a limit is exceeded, it triggers real-time alerts. |
| **`drivers.py`** | 🔌 **Protocol Abstraction**: Defines a standard `ProtocolAdapter` interface. Includes a `MockDriver` for simulation and testing without physical hardware. |

---

## 🛠️ Key Features

- 🔄 **Real-time Scan Cycle**: 2-second polling interval for high-frequency data logging.
- 📡 **REST Sync**: Seamless integration with the Kora Control API using JWT authentication.
- 🚨 **Threshold Monitoring**: Built-in logic for critical limit detection and signaling.
- 🏗️ **Hardware Agnostic**: Easily swap the `MockDriver` for real Modbus, S7, or OPC-UA drivers.

---

## 🚦 Getting Started

### Prerequisites
- Python 3.8+
- Active Kora Control Backend

### Installation
1. Ensure the backend is running.
2. Create a local env file from the example:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and set credentials for a backend account that can access `/api/tags/` and `/api/logs/`.
4. Run the engine from the `kora_engine` directory:
   ```bash
   python engine.py
   ```

### Configuration
Configure your connectivity and auth:
- `API_URL`: Your backend logging endpoint.
- `KORA_ENGINE_TOKEN`: Access token (optional, from environment variable).
- `KORA_ENGINE_USERNAME`: Username for automatic login on startup/401.
- `KORA_ENGINE_PASSWORD`: Password for automatic login on startup/401.

### Authentication behavior
- If `KORA_ENGINE_TOKEN` is set and valid, it is used directly.
- If requests return `401`, the engine attempts login using `KORA_ENGINE_USERNAME` and `KORA_ENGINE_PASSWORD`, then retries once.
- If neither token nor username/password is provided, logging requests are skipped with a clear error.
- `.env` in `kora_engine` is auto-loaded on startup (via `python-dotenv`).

---

## 📊 Sample Output
```text
Successfully connected to Virtual PLC.
🚀 Kora Industrial Engine Started...
✅ Data Logged: Boiler_Temp (ID:1) = 85.5
✅ Data Logged: System_Pressure (ID:2) = 12.2
--- Scan Cycle Complete ---
```

---

> [!IMPORTANT]
> Ensure all Tags are created in the Django Admin panel before starting the engine to avoid `Tag Not Found` errors.
