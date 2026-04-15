# Event Management Platform

A full-stack marketplace platform for event services connecting customers with vendors (DJs, Caterers, Decorators, Venue Owners, Event Managers, Product Sellers).

---

## Architecture Overview

```
Event Management App/
├── event-platform-backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── api/v1/                  # API endpoints
│   │   ├── core/                    # Core utilities (config, security, redis, celery)
│   │   ├── db/                      # Database initialization & sessions
│   │   ├── modules/
│   │   │   ├── auth/                # Authentication & JWT
│   │   │   ├── users/               # User management
│   │   │   ├── vendors/             # Vendor profiles & verification
│   │   │   ├── listings/            # Service listings
│   │   │   ├── bookings/            # Booking engine
│   │   │   ├── payments/            # Payment processing & escrow
│   │   │   ├── reviews/             # Rating & review system
│   │   │   ├── chat/                # Real-time messaging (WebSocket)
│   │   │   ├── notifications/       # Push notifications
│   │   │   └── admin/              # Admin panel
│   │   └── shared/                  # Shared utilities & exceptions
│   ├── scripts/                     # Database seeding scripts
│   └── main.py                      # Application entry point
│
└── event-platform-mobile/           # React Native (Expo) mobile app
    ├── src/
    │   ├── services/               # API & notification services
    │   ├── screens/                # App screens
    │   ├── components/             # Reusable components
    │   ├── navigation/             # Navigation configuration
    │   ├── styles/                 # Theme & styling
    │   └── utils/                  # Helpers & constants
    └── package.json
```

---

## Technology Stack

### Backend
| Component | Technology |
|-----------|------------|
| Framework | FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT (python-jose) |
| Caching | Redis |
| Background Tasks | Celery |
| Real-time | WebSockets |
| Payments | Razorpay |
| Push Notifications | Expo FCM |

### Mobile App
| Component | Technology |
|-----------|------------|
| Framework | React Native (Expo) |
| Navigation | React Navigation |
| HTTP Client | Axios |
| Storage | AsyncStorage |
| Payments | react-native-razorpay |
| Notifications | expo-notifications |

---

## Database Schema

### Core Tables
- **users**: Authentication & user profiles
- **vendors**: Vendor profiles with verification status
- **listings**: Service offerings from vendors
- **bookings**: Booking orders with status lifecycle
- **payments**: Payment transactions
- **reviews**: User ratings & comments
- **notifications**: Push notification history
- **chat_messages**: Real-time messaging

### Key Relationships
- User → Vendor: 1:1 (optional)
- Vendor → Listings: 1:many
- Listing → Bookings: 1:many
- Booking → Payment: 1:1
- Booking → Review: 1:1

---

## Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Customer, Vendor, Admin)
- Vendor verification workflow (PENDING → APPROVED/REJECTED)

### Vendor Management
- Vendor registration with category selection
- Business profile management
- Verification status tracking
- Service listings management

### Booking System
- Availability checking
- Double-booking prevention with transaction locking
- Booking status lifecycle: PENDING → CONFIRMED → COMPLETED

### Payment Processing
- Razorpay integration
- Escrow-style payment hold
- Platform commission tracking
- Vendor payout management

### Real-time Features
- WebSocket-based chat
- Push notifications (Expo)
- Live booking status updates

### Review System
- Post-booking reviews
- Rating aggregation
- Vendor ranking

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL
- Redis

### Backend Setup

1. **Install dependencies**:
```bash
cd event-platform-backend
uv sync
```

2. **Initialize database** (first time only):
```bash
uv run python -m app.db.init_db
```

3. **Seed required data**:
```bash
uv run python -m scripts.seed_listing_fields
```

4. **Generate fake data** (optional):
```bash
uv run python -m scripts.generate_fake_data
```

5. **Start the server**:
```bash
uv run uvicorn main:app --reload
```

The API will be available at:
- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/docs

### Mobile App Setup

1. **Install dependencies**:
```bash
cd event-platform-mobile
npm install
```

2. **Start the development server**:
```bash
npx expo start
```

3. **Run on Android**:
```bash
npx expo run:android
```

4. **Run on iOS**:
```bash
npx expo run:ios
```

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/eventdb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
EXPO_ACCESS_TOKEN=your-expo-token
```

### Mobile App
Configure API base URL in `src/utils/constants.js`

---

## API Endpoints Overview

| Module | Endpoints |
|--------|-----------|
| Auth | /api/v1/auth/register, /login, /verify |
| Users | /api/v1/users/me, /update-profile |
| Vendors | /api/v1/vendors, /:id, /verify |
| Listings | /api/v1/listings, /search, /:id |
| Bookings | /api/v1/bookings, /:id/confirm, /:id/cancel |
| Payments | /api/v1/payments/create, /webhook |
| Reviews | /api/v1/reviews, /:vendor-id |
| Chat | WebSocket /ws/chat/:conversation_id |
| Notifications | /api/v1/notifications, /register-token |

---

## Testing

### Backend Tests
```bash
cd event-platform-backend
uv run pytest
```

### Load Testing
```bash
cd event-platform-backend
uv run locust -f locustfile.py
```

---

## Project Structure

```
event-platform-backend/
├── app/
│   ├── api/v1/           # API routers
│   ├── core/             # Config, security, redis, celery
│   ├── db/               # Database setup
│   ├── modules/          # Business logic modules
│   └── shared/           # Common utilities
├── scripts/              # Utility scripts
├── pyproject.toml        # Python dependencies
└── main.py               # App entry point

event-platform-mobile/
├── src/
│   ├── services/         # API clients
│   ├── screens/          # App screens
│   ├── components/       # UI components
│   ├── navigation/      # Navigation setup
│   ├── styles/          # Theme files
│   └── utils/           # Helpers
├── package.json          # Node dependencies
└── app.json              # Expo config
```

---

## Development Notes

### Backend
- Uses repository pattern for data access
- Service layer for business logic
- WebSocket manager for real-time features
- Celery tasks for background jobs

### Mobile
- React Navigation for screen management
- Context API for state management
- Axios interceptors for auth tokens
- Toast messages for feedback

---

## Docker Deployment

### Quick Start with Docker Compose

1. **Create environment file** (`event-platform-backend/.env`):
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=eventhub
SECRET_KEY=your-jwt-secret-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@eventhub.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
```

2. **Build and run all services**:
```bash
cd event-platform-backend
docker-compose up --build
```

3. **Services available at**:
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Docker Services Architecture

| Service | Description | Port |
|---------|-------------|------|
| db | PostgreSQL 15 | 5432 |
| redis | Redis 7 | 6379 |
| api | FastAPI application | 8000 |
| worker | Celery background tasks | - |
| nginx | Reverse proxy & load balancer | 8000 |

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up --build

# Run database migrations
docker-compose exec api uv run python -m app.db.init_db

# Seed data
docker-compose exec api uv run python -m scripts.seed_listing_fields
docker-compose exec api uv run python -m scripts.generate_fake_data

# Access container shell
docker-compose exec api sh
```

### Production Deployment

The Dockerfile uses Gunicorn with Uvicorn workers for production:
```dockerfile
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

Nginx is configured as a reverse proxy with:
- Request logging
- Static file serving
- Load balancing (ready for scaling)