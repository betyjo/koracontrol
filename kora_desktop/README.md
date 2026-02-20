# 🖥️ Kora Desktop HMI

Kora Desktop is a high-performance **SCADA Human-Machine Interface (HMI)** built with JavaFX. It provides real-time monitoring and control for industrial processes, specifically tailored for boiler systems and tank management.

---

## 🚀 Features

- **📊 Real-time Monitoring:** Continuously polls data from the backend every 200ms to provide up-to-the-second status updates.
- **🌊 Animated Tank UI:** Visual representation of fluid levels with smooth animations and dynamic scaling.
- **🚨 Emergency Stop:** One-click safety mechanism to immediately send halt commands to the control system.
- **🔗 REST Integration:** Robust communication with the Kora Backend via high-performance HTTP clients.
- **🎨 Modern HMI Design:** Clean, card-based interface with custom CSS styling for industrial environments.

---

## 🛠️ Tech Stack

- **☕ Java 21:** Leveraging the latest LTS features for performance and stability.
- **🖼️ JavaFX 21:** For a responsive and hardware-accelerated user interface.
- **📦 Apache Maven:** Project management and dependency handling.
- **🌐 Apache HttpClient 5:** Advanced HTTP communication for reliable data transfer.
- **📄 Google Gson:** Efficient JSON parsing for real-time data streams.

---

## 📂 Project Structure

```text
kora_desktop
├── src/main/java/com/kora/desktop
│   ├── App.java                # Application entry point & Stage setup
│   ├── DashboardController.java # Main UI logic & background poller
│   ├── DataService.java        # API communication layer
│   └── TankUI.java             # Custom UI component for tank visualization
└── src/main/resources
    └── style.css               # Global HMI styling
```

---

## 🏁 Getting Started

### Prerequisites
- JDK 21 or higher
- Maven 3.8+

### Setup & Run
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd kora_desktop
   ```

2. **Run the application:**
   ```bash
   mvn javafx:run
   ```

---

## ⚙️ Configuration
The application connects to the Kora Backend by default at:
`http://127.0.0.1:8000/api/`

Update `DataService.java` if your backend is hosted on a different address.

---

## 📜 License
Part of the **Kora Control System**. All rights reserved.
