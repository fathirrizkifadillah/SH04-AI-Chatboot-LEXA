# Chatbot Customer Service - Lexa 💬

Lexa adalah chatbot asisten customer service yang dirancang untuk membantu menjawab pertanyaan pelanggan secara ramah, sopan, dan profesional. Proyek ini menggunakan **Groq Cloud API** dengan antarmuka berbasis **Streamlit** (UI) dan **Terminal (CLI)**.

---

## 🛠️ Persiapan Awal

### 1. Dapatkan API Key Groq
Chatbot ini memerlukan API Key dari Groq Cloud. 
* Silakan daftar dan ambil API Key Anda secara gratis di: **[Groq Console](https://console.groq.com/)**.

### 2. Bebas Memilih Model LLM
Secara default, chatbot ini dikonfigurasi menggunakan model **`llama-3.3-70b-versatile`** karena kecepatannya. Namun, Anda dibebaskan untuk mengganti model apa pun yang didukung oleh Groq (seperti `llama-3.1-8b-instant`, `gemma2-9b-it`, dll.) melalui inisialisasi kelas `LexaChatbot` di kode Anda.

---

## 🚀 Instalasi & Setup

Sangat disarankan untuk menggunakan **Virtual Environment (venv)** agar instalasi library tidak mengganggu sistem Python global Anda.

### 1. Masuk ke Folder Proyek
```bash
cd nama-folder-proyek
```

### 2. Buat dan Aktifkan Virtual Environment (venv)
Pilih perintah yang sesuai dengan Sistem Operasi Anda:

* **Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
* **Windows (CMD):**
  ```cmd
  python -m venv .venv
  .\.venv\Scripts\activate.bat
  ```
* **macOS / Linux:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### 3. Instal Semua Library (Requirements)
Jalankan perintah berikut untuk menginstal pustaka yang diperlukan (`groq`, `streamlit`, `python-dotenv`):
```bash
pip install -r requirements.txt
```

### 4. Konfigurasi Environment File (`.env`)
Buat file bernama `.env` di root folder proyek Anda, lalu masukkan API Key yang sudah Anda dapatkan sebelumnya:
```env
GROQ_API_KEY=gsk_IsiDenganApiKeyGroqAndaDiSini
```

---

## 🎮 Cara Menjalankan

### A. Uji Coba Lewat Terminal (CLI)
Jika ingin melakukan chatting secara cepat langsung dari terminal:
```bash
python main.py
```
*Ketik `keluar` atau `exit` untuk menyudahi percakapan.*

### B. Uji Coba Lewat Browser (Streamlit UI)
Untuk tampilan chat yang modern dan responsif menggunakan streaming teks:
```bash
streamlit run app.py
```
Aplikasi web akan otomatis terbuka di browser Anda pada alamat `http://localhost:8501`.
