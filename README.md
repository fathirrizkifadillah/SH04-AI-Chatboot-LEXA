# Lexa AI Platform

Platform asisten customer service cerdas berbasis **AI** dan **RAG (Retrieval-Augmented Generation)**. Ditenagai oleh **Groq Cloud API** dengan model `openai/gpt-oss-120b`.

---

## Fitur Utama

### Customer Facing (Widget)
- **RAG Pipeline** — Menjawab berdasarkan dokumen perusahaan (Knowledge Base)
- **Streaming Real-time** — Respon kata per kata via SSE
- **Quick Replies** — Tombol saran pertanyaan
- **WebSocket Sync** — Real-time admin reply & handoff
- **Draggable Panel** — Widget bisa dipindah-mana saja

### Admin Dashboard
- **Dashboard** — KPI cards, chart percakapan, unanswered queries
- **Conversations** — Log percakapan real-time dengan handoff ke manusia
- **Knowledge Base** — Upload, hapus, reindex dokumen RAG
- **Analytics** — Grafik tren chat & metrik respons
- **Users & Roles** — Manajemen tim admin
- **Settings** — Welcome message, quick replies, system prompt

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python, FastAPI, SQLAlchemy, Uvicorn |
| **Database** | PostgreSQL (prod) / SQLite (dev) |
| **AI & RAG** | Groq API, ChromaDB, SentenceTransformers |
| **Frontend** | React 19, TypeScript, Vite 8 |
| **Admin** | React 19, TypeScript, Vite 8, React Router, Recharts |
| **Styling** | Tailwind CSS (v3 widget, v4 admin) |
| **Testing** | Vitest, React Testing Library |
| **CI/CD** | GitHub Actions |

---

## Cara Menjalankan

### 1. Persiapan
```bash
# Clone & setup Python
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Setup env
cp .env.example .env
# Edit .env → isi GROQ_API_KEY

# Install frontend deps
cd frontend && npm install
cd ../admin_dashboard && npm install
cd ..
```

### 2. Jalankan
```powershell
.\start_all.bat
```

Atau manual:
```powershell
# Terminal 1 - Backend
python api.py

# Terminal 2 - Widget (port 5173)
cd frontend && npm run dev

# Terminal 3 - Admin (port 5174)
cd admin_dashboard && npm run dev
```

### 3. Akses
| Service | URL |
|---------|-----|
| API Server | http://localhost:8000 |
| Chat Widget | http://localhost:5173 |
| Admin Dashboard | http://localhost:5174 |

Default admin: `admin@lexatech.id` (password auto-generated, cek terminal)

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + production build
npm run typecheck    # TypeScript check only
npm run test         # Run tests (watch mode)
npm run test -- --run # Run tests (single run)
npm run lint         # Lint with oxlint
```

---

## Struktur Proyek

```
CHATBOT LEXA/
├── api.py                  # FastAPI entry point
├── core/                   # Backend logic (LLM, RAG, Auth, DB)
├── routers/                # API routes (chat, admin, auth, widget)
├── frontend/               # Chat widget (React + TypeScript)
├── admin_dashboard/        # Admin panel (React + TypeScript)
├── knowledge_base/         # RAG documents + ChromaDB
├── .github/workflows/      # CI/CD pipeline
├── start_all.bat           # Auto-run all services
└── .env                    # Environment variables (gitignored)
```

---

## CI/CD

GitHub Actions otomatis menjalankan setiap push/PR ke `main`:
- **Frontend** → typecheck → build → test
- **Admin** → typecheck → build → test
- **Backend** → import checks

---

*© 2026 LEXA Software House*