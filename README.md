# 🎉 Event Management Platform

Welcome to the **Event Management Platform**! This project is a complete full-stack solution for booking and managing events, connecting users with event vendors. It includes a mobile app for users/vendors and a powerful backend to handle bookings, real-time chat, notifications, and secure payments via Razorpay.

Whether you are a beginner or an experienced developer, this guide will walk you through everything you need to know to set up and run the project locally.

---

## 1. 🚀 Project Overview

**What does it do?**
This platform allows users to browse event listings (like venues, decorators, or caterers) and book them. Vendors can list their services, manage bookings, and chat with users. 

**Key Features:**
- **Role-Based Access:** Separate experiences for Users, Vendors, and Admins.
- **Escrow Payment Flow:** Secure booking process where users pay an advance, followed by a final payment after the service.
- **Razorpay Integration:** Seamless native payments using Razorpay SDK.
- **Real-Time Notifications & Chat:** Keep users and vendors connected.
- **Background Tasks:** Email delivery and payment verification handled via Celery.

---

## 2. 🛠 Tech Stack

### Frontend (Mobile App)
- **Framework:** React Native & Expo (Dev Client required for native modules)
- **Navigation:** React Navigation
- **API Client:** Axios
- **Payments:** `react-native-razorpay`

### Backend
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL (with SQLAlchemy ORM)
- **Cache & Message Broker:** Redis
- **Background Workers:** Celery
- **Payments:** Razorpay Python SDK

### Other Tools
- **Docker & Docker Compose:** For containerized, hassle-free backend setup.

---

## 3. 📦 Prerequisites

Before you start, make sure you have the following installed on your computer:

- **Node.js** (v18+ recommended) - [Download Here](https://nodejs.org/)
- **Python** (v3.10+ recommended) - [Download Here](https://www.python.org/downloads/)
- **Docker Desktop** (Required for running DB/Redis easily) - [Download Here](https://www.docker.com/products/docker-desktop)
- **Expo CLI** - Installed globally via `npm install -g expo-cli`
- **Git** - [Download Here](https://git-scm.com/)
- **Android Studio / Xcode** - For running mobile emulators (or you can use a physical device).

---

## 4. 📁 Project Structure

The project is split into two main folders:

```text
eventhub/
│
├── event-platform-mobile/      # The React Native (Expo) frontend
│   ├── src/                    # Source code (screens, components, api, navigation)
│   ├── app.json                # Expo config file
│   └── package.json            # Node dependencies
│
└── event-platform-backend/     # The FastAPI backend
    ├── app/                    # Source code
    │   ├── core/               # Core configs, DB setup, Celery app
    │   └── modules/            # Domain logic (auth, bookings, payments, etc.)
    ├── scripts/                # Database seeding & utility scripts
    ├── docker-compose.yml      # Docker setup for local services
    └── requirements.txt        # Python dependencies
```

---

## 5. 🔑 Environment Setup

Both the backend and frontend need environment variables to work correctly.

### Backend `.env`
Create a file named `.env` inside the `event-platform-backend/` folder and add the following required variables:

```env
# App
PROJECT_NAME=EventHub
ENVIRONMENT=development
DEBUG=True

# Database & Redis (Matches docker-compose.yml settings)
DATABASE_URL=postgresql://postgres:postgres@db:5432/eventhub
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Security
SECRET_KEY=your_super_secret_jwt_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email Settings (Configure your SMTP provider, e.g., Gmail)
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM=your_email@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# Payment Settings (Get these from Razorpay Dashboard)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

---

## 6. 🐳 Docker Setup (Recommended Backend Setup)

Using Docker is the easiest way to run the backend because it automatically sets up PostgreSQL, Redis, FastAPI, and Celery.

1. Open your terminal and navigate to the backend folder:
   ```bash
   cd event-platform-backend
   ```
2. Start all services using Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Your backend API is now running at `http://localhost:8000`. You can view the interactive API docs at `http://localhost:8000/docs`.

*(Note: If you prefer running it manually without Docker, you will need to install your own PostgreSQL and Redis servers, run `pip install -r requirements.txt`, start `uvicorn app.main:app --reload`, and start `celery -A app.core.celery_app worker` in separate terminals).*

---

## 7. 📱 Frontend Setup

Because this project uses the native `react-native-razorpay` SDK, you cannot use the standard "Expo Go" app. You must use an **Expo Dev Client**.

1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd event-platform-mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update the API Base URL:
   Ensure your API client (likely in `src/utils/apiClient.js` or `src/api/config.js`) points to your local machine's IP address (e.g., `http://192.168.1.x:8000/api/v1`) instead of `localhost`, so your phone/emulator can reach it.
4. Start the Expo Dev Client:
   ```bash
   npx expo start --dev-client
   ```
5. Run on your device:
   - Press `a` to open on Android Emulator.
   - Press `i` to open on iOS Simulator.
   - Or scan the QR code using a physical device with a pre-built dev client installed.

---

## 8. 📦 Expo Dev Client Setup (IMPORTANT)

**Why a Dev Build is Required:**
This project uses `react-native-razorpay` for secure payments, which requires native iOS and Android modules. Because of this, the standard "Expo Go" app **WILL NOT WORK**. You must use an Expo Dev Client.

**Build Dev Client Locally:**
Run the following in the project root (`event-platform-mobile/`):
```bash
npx expo run:android
# or for iOS
npx expo run:ios
```

**OR using EAS (Expo Application Services):**
If you prefer cloud builds or need to generate native directories:
```bash
npx expo prebuild
npx expo run:android
```

---

## 9. 📱 Running on Real Device (USB - Android)

### 1. Enable Developer Options
- Go to **Settings** → **About Phone**
- Tap **"Build Number"** 7 times to enable Developer Options.

### 2. Enable USB Debugging
- Go to **Settings** → **Developer Options**
- Enable **USB Debugging**.

### 3. Install ADB
Check if Android Debug Bridge (ADB) is installed:
```bash
adb version
```
*If not installed, download and install the **Android SDK Platform Tools**.*

### 4. Connect Device
Connect your phone via USB and run:
```bash
adb devices
```
*👉 If it shows `unauthorized`, look at your phone screen and accept the USB debugging prompt.*

### 5. Run App on Device
Run this in the project root:
```bash
npx expo run:android
```
*OR (if you already have the dev client installed on the phone):*
```bash
npx expo start
```
Then press `a` in the terminal to launch the app.

---

## 10. 🤖 Android Native Build Setup

**Prerequisites:**
- Android Studio installed.
- Android SDK and Emulator configured.

**Run Locally:**
```bash
# run this in project root
npx expo run:android
```

**Build APK (Optional):**
If you want to build a standalone APK for testing:
```bash
cd android
./gradlew assembleDebug
```
*APK Location:* `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 11. 🍏 iOS Setup (Mac only)

**Prerequisites:**
- macOS operating system.
- Xcode installed from the App Store.
- CocoaPods installed (`sudo gem install cocoapods`).

**Install Pods:**
```bash
cd ios
pod install
```

**Run App:**
```bash
# run this in project root
npx expo run:ios
```

---

## 12. 💳 Payment Setup (Razorpay)

To process test payments:
1. Go to [Razorpay](https://razorpay.com/) and create a free account.
2. Switch to **Test Mode**.
3. Generate API Keys (Key ID and Key Secret) in the dashboard settings.
4. Add these keys to your backend `.env` file (as shown in Step 5).
5. During checkout in the app, use the **Razorpay Test Cards** (e.g., card number `4111 1111 1111 1111`) to simulate successful payments.

---

## 13. ▶️ Running the Full App (Quick Summary)

Always follow this exact order when starting your development day:

1. **Start Backend (Terminal 1):**
   ```bash
   cd event-platform-backend
   docker-compose up
   ```
2. **Start Frontend (Terminal 2):**
   ```bash
   cd event-platform-mobile
   npx expo start --dev-client
   ```

---

## 14. 🧪 Testing Flow

To test the core functionality:
1. **Register** a new User account and a new Vendor account.
2. As a Vendor, **Create a Listing**.
3. As a User, browse to the listing and **Create a Booking**.
4. Pay the **Advance Amount** via the Razorpay test UI.
5. The backend will verify the payment and transition the booking status to `AWAITING_FINAL_PAYMENT` (which shows as "Booking Confirmed ✅" in the UI).
6. Complete the **Final Payment** to mark the booking as `COMPLETED`.

---

## 15. ❗ Common Errors & Fixes

- **Device not showing in adb:**
  ```bash
  adb kill-server
  adb start-server
  adb devices
  ```

- **Unauthorized device:**
  Accept the popup on your phone screen when connecting via USB.

- **Razorpay not opening / "Module not found":**
  Ensure you are using a dev build (**NOT** Expo Go).

- **Metro issues / Cache issues:**
  ```bash
  npx expo start --clear
  ```

- **Port issues:**
  If port 8081 is in use, start Metro on another port:
  ```bash
  npx expo start --port 8082
  ```

- **iOS build issues:**
  ```bash
  cd ios
  pod install --repo-update
  ```

- **Network Error / Axios Error:**
  The frontend is trying to connect to `localhost`. Change the base API URL to your computer's local Wi-Fi IP address (e.g., `192.168.1.100`).

- **Payments remain "PENDING":**
  Check the backend Docker logs. Ensure your Razorpay API keys in `.env` are correct. The backend `verify_payment` API must be hit successfully for the status to update.

- **Database connection failed:**
  Make sure Docker Desktop is running and the `db` container is healthy before the `api` container starts.

---

## 16. 📌 Notes for Beginners

- **Take your time:** Full-stack apps have many moving parts. If something breaks, look at the terminal logs first. The backend logs will tell you exactly why an API request failed.
- **Do not commit `.env`:** Never upload your `.env` file containing secrets to GitHub. It is already added to `.gitignore`.
- **Database Migrations:** If you change `models.py` in the backend, remember to update your database schema or drop and recreate your tables if you are just in early development.

