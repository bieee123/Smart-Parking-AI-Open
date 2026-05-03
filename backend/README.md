# Smart Parking AI System — FastAPI Backend

Complete REST API built with **FastAPI** for the Smart Parking AI System.

## 📋 Features

| Area | Status |
|---|---|
| Authentication (JWT) | ✅ |
| Parking Slot CRUD | ✅ |
| Event Log System | ✅ |
| Dashboard Summary & Map | ✅ |
| Redis Caching (10s TTL) | ✅ |
| OpenAPI / Swagger Docs | ✅ |
| Unified Error Responses | ✅ |
| SQLAlchemy Models | ✅ |
| Database Seeding | ✅ |

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** installed
- **PostgreSQL** running on `localhost:5432`
- **Redis** running on `localhost:6379`

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.fastapi` to `.env` (or the existing `.env` already has the right values):

```bash
# PostgreSQL
DATABASE_URL="postgresql://postgres:GabLintong02@localhost:5432/smart_parking"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# JWT
JWT_SECRET="your-secret-here"
```

### 3. Create Database

```bash
# In psql or pgAdmin, create the database:
createdb smart_parking
# OR: CREATE DATABASE smart_parking;
```

### 4. Seed Database

```bash
python seed.py
```

This creates:
- **Admin user**: `admin` / `admin123`
- **43 parking slots** across 2 floors, zones A/B, plus VIP/EV/disabled slots

### 5. Run Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server starts at: **http://localhost:8000**

### 6. Open API Docs

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📁 Project Structure

```
backend/
├── app/
│   ├── config/
│   │   └── settings.py          # Environment / .env loader
│   ├── db/
│   │   └── database.py          # SQLAlchemy engine + session
│   ├── middleware/
│   │   ├── auth.py              # JWT creation, verification, get_current_user
│   │   └── error_handler.py     # Global exception handlers
│   ├── models/
│   │   └── models.py            # User, ParkingSlot, ParkingLog
│   ├── routes/
│   │   ├── auth.py              # POST /auth/login, GET /auth/me
│   │   ├── slots.py             # CRUD /slots
│   │   ├── logs.py              # POST /logs, GET /logs, GET /logs/recent
│   │   └── dashboard.py         # GET /dashboard/summary, GET /dashboard/slots-map
│   ├── schemas/
│   │   └── schemas.py           # Pydantic request/response models
│   ├── utils/
│   │   └── cache.py             # Redis cache utilities
│   └── main.py                  # FastAPI app entry point
├── tests/
│   └── test_api.py              # Comprehensive tests for all endpoints
├── seed.py                      # Database seeder
├── requirements.txt
├── .env
└── README.md
```

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | ❌ | Login & get JWT token |
| GET | `/api/auth/me` | ✅ | Get current user profile |

### Parking Slots

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/slots` | ❌ | List all slots (cached 10s) |
| GET | `/api/slots/{id}` | ❌ | Get slot detail (cached 10s) |
| POST | `/api/slots` | ✅ | Create a new slot |
| PUT | `/api/slots/{id}` | ✅ | Update a slot |
| DELETE | `/api/slots/{id}` | ✅ | Delete a slot (fails if referenced by logs) |

### Logs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/logs` | ✅ | Create log entry (auto-updates slot status) |
| GET | `/api/logs` | ❌ | List logs with pagination & filters |
| GET | `/api/logs/recent` | ❌ | Last 20 logs for dashboard (cached 10s) |

### Dashboard

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/summary` | ❌ | Aggregate slot counts & today's logs |
| GET | `/api/dashboard/slots-map` | ❌ | All slots for map visualization |

## 📝 Request/Response Examples

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@smartparking.io",
    "role": "admin",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Create Log (auto-updates slot status)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:8000/api/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"slot_id": 1, "event": "vehicle_enter", "license_plate": "ABC-1234"}'
```

### List Logs with Filters

```bash
curl "http://localhost:8000/api/logs?page=1&page_size=10&event=vehicle_enter&date_from=2025-01-01"
```

### Dashboard Summary

```bash
curl http://localhost:8000/api/dashboard/summary
```

Response:
```json
{
  "success": true,
  "data": {
    "total_slots": 43,
    "available": 40,
    "occupied": 2,
    "reserved": 1,
    "blocked": 0,
    "today_logs": 5,
    "last_update": "2025-01-15T10:30:00Z"
  }
}
```

## 🧪 Running Tests

```bash
cd backend
pytest tests/test_api.py -v
```

This runs 20+ tests covering:
- Auth (login, profile, bad credentials)
- Slot CRUD + duplicate prevention + FK constraint
- Log creation + auto slot status update + filters
- Dashboard summary + slots map
- Error handling (422, 404, 401)
- Cache invalidation on mutations

## 🔒 Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "error details",
  "error_code": "INVALID_CREDENTIALS"
}
```

## 🗂 Redis Cache Keys

| Key | TTL | Invalidated On |
|---|---|---|
| `slots_all` | 10s | Slot create/update/delete, log create |
| `slot_{id}` | 10s | Slot update/delete, log create for that slot |
| `logs_recent` | 10s | Log create |

## 🛠 Error Codes

| Code | Meaning |
|---|---|
| `INVALID_CREDENTIALS` | Wrong username/password |
| `ACCOUNT_INACTIVE` | User is deactivated |
| `SLOT_NOT_FOUND` | Slot ID doesn't exist |
| `DUPLICATE_SLOT` | Slot number already exists |
| `SLOT_IN_USE` | Cannot delete: slot has logs |
| `SLOT_OCCUPIED` | Cannot log enter: already occupied |
| `SLOT_NOT_OCCUPIED` | Cannot log exit: not occupied |
| `VALIDATION_ERROR` | Request body validation failed |
| `INTEGRITY_ERROR` | Database constraint violation |
| `INTERNAL_ERROR` | Unexpected server error |

## 📌 Notes

- **Tables are auto-created on startup** — no manual migration needed for first run
- **JWT expiry**: 1440 minutes (24 hours) by default
- **CORS**: Configured for `http://localhost:5173` (Vite dev server)
- **Password hashing**: bcrypt via `passlib`
- **JWT library**: `python-jose`
