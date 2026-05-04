# Smart Parking System

An intelligent parking management system with AI-powered vehicle detection, real-time camera monitoring, and automated parking slot management.

## 🏗️ Tech Stack

### Backend
- **Runtime:** Node.js + Express (ESM)
- **PostgreSQL:** Primary database with Drizzle ORM
- **MongoDB:** AI detections & camera logs storage
- **Redis:** Caching layer
- **Authentication:** JWT + bcrypt

### AI Service (Microservice)
- **Runtime:** Python 3.10+ (FastAPI)
- **Engine:** ONNX Runtime (CPU/GPU)
- **Models:** YOLOv8 (Vehicle, LPR, Parking Slot, Crowd Detection)
- **Processing:** OpenCV for frame-by-frame video analytics
- **Streaming:** Server-Sent Events (SSE) for real-time inference results

---

## 📁 Project Structure

**Root Path:** `D:\Projects\Smart-Parking`

```
├── 📁 ai-service
│   ├── 📁 app
│   │   ├── 📁 models
│   │   │   └── 🐍 prediction_model.py
│   │   ├── 📁 routers
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 health.py
│   │   │   ├── 🐍 lpr.py
│   │   │   ├── 🐍 predict.py
│   │   │   ├── 🐍 traffic.py
│   │   │   └── 🐍 vehicle.py
│   │   ├── 📁 services
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 lpr_engine.py
│   │   │   ├── 🐍 model_predictor.py
│   │   │   ├── 🐍 stream_processor.py
│   │   │   ├── 🐍 traffic_engine.py
│   │   │   └── 🐍 vehicle_engine.py
│   │   ├── 📁 utils
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 feature_engineering.py
│   │   │   ├── 🐍 image_tools.py
│   │   │   ├── 🐍 preprocessing.py
│   │   │   ├── 🐍 response_builder.py
│   │   │   └── 🐍 schemas.py
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 config.py
│   │   └── 🐍 main.py
│   ├── 📁 models
│   │   ├── 📄 crowd_detection_model.onnx
│   │   ├── 📄 illegal_model.onnx
│   │   ├── 📄 lpr_model.onnx
│   │   └── 📄 vehicle_model.onnx
│   ├── 📁 tests
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 conftest.py
│   │   ├── 🐍 mock_data_generator.py
│   │   ├── 🐍 test_api_contract.py
│   │   ├── 🐍 test_pipeline.py
│   │   └── 🐍 test_prediction_model.py
│   ├── 📁 training
│   │   ├── 🐍 __init__.py
│   │   └── 🐍 pipeline.py
│   ├── 📝 README.md
│   ├── 🐍 camera_worker.py
│   ├── 📄 requirements.txt
│   └── 🐍 validate.py
├── 📁 backend
│   ├── 📁 app
│   │   ├── 📁 config
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 settings.py
│   │   ├── 📁 db
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 database.py
│   │   ├── 📁 middleware
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 auth.py
│   │   │   └── 🐍 error_handler.py
│   │   ├── 📁 models
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 models.py
│   │   ├── 📁 routes
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 auth.py
│   │   │   ├── 🐍 dashboard.py
│   │   │   ├── 🐍 logs.py
│   │   │   └── 🐍 slots.py
│   │   ├── 📁 schemas
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 schemas.py
│   │   ├── 📁 utils
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 cache.py
│   │   ├── 🐍 __init__.py
│   │   └── 🐍 main.py
│   ├── 📁 src
│   │   ├── 📁 config
│   │   │   └── 📄 env.js
│   │   ├── 📁 controllers
│   │   │   ├── 📄 ai.controller.js
│   │   │   ├── 📄 analytics.controller.js
│   │   │   ├── 📄 auth.controller.js
│   │   │   ├── 📄 camera.controller.js
│   │   │   ├── 📄 executiveSummary.controller.js
│   │   │   ├── 📄 parking.controller.js
│   │   │   ├── 📄 simulator.controller.js
│   │   │   └── 📄 system.controller.js
│   │   ├── 📁 db
│   │   │   ├── 📁 drizzle
│   │   │   │   ├── 📁 migrations
│   │   │   │   │   ├── 📁 meta
│   │   │   │   │   │   ├── ⚙️ 0000_snapshot.json
│   │   │   │   │   │   └── ⚙️ _journal.json
│   │   │   │   │   └── 📄 0000_needy_human_fly.sql
│   │   │   │   └── 📄 schema.js
│   │   │   ├── 📁 schema
│   │   │   │   ├── 📄 MONGODB_SCHEMA.js
│   │   │   │   ├── 📝 README_DATABASE.md
│   │   │   │   └── 📄 SQL_SCHEMA.sql
│   │   │   ├── 📄 mongo.js
│   │   │   ├── 📄 postgres.js
│   │   │   ├── 📄 redis.js
│   │   │   ├── 📄 seed-admin.js
│   │   │   ├── 📄 test-mongo.js
│   │   │   ├── 📄 test-postgres.js
│   │   │   └── 📄 test-redis.js
│   │   ├── 📁 middlewares
│   │   │   ├── 📄 auth.js
│   │   │   └── 📄 error.js
│   │   ├── 📁 models
│   │   ├── 📁 routes
│   │   │   ├── 📄 ai.routes.js
│   │   │   ├── 📄 analytics.routes.js
│   │   │   ├── 📄 auth.routes.js
│   │   │   ├── 📄 camera.routes.js
│   │   │   ├── 📄 dashboard.routes.js
│   │   │   ├── 📄 live.routes.js
│   │   │   ├── 📄 logs.routes.js
│   │   │   ├── 📄 parking.routes.js
│   │   │   ├── 📄 simulator.routes.js
│   │   │   └── 📄 system.routes.js
│   │   ├── 📁 services
│   │   │   ├── 📄 ai.js
│   │   │   ├── 📄 executiveSummary.js
│   │   │   ├── 📄 index.js
│   │   │   ├── 📄 prediction_service.js
│   │   │   └── 📄 slotEfficiency.js
│   │   ├── 📁 simulator
│   │   │   ├── 📄 engine.js
│   │   │   └── 📄 rules.js
│   │   └── 📁 utils
│   │       ├── 📄 asyncHandler.js
│   │       └── 📄 time.js
│   ├── 📁 test
│   │   ├── 📄 api_prediction.test.http
│   │   ├── 📄 executive_summary.test.http
│   │   └── 📄 prediction_service.test.js
│   ├── 📁 tests
│   │   └── 🐍 test_api.py
│   ├── 📝 README.md
│   ├── 📄 drizzle.config.js
│   ├── 📄 index.js
│   ├── ⚙️ package-lock.json
│   ├── ⚙️ package.json
│   ├── 📄 requirements.txt
│   ├── 🐍 seed.py
│   ├── 📄 simulator-example.http
│   └── 📄 test-ai.http
├── 📁 docs
│   ├── 📝 7featurenotdoneyet.md
│   ├── 📝 ERD-concept.md
│   ├── 📝 MASTER_MIGRATION_GUIDE.md
│   ├── 📝 MASTER_SYSTEM_AUDIT_AND_MIGRATION.md
│   ├── 📝 MIGRATION_MOCK_TO_REAL.md
│   ├── 📝 Smart-parking-project-status.md
│   ├── 📝 TESTING_GUIDE.md
│   ├── 📝 ai_pipeline_planning.md
│   ├── 📝 core-progress.md
│   ├── 📝 documentation.md
│   ├── 📝 implementation_plan.md
│   ├── 📝 markdown.md
│   ├── 📝 migration_todo.md
│   ├── 📝 multi_model_pipeline_planning.md
│   ├── 📝 planning.md
│   ├── 📝 summary.md
│   └── 📝 tech-stack.md
├── 📁 frontend
│   ├── 📁 src
│   │   ├── 📁 components
│   │   │   ├── 📁 analytics
│   │   │   │   ├── 📄 BottleneckMap.jsx
│   │   │   │   ├── 📄 CorrelationChart.jsx
│   │   │   │   ├── 📄 EfficiencyStats.jsx
│   │   │   │   ├── 📄 OccupancyChart.jsx
│   │   │   │   ├── 📄 PredictedDemandChart.jsx
│   │   │   │   └── 📄 ViolationHeatmap.jsx
│   │   │   ├── 📄 FilterBar.jsx
│   │   │   ├── 📄 Footer.jsx
│   │   │   ├── 📄 Legend.jsx
│   │   │   ├── 📄 Navbar.jsx
│   │   │   ├── 📄 ParkingSlot.jsx
│   │   │   ├── 📄 ProtectedRoute.jsx
│   │   │   ├── 📄 Sidebar.jsx
│   │   │   └── 📄 SlotModal.jsx
│   │   ├── 📁 hooks
│   │   │   ├── 📄 useApi.js
│   │   │   └── 📄 useAuth.js
│   │   ├── 📁 layouts
│   │   │   └── 📄 DashboardLayout.jsx
│   │   ├── 📁 pages
│   │   │   ├── 📄 AnalyticsDashboard.jsx
│   │   │   ├── 📄 Dashboard.jsx
│   │   │   ├── 📄 ExecutiveSummaryPage.jsx
│   │   │   ├── 📄 LiveCamera.jsx
│   │   │   ├── 📄 Login.jsx
│   │   │   ├── 📄 ParkingMap.jsx
│   │   │   └── 📄 SimulatorPage.jsx
│   │   ├── 📁 services
│   │   │   ├── 📄 api.js
│   │   │   └── 📄 parking.js
│   │   ├── 📁 utils
│   │   │   └── 📄 helpers.js
│   │   ├── 📄 App.jsx
│   │   ├── 🎨 index.css
│   │   └── 📄 main.jsx
│   ├── 🌐 index.html
│   ├── ⚙️ package-lock.json
│   ├── ⚙️ package.json
│   ├── 📄 postcss.config.js
│   ├── 📄 tailwind.config.js
│   └── 📄 vite.config.js
├── ⚙️ .gitignore
├── 📝 README.md
├── 📄 auto-run.bat
├── 📄 auto-run.ps1
└── 📄 auto-run.sh
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
