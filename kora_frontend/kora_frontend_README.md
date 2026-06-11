# 🌐 Kora Control - Industrial Control System Frontend

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![Status](https://img.shields.io/badge/Status-Production-success)

**A modern, responsive, and feature-rich React dashboard for industrial control systems, built with Next.js and styled with Tailwind CSS.**

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Development](#-development)
- [API Integration](#-api-integration)
- [Authentication](#-authentication)
- [Deployment](#-deployment)

---

## ✨ Features

### 🔐 Modern Authentication
- **🔐 Secure Login & Registration**: Clean, intuitive forms for user onboarding and access
- **🔑 JWT Handling**: Automated token management via Axios interceptors
- **🛡️ Protected Routes**: Ensuring unauthorized users are redirected to login
- **📧 Forgot Password**: Secure password recovery functionality
- **🔄 Auto Refresh**: Automatic token refresh for seamless sessions

### 📊 Real-time Dashboard
- **📈 Usage Statistics**: Visual cards for current consumption (KWh), pending bills, and active tickets
- **📊 Interactive Analytics**: Dynamic charts using **Recharts** for usage and cost analysis (Weekly/Monthly/Yearly)
- **🕐 Recent Activity Feed**: Real-time log of billing updates and complaint status changes
- **🎨 KPI Cards**: Attractive metric displays with trend indicators
- **📱 Responsive Layout**: Optimized for desktop, tablet, and mobile devices

### 💳 Billing & Payment UI
- **📋 Bill Overview**: Comprehensive list of invoices with status tracking
- **💰 Payment Gateway Integration**: Seamless interface for Chapa payment processing
- **📊 Usage Analytics**: Visual consumption patterns and cost breakdown
- **📄 Invoice Details**: Detailed bill information and payment history
- **🔔 Payment Reminders**: Notifications for upcoming and overdue payments

### 🎫 Customer Support Center
- **📝 Complaint Management**: Dedicated UI for users to report issues
- **🔄 Support Lifecycle**: Visual indicators for ticket status (Pending, Investigating, Resolved)
- **🎯 Priority Levels**: Low, Medium, High priority classification
- **📊 Ticket Analytics**: Support performance metrics and trends
- **👤 Role-based Access**: Customers see only their tickets, staff see all

### 🤖 AI-Powered Assistant
- **💬 AI Chat Interface**: Interactive chat window for customer support
- **🧠 Anomaly Insights**: Visualization of detected anomalies in industrial data
- **� File Upload**: Support for document analysis and processing
- **🎯 Thread Management**: Multiple chat threads with history
- **📤 Export Options**: Export conversations in JSON or CSV format

### 🚨 Alarm Management
- **🚨 Real-time Alarms**: Live alarm notifications and status
- **📊 Alarm KPIs**: Standing alarms, critical count, total events
- **🎯 Severity Levels**: Low, medium, high, critical classification
- **🔔 Acknowledgment**: Alarm acknowledgment and note-taking
- **⏸️ Shelving**: Temporary alarm shelving with timers

### 📈 Analytics & Trends
- **📊 Usage Analytics**: Hourly, daily, weekly, monthly views
- **💰 Cost Analysis**: Consumption patterns and cost projections
- **📈 Trend Charts**: Historical data visualization
- **📊 Comparative Analysis**: Period-over-period comparisons
- **📤 Export Data**: Download analytics in various formats

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1 | React framework for server-side rendering and routing |
| **React** | 19.2 | UI library for component-based architecture |
| **TypeScript** | 5.0 | Static typing for improved developer productivity |
| **Tailwind CSS** | 4.0 | Utility-first CSS framework for modern styling |
| **Axios** | Latest | Standardized HTTP requests with JWT interceptors |
| **Lucide React** | Latest | Beautifully simple, consistent iconography |
| **Recharts** | Latest | Composable charting library for data visualization |

---

## 📁 Project Structure

```
kora_frontend/
├── app/                           # Next.js App Router
│   ├── (auth)/                    # Authentication routes (login, register)
│   │   ├── login/
│   │   │   └── page.tsx         # Login page
│   │   ├── register/
│   │   │   └── page.tsx         # Registration page
│   │   └── forgot-password/
│   │       └── page.tsx         # Password recovery
│   ├── dashboard/                 # Main application dashboard
│   │   ├── ai-chat/             # AI Assistant interface
│   │   │   ├── page.tsx         # Chat interface
│   │   │   └── components/      # Chat components
│   │   ├── alarms/              # Alarm management
│   │   │   └── page.tsx         # Alarm list and KPIs
│   │   ├── analytics/           # Usage and cost analytics
│   │   │   └── page.tsx         # Analytics dashboard
│   │   ├── billing/             # Billing and payment UI
│   │   │   └── page.tsx         # Bill list and payment
│   │   ├── complaints/          # Customer support tickets
│   │   │   └── page.tsx         # Complaint management
│   │   ├── journal/             # Activity journal
│   │   │   └── page.tsx         # Activity timeline
│   │   ├── notifications/       # User notifications
│   │   │   └── page.tsx         # Notification center
│   │   ├── plant-overview/      # Plant status overview
│   │   │   └── page.tsx         # Plant visualization
│   │   ├── settings/            # User settings
│   │   │   └── page.tsx         # Settings configuration
│   │   ├── trends/              # Trend analysis
│   │   │   └── page.tsx         # Trend charts
│   │   ├── page.tsx             # Main Dashboard view
│   │   └── layout.tsx           # Dashboard layout
│   ├── globals.css              # Global styles and Tailwind imports
│   ├── layout.tsx               # Root layout configuration
│   └── page.tsx                 # Landing page
├── lib/                           # Core utilities
│   ├── api.ts                   # Axios instance & API endpoint definitions
│   └── auth.ts                  # Authentication utilities
├── components/                    # Reusable components
│   ├── ui/                      # UI components
│   ├── charts/                  # Chart components
│   └── layout/                  # Layout components
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

#### 1. Clone the repository

```bash
git clone <repository-url>
cd koracontrol/kora_frontend
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure Environment

Create a `.env.local` file (if needed) to point to your backend API:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/
```

#### 4. Run the development server

```bash
npm run dev
```

#### 5. Open the Application

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard in action!

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `http://127.0.0.1:8000/api/` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `Kora Control` |

### API Configuration

The frontend communicates with the Django backend via `lib/api.ts`.

- **Interceptors**: Automatically attaches JWT tokens to every request if available in `localStorage`
- **Error Handling**: Automatically redirects to `/login` if a `401 Unauthorized` response is received
- **Typed Endpoints**: All API calls are typed using TypeScript interfaces

---

## 🧪 Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking
npm run type-check
```

### Development Workflow

1. **Start Backend**: Ensure Django backend is running on port 8000
2. **Start Frontend**: Run `npm run dev` for hot-reload development
3. **API Development**: Use TypeScript interfaces for type safety
4. **Component Development**: Build reusable components in `components/`
5. **Testing**: Write unit tests for critical components

### Code Style

- **ESLint**: Enforced code quality and style
- **Prettier**: Code formatting (optional)
- **TypeScript**: Strict typing enabled
- **Tailwind**: Utility-first CSS approach

---

## 🔌 API Integration

### Authentication API

```typescript
// Login
const response = await api.post('/auth/login/', {
  username: 'operator1',
  password: 'password123'
});

// Register
const response = await api.post('/auth/register/', {
  username: 'newuser',
  password: 'securepass123',
  role: 'customer'
});

// Refresh token
const response = await api.post('/auth/refresh/', {
  refresh: localStorage.getItem('refresh_token')
});
```

### Dashboard API

```typescript
// Get dashboard stats
const stats = await dashboardApi.getStats();

// Get usage analytics
const analytics = await dashboardApi.getUsageAnalytics('week');

// Get cost analytics
const cost = await dashboardApi.getCostAnalytics('month');

// Get recent activity
const activity = await dashboardApi.getRecentActivity();
```

### AI Chat API

```typescript
// List threads
const threads = await aiChatApi.listThreads();

// Create thread
const thread = await aiChatApi.createThread('New conversation');

// Send message
await aiChatApi.sendMessage(threadId, 'Hello AI assistant');

// Upload attachment
await aiChatApi.uploadAttachment(threadId, file);

// Export thread
await aiChatApi.exportThread(threadId, 'json');
```

### Alarm API

```typescript
// List alarm events
const alarms = await alarmApi.listEvents({
  state: 'active',
  severity: 'critical'
});

// Get alarm KPIs
const kpis = await alarmApi.getKpis();

// Acknowledge alarm
await alarmApi.acknowledge(eventId, 'Investigating');

// Shelve alarm
await alarmApi.shelve(eventId, 30, 'Temporary shelve');
```

---

## 🔐 Authentication

### JWT Token Flow

1. **User Login**: POST `/api/auth/login/` with credentials
2. **Token Storage**: Access and refresh tokens stored in localStorage
3. **Auto Attachment**: Axios interceptors automatically attach tokens
4. **Auto Refresh**: Refresh tokens used when access expires
5. **Auto Logout**: Redirect to login on 401 responses

### Protected Routes

Middleware in middleware.ts protects dashboard routes:

```typescript
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

---

## 📊 Component Examples

### Usage Chart Component

```typescript
<UsageChart 
  data={usageData} 
  timeRange="week"
  showTrend={true}
  showAverage={true}
/>
```

### Alarm Card Component

```typescript
<AlarmCard 
  severity="critical"
  count={5}
  trend="up"
  percentage="+12%"
/>
```

### KPI Card Component

```typescript
<KPICard 
  title="Current Usage"
  value={1234.56}
  unit="KWh"
  trend={-5.2}
  icon={<Zap />}
/>
```

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

The easiest way to deploy this Next.js app is with [Vercel](https://vercel.com/new).

```bash
npm run build
```

Then follow Vercel's deployment instructions.

### Environment Variables for Production

Set these in your deployment platform:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com/api/
NEXT_PUBLIC_APP_NAME=Kora Control
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📈 Performance Optimization

### Current Optimizations
- **Static Generation**: Where possible for faster load times
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Font Optimization**: Next.js font optimization
- **Tree Shaking**: Unused code elimination

### Monitoring
- **Web Vitals**: Core web vitals tracking
- **Error Tracking**: Integration with error monitoring (optional)
- **Analytics**: User behavior analytics (optional)

---

## 🧪 Testing

### Unit Testing (Future)
```bash
npm test
```

### E2E Testing (Future)
```bash
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Login and authentication flows work correctly
- [ ] Dashboard loads with real data
- [ ] Charts render correctly
- [ ] Navigation between pages works
- [ ] API calls return correct data
- [ ] Error handling works as expected
- [ ] Responsive design on mobile devices

---

## 🛠️ Troubleshooting

### Common Issues

**Build fails with TypeScript errors**
```bash
# Check TypeScript configuration
npm run type-check

# Fix TypeScript errors
# Update tsconfig.json if needed
```

**API calls failing with CORS errors**
```bash
# Verify backend CORS settings
# Check NEXT_PUBLIC_API_BASE_URL
# Ensure backend is running
```

**Styling not loading correctly**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

**JWT token not working**
```bash
# Clear localStorage
# Check token format
# Verify backend JWT configuration
```

---

## 📚 Additional Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Recharts Documentation](https://recharts.org)
- [Integration Summary](../INTEGRATION_SUMMARY.md)
- [API Documentation](http://127.0.0.1:8000/api/docs/)

---

## 🎯 Next Steps

- [ ] Implement Dark Mode toggle
- [ ] Add more granular data visualization (Heatmaps for industrial logs)
- [ ] Integrate React Query for better state management and caching
- [ ] Add unit tests for core components
- [ ] Enhance AI chat with voice support
- [ ] Implement real-time updates via WebSocket
- [ ] Add offline support with PWA capabilities
- [ ] Optimize for mobile performance

---

## 🤝 Contributing

### Development Guidelines
- Follow TypeScript best practices
- Use functional components with hooks
- Write meaningful commit messages
- Add JSDoc comments for complex functions
- Test on multiple browsers

### Code Style
- ESLint configuration provided
- Prettier configuration recommended
- Follow React best practices
- Use Tailwind CSS for styling

---

## 📄 License

Part of the **Kora Control System**. All rights reserved.

---

<div align="center">

**Built with ❤️ for Industrial Efficiency**

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)

</div>
