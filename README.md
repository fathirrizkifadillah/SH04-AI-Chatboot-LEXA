# Chatbot Customer Service - Lexa 💬

Lexa adalah chatbot asisten customer service berbasis AI dengan teknologi **RAG (Retrieval-Augmented Generation)**. Tersedia dalam 3 mode: **Sidebar Widget**, **Streamlit Web UI**, dan **CLI Terminal**.

Ditenagai oleh **Groq Cloud API** dengan model `openai/gpt-oss-120b`.

---

## 🚀 Fitur Utama

- **RAG (Retrieval-Augmented Generation)** — Jawaban berdasarkan dokumen perusahaan, bukan halusinasi
- **Sidebar Chat Widget** — Bisa di-embed di website manapun via `<script>` tag
- **Streaming Real-time** — Respon muncul kata per kata secara instan
- **Upload Dokumen Dinamis** — Upload PDF/TXT untuk dianalisis AI selama sesi chat
- **Riwayat Tersimpan** — Chat history tersimpan di browser (localStorage)
- **Quick Replies** — Tombol shortcut pertanyaan umum
- **Eskalasi ke Manusia** — Redirect ke WhatsApp jika bot tidak bisa jawab
- **Feedback per Jawaban** — 👍👎 untuk track kualitas jawaban
- **Desain Premium** — Glassmorphism dark mode + animasi halus

---

## 🛠️ Persiapan

### 1. Dapatkan API Key Groq
Daftar gratis di **[Groq Console](https://console.groq.com/)**.

### 2. Konfigurasi `.env`
```bash
cp .env.example .env
```
Edit `.env` dan masukkan API Key:
```env
GROQ_API_KEY=gsk_IsiDenganApiKeyGroqAnda
```

### 3. Setup Virtual Environment & Install
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 🎮 Cara Menjalankan

### A. Sidebar Widget (⭐ Utama)

Jalankan API server:
```powershell
.\.venv\Scripts\python.exe api.py
```

Lalu buka demo page:
```
http://localhost:8000/widget/index.html
```

**Untuk embed di website Anda**, tambahkan sebelum `</body>`:
```html
<!-- Lexa Chat Widget -->
<link rel="stylesheet" href="http://localhost:8000/widget/lexa-widget.css">
<script src="http://localhost:8000/widget/lexa-widget.js"></script>
<script>LexaWidget.init({ apiUrl: 'http://localhost:8000' });</script>
```

### B. Streamlit Web UI
```powershell
.\.venv\Scripts\streamlit.exe run app.py
```

### C. CLI Terminal
```powershell
.\.venv\Scripts\python.exe main.py
```

---

## 🌐 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/health` | Status server |
| `GET` | `/config` | Konfigurasi widget (welcome message, quick replies) |
| `POST` | `/chat` | Kirim pesan (non-streaming) |
| `POST` | `/chat/stream` | Kirim pesan (SSE streaming) |
| `POST` | `/chat/reset` | Reset sesi chat |

---

## 📁 Struktur Proyek

```text
CHATBOT LEXA/
├── core/                           # Logika utama
│   ├── __init__.py
│   ├── config.py                   # Config management terpusat
│   ├── llm.py                      # LLM & orkestrasi Groq API
│   └── rag.py                      # RAG pipeline & chunking
├── widget/                         # Sidebar chat widget
│   ├── index.html                  # Demo page
│   ├── lexa-widget.css             # Styling widget
│   └── lexa-widget.js              # Logic widget
├── knowledge_base/                 # Basis pengetahuan
│   ├── features.md
│   └── pricing.md
├── tests/                          # Script pengujian
│   ├── scratch_pdf_test.py
│   └── scratch_rag_test.py
├── api.py                          # FastAPI backend (Widget)
├── app.py                          # Streamlit Web UI
├── main.py                         # CLI Terminal
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```
