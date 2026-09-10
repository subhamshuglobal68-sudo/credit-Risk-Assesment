# CREA AI &mdash; Credit Risk ML Scoring & Enterprise Authentication Platform

A full-stack, responsible AI decision-support platform for loan underwriting, credit scoring, explainability (SHAP), anomaly detection (Isolation Forest), and enterprise-grade role-based authentication.

---

## Architecture Overview

| Component | Port | Technology | Purpose | Key Files |
|-----------|------|------------|---------|-----------|
| **Backend ML API** | `5000` | Flask / Python 3.11 / Scikit-learn / SHAP | ML prediction, risk scoring (0–1000), SHAP feature importance, and anomaly detection | `backend/run.py`, `backend/app/`, `backend/ml/` |
| **Frontend Web App** | `5001` | Flask / Jinja2 / TailwindCSS | Primary user interface for credit application, underwriting queue, scenario simulator, and audit logging | `frontend/server.py`, `frontend/field_mapper.py`, `frontend/templates/` |
| **Auth Server** | `5002` | Node.js / Express / Prisma ORM | Secure authentication service with email OTP verification, JWT rotation, bcrypt password hashing, and role guard | `server/src/index.js`, `server/prisma/`, `server/src/routes/` |
| **React Client** | `5173` | React 18 / Vite / TailwindCSS | Standalone production client with Supabase Auth integration and modern authentication flows | `client/src/App.jsx`, `client/src/pages/`, `client/src/context/` |

---

## Quick Start

### Option A: One-Click Startup (Recommended for Windows)

Double-click `start_all.bat` in the repository root, or run via PowerShell:

```powershell
.\start_all.ps1
```

All 4 services will automatically launch in separate windows with health checks active.

---

### Option B: Manual Service Startup

#### 1. Auth Server (Port 5002)
```powershell
cd server
npm install
npm run dev
```

#### 2. Backend ML API (Port 5000)
```powershell
cd backend
.\venv\Scripts\activate
python run.py
```

#### 3. Frontend Web App (Port 5001)
```powershell
cd frontend
.\venv\Scripts\activate
python server.py
```

#### 4. React Auth Client (Port 5173)
```powershell
cd client
npm install
npm run dev
```

---

## Service Endpoints & Health Checks

- **Frontend Application UI**: [http://127.0.0.1:5001](http://127.0.0.1:5001)
- **Backend ML API Health**: [http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)
- **Auth Server Health**: [http://127.0.0.1:5002/health](http://127.0.0.1:5002/health)
- **React Client**: [http://localhost:5173](http://localhost:5173)

---

## Testing

### Backend Unit & Regression Tests
```powershell
cd backend
pytest -v
```
*(All 62 tests passing, covering prediction payloads, SHAP attribution, data validation, and calibration)*

### Auth Server Tests
```powershell
cd server
npm test
```

---

## Supabase Database & Migrations

Database definitions and edge functions are located in `supabase/`:
- `supabase/schema.sql`: Complete PostgreSQL schema with Row Level Security (RLS) policies.
- `supabase/migrations/`: Versioned migration files.
- `supabase/functions/`: Serverless Edge Functions for administrative workflows.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.