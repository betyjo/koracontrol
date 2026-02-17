# 🌐 Kora Control - Industrial Control System Frontend

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![Lucide](https://img.shields.io/badge/Lucide-Icons-orange?style=for-the-badge)

**A modern, responsive, and feature-rich React dashboard for industrial control systems, built with Next.js and styled with Tailwind CSS.**

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Dashboard Overview](#-dashboard-overview)
- [API Integration](#-api-integration)
- [Development Utilities](#-development-utilities)

---

## ✨ Features

### 🔐 Modern Authentication

- **Secure Login & Registration**: Clean, intuitive forms for user onboarding and access.
- **JWT Handling**: Automated token management via Axios interceptors.
- **Protected Routes**: Ensuring unauthorized users are redirected to the login page.

### 📊 Real-time Dashboard

- **Usage Statistics**: Visual cards for current consumption (KWh), pending bills, and active tickets.
- **Interactive Analytics**: Dynamic charts using **Recharts** for usage and cost analysis (Weekly/Monthly/Yearly).
- **Recent Activity Feed**: Real-time log of billing updates and complaint status changes.

### 💳 Billing & Payment UI

- **Bill Overview**: Comprehensive list of invoices with status tracking.
- **Payment Gateway Integration**: Seamless interface for initiating payments via the backend's Chapa integration.

### 🎫 Customer Support Center

- **Complaint Management**: Dedicated UI for users to report issues and track their progress.
- **Support Lifecycle**: Visual indicators for ticket status (Pending, Investigating, Resolved).

### 🤖 AI-Powered Assistant

- **AI Chat Interface**: Interactive chat window for customer support assistance.
- **Anomaly Insights**: (Integrated from backend) Visualization of detected anomalies in industrial data.

---

## 🛠️ Tech Stack

| Technology               | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| **Next.js 16**     | React framework for server-side rendering and routing             |
| **Tailwind CSS 4** | Utility-first CSS framework for modern styling                    |
| **Axios**          | Standardized HTTP requests with JWT interceptors                  |
| **Lucide React**   | Beautifully simple, consistent iconography                        |
| **Recharts**       | Composable charting library for data visualization                |
| **TypeScript**     | Static typing for improved developer productivity and reliability |

---

## 📁 Project Structure

```
kora_frontend/
├── app/                           # Next.js App Router
│   ├── (auth)/                    # Authentication routes (login, register)
│   ├── dashboard/                 # Main application dashboard
│   │   ├── ai-chat/               # AI Assistant interface
│   │   ├── billing/               # Billing and payment UI
│   │   ├── complaints/            # Customer support tickets
│   │   └── page.tsx               # Main Dashboard view (Analytics & Stats)
│   ├── globals.css                # Global styles and Tailwind imports
│   └── layout.tsx                 # Root layout configuration
├── lib/                           # Core utilities
│   └── api.ts                     # Axios instance & API endpoint definitions
├── public/                        # Static assets (images, icons)
├── package.json                   # Project dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

---

## 🚀 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Setup Steps

1. **Clone the repository**

```bash
cd kora_frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure Environment**
   Create a `.env.local` file (if needed) to point to your backend API:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/
```

4. **Run the development server**

```bash
npm run dev
```

5. **Open the Application**
   Visit [http://localhost:3000](http://localhost:3000) to see the dashboard in action!

---

## 🔌 API Integration

The frontend communicates with the Django backend via `lib/api.ts`.

- **Interceptors**: Automatically attaches JWT tokens to every request if available in `localStorage`.
- **Error Handling**: Automatically redirects to `/login` if a `401 Unauthorized` response is received.
- **Typed Endpoints**: All API calls are typed using TypeScript interfaces for better DX.

---

## 🚀 Deployment

The easiest way to deploy this Next.js app is with [Vercel](https://vercel.com/new).

```bash
npm run build
```

---

## 🎯 Next Steps

- [ ] Implement Dark Mode toggle
- [ ] Add more granular data visualization (Heatmaps for industrial logs)
- [ ] Integrate React Query for better state management and caching
- [ ] Add unit tests for core components
- [ ] Enhance AI chat with voice support

---

<div align="center">

**Built with ❤️ for Industrial Efficiency**

</div>
