@echo off
echo ===================================================
echo           MEMULAI LEXA CHATBOT SYSTEM
echo ===================================================
echo.

echo [1/3] Menjalankan Backend (FastAPI)...
start "LEXA Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && uvicorn api:app --reload --port 8000"

echo [2/3] Menjalankan Frontend Klien (Widget)...
start "LEXA Klien Widget" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo [3/3] Menjalankan Dashboard Admin...
start "LEXA Admin Dashboard" cmd /k "cd /d %~dp0\admin_dashboard && npm run dev -- --port 5174"

echo.
echo Selesai! Tiga jendela terminal baru telah terbuka.
echo - Buka Dashboard Admin di: http://localhost:5174
echo - Buka Klien (Pura-pura jadi user) di: http://localhost:5173
echo.
pause
