# Lexa AI Platform 💬🚀

Lexa adalah platform asisten customer service cerdas berbasis **Artificial Intelligence (AI)** dan teknologi **RAG (Retrieval-Augmented Generation)**. Platform ini dirancang khusus untuk memenuhi standar tingkat *Enterprise* dengan dilengkapi Dashboard Admin interaktif dan terintegrasi penuh.

Ditenagai oleh **Groq Cloud API** dengan model `openai/gpt-oss-120b`, Lexa mampu membalas pesan pelanggan secara sekejap mata dengan informasi akurat dari dokumen perusahaan Anda (anti halusinasi).

---

## ✨ Fitur Utama

### 1. 🌐 Customer Facing (Widget & Chatbot)
- **RAG (Retrieval-Augmented Generation)** — Menjawab spesifik berdasarkan dokumen (*Knowledge Base*) perusahaan.
- **Sidebar Chat Widget (React + Tailwind v4)** — Widget modern dengan desain premium (Glassmorphism, transisi halus) yang siap disematkan ke website apapun.
- **Streaming Real-time** — Respon mengetik kata per kata seperti manusia (menggunakan SSE).
- **Quick Replies** — Tombol saran (*shortcut*) pertanyaan.
- **Auto-Escalation** — Jika bot tidak tahu, otomatis merekomendasikan pelanggan untuk menghubungi tim melalui WhatsApp/Email.

### 2. 🎛️ Admin Dashboard (Manajemen Terpusat)
- **Monitoring Analytics (`/analytics`)** — Pantau tren *chat*, rasio pertanyaan terjawab/tidak terjawab dalam bentuk grafik interaktif (menggunakan Recharts).
- **Conversations History (`/conversations`)** — Pantau log percakapan seluruh pengguna secara real-time.
- **Knowledge Base Manager (`/kb`)** — Unggah (Upload), Hapus (Delete), dan Sinkronisasi Ulang (Reindex) dokumen RAG langsung dari *browser* tanpa perlu menyentuh *server*!
- **Settings & Persona Customization (`/settings`)** — Atur *Welcome Message*, *Quick Replies*, hingga mengubah *System Prompt* (watak/kepribadian) bot secara dinamis.
- **Users & Roles (`/users`)** — Antarmuka manajemen tim admin CS (*mock-up ready*).

---

## 🛠️ Teknologi yang Digunakan

- **Backend / API Server:** Python, FastAPI, SQLAlchemy, Uvicorn, SQLite.
- **AI & RAG:** Groq API, Langchain, ChromaDB, SentenceTransformers (`all-MiniLM-L6-v2`).
- **Frontend (Widget & Admin Dashboard):** React JS, Vite, Tailwind CSS v4, Lucide React, Recharts.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini memiliki arsitektur yang terpisah (*Backend* API, *Frontend Widget*, dan *Admin Dashboard*). Namun, kami sudah menyediakan **skrip otomatis** agar Anda bisa menjalankan semuanya dengan 1x klik.

### Persiapan Awal
1. Dapatkan API Key Groq di **[Groq Console](https://console.groq.com/)**.
2. Salin file `.env.example` menjadi `.env` lalu masukkan API Key Anda:
   ```env
   GROQ_API_KEY=gsk_IsiDenganApiKeyGroqAnda
   ```
3. *(Khusus pengguna pertama kali)* Jalankan Setup Virtual Environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
4. *(Khusus pengguna pertama kali)* Install module untuk frontend:
   ```powershell
   cd frontend
   npm install
   cd ../admin_dashboard
   npm install
   cd ..
   ```

### 🏃‍♂️ Menjalankan Keseluruhan Platform
Cara paling mudah adalah dengan menjalankan skrip batch yang sudah disediakan:
```powershell
.\start_all.bat
```
Skrip ini akan otomatis membuka **3 jendela terminal** sekaligus:
1. **API Server (FastAPI)** berjalan di `http://localhost:8000`
2. **Widget Chat Pelanggan** berjalan di `http://localhost:5173`
3. **Admin Dashboard** berjalan di `http://localhost:5174`

Silakan buka URL tersebut di *browser* pilihan Anda.

---

## 📁 Struktur Proyek Utama

```text
CHATBOT LEXA/
├── admin_dashboard/                # React App (Dashboard Admin)
├── frontend/                       # React App (Chat Widget Pelanggan)
├── core/                           # Logika Backend Python (LLM, RAG, Config)
├── data/                           # Penyimpanan Database & Settings JSON
├── knowledge_base/                 # Direktori penyimpanan dokumen teks/PDF untuk RAG
├── chroma_db/                      # Database Vector Index (Terbuat otomatis)
├── api.py                          # Entry point server FastAPI
├── start_all.bat                   # Skrip auto-run seluruh ekosistem
└── .env                            # Variabel lingkungan dan Secrets
```

---
*© 2026 LEXA Software House - Didesain untuk layanan pelanggan masa depan.*
