# Smart Parking System

An intelligent parking management system with AI-powered vehicle detection, real-time camera monitoring, and automated parking slot management.

## 🏗️ Tech Stack

### Backend
- **Runtime:** Node.js + Express (ESM)
- **PostgreSQL:** Primary database with Drizzle ORM
- **MongoDB:** AI detections & camera logs storage
- **Redis:** Caching layer
- **Authentication:** JWT + bcrypt

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **API Communication:** Fetch API

---

## 📁 Project Structure

```
Smart-Parking/
├── backend/                    # Backend API server
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js         # Environment configuration
│   │   ├── db/
│   │   │   ├── postgres.js    # PostgreSQL + Drizzle connection
│   │   │   ├── mongo.js       # MongoDB connection
│   │   │   ├── redis.js       # Redis connection & cache helpers
│   │   │   └── drizzle/
│   │   │       └── schema.js  # Database schema definitions
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── parking.routes.js
│   │   │   ├── ai.routes.js
│   │   │   ├── camera.routes.js
│   │   │   └── system.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── parking.controller.js
│   │   │   ├── ai.controller.js
│   │   │   ├── camera.controller.js
│   │   │   └── system.controller.js
│   │   ├── services/
│   │   ├── middlewares/
│   │   │   ├── auth.js        # JWT auth middleware
│   │   │   └── error.js       # Error handling middleware
│   │   └── utils/
│   │       └── asyncHandler.js
│   ├── drizzle.config.js      # Drizzle ORM configuration
│   ├── package.json
│   ├── index.js               # Express server entry point
│   └── .env.example
│
└── frontend/                   # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── Footer.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── LiveCamera.jsx
    │   │   └── MapParking.jsx
    │   ├── hooks/
    │   │   └── useApi.js
    │   ├── services/
    │   │   └── api.js
    │   ├── utils/
    │   │   └── helpers.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- PostgreSQL database
- MongoDB Atlas (or local MongoDB)
- Redis server (optional)

### ⚡ Quick Start — Auto-Run Script

The easiest way to start both frontend and backend simultaneously:

**Windows (CMD):**
```cmd
auto-run.bat
```

**Windows (PowerShell):**
```powershell
.\auto-run.ps1
```

**Linux / macOS:**
```bash
chmod +x auto-run.sh
./auto-run.sh
```

**Alternative — Using root-level npm script:**
```bash
npm install        # installs concurrently
npm run dev        # runs both servers in one terminal
```

The auto-run script will:
1. Detect your OS and choose the correct commands
2. Install dependencies for both frontend and backend (if missing)
3. Auto-generate `.env` from `.env.example` (if missing)
4. Run Drizzle database migrations
5. Test PostgreSQL, MongoDB, and Redis connections
6. Start both servers in parallel
7. Display a status report with connection states
8. Save logs to `logs/backend.log` and `logs/frontend.log`

### Manual Setup

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   copy .env.example .env    # Windows
   cp .env.example .env      # Linux/Mac
   ```
   Edit `.env` with your actual database credentials:
   ```env
   DATABASE_URL="postgresql://username:password@host:6543/postgres"
   MONGO_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/SmartParking"
   REDIS_URL="redis://default:<password>@host:6379"
   PORT=8000
   JWT_SECRET="your_secret_here"
   NODE_ENV="development"
   CORS_ORIGIN="http://localhost:5173"
   ```

4. **Run database migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   # Or push schema directly:
   npm run db:push
   ```

5. **Start the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

   Backend will run on `http://localhost:8000`

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

   Frontend will run on `http://localhost:5173`

4. **Build for production**
   ```bash
   npm run build
   npm run preview
   ```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/profile` | Get user profile | Yes |

### Parking
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/parking/slots` | Get all parking slots | No |
| GET | `/api/parking/slots/:id` | Get specific slot | No |
| POST | `/api/parking/slots` | Create parking slot | Yes |
| PUT | `/api/parking/slots/:id` | Update slot status | Yes |
| DELETE | `/api/parking/slots/:id` | Delete parking slot | Yes |
| GET | `/api/parking/logs` | Get parking logs | Yes |
| POST | `/api/parking/logs` | Create parking log | Yes |
| PUT | `/api/parking/logs/:id/complete` | Complete parking session | Yes |

### AI
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/ai/detections` | Get AI detections | Yes |
| GET | `/api/ai/detections/:id` | Get specific detection | Yes |
| POST | `/api/ai/detections` | Create detection record | No |
| GET | `/api/ai/stats` | Get detection statistics | Yes |

### Camera
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/camera/logs` | Get camera logs | Yes |
| POST | `/api/camera/logs` | Create camera log | No |
| PUT | `/api/camera/logs/:id` | Update camera status | Yes |
| GET | `/api/camera/status` | Get all camera statuses | Yes |

### System
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/system/health` | Health check | No |
| GET | `/api/system/info` | System information | No |

---

## 🗄️ Database Schema

### PostgreSQL Tables (Drizzle ORM)

#### users
- `id` (UUID, primary key)
- `username` (varchar, unique)
- `email` (varchar, unique)
- `password_hash` (text)
- `role` (varchar: admin, operator, user)
- `is_active` (boolean)
- `created_at`, `updated_at` (timestamp)

#### parking_slots
- `id` (UUID, primary key)
- `slot_number` (varchar, unique)
- `floor` (integer)
- `zone` (varchar)
- `is_occupied` (boolean)
- `vehicle_type` (varchar)
- `license_plate` (varchar)
- `camera_id` (varchar)
- `created_at`, `updated_at` (timestamp)

#### parking_logs
- `id` (UUID, primary key)
- `slot_id` (UUID, foreign key)
- `license_plate` (varchar)
- `vehicle_type` (varchar)
- `entry_time`, `exit_time` (timestamp)
- `duration_minutes` (integer)
- `fee` (integer)
- `status` (varchar: active, completed, overdue)
- `detection_confidence` (integer)
- `entry_image_url`, `exit_image_url` (text)
- `created_at` (timestamp)

### MongoDB Collections

#### ai_detections
- `_id`, `slot_id`, `license_plate`, `vehicle_type`, `confidence`, `timestamp`, `image_url`

#### camera_logs
- `_id`, `camera_id`, `status`, `last_heartbeat`, `snapshot_url`, `created_at`

---

## 🔧 Drizzle ORM Commands

```bash
# Generate migration files from schema
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema directly to database (development)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

---

## 🎨 Frontend Pages

1. **Dashboard** - Real-time parking overview with statistics
2. **Live Camera** - Monitor parking areas with camera feeds
3. **Map Parking** - Visual layout of parking slots by zone and floor

---

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```

---

## 📝 Notes

- Redis is optional and will gracefully degrade if not available
- The frontend proxies API requests to the backend during development
- CORS is configured to allow requests from the frontend origin
- Error handling middleware provides detailed stack traces in development mode only

---

## 🤝 Development Tips

1. **Run both servers simultaneously** - Open two terminals, one for backend and one for frontend
2. **Use Drizzle Studio** - `npm run db:studio` for a visual database browser
3. **Check health endpoint** - `GET /api/system/health` to verify server status
4. **Environment variables** - Never commit `.env` files, use `.env.example` as template

---

## 📄 License

ISC
