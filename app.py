import streamlit as st
from llm import LexaChatbot

# Konfigurasi Halaman
st.set_page_config(
    page_title="Lexa Chatbot - CS Assistant", 
    page_icon="💬", 
    layout="centered"
)

st.markdown("""
    <style>
    .main {
        background-color: #f8fafc;
    }
    .stButton>button {
        border-radius: 8px;
        background-color: #ef4444;
        color: white;
        border: none;
        transition: 0.3s;
    }
    .stButton>button:hover {
        background-color: #dc2626;
        color: white;
    }
    h1 {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        color: #0f172a;
    }
    </style>
""", unsafe_allow_html=True) 


# Sidebar untuk opsi tambahan
with st.sidebar:
    st.image("https://img.icons8.com/fluent/96/000000/bot.png", width=80)
    st.title("Lexa CS Control Panel")
    st.write("Gunakan tombol di bawah untuk menyetel ulang percakapan jika diperlukan.")
    
    # Tombol Reset Chat
    if st.button("Reset Percakapan", use_container_width=True):
        if "chatbot" in st.session_state:
            st.session_state.chatbot.reset_chat()
        st.rerun()

# Header Utama
st.title("💬 Lexa Customer Service")
st.caption("Asisten Customer Service Interaktif berbasis Groq API (gpt-oss-120b)")
st.write("---")

# Inisialisasi Chatbot dalam Session State agar history chat terjaga saat refresh
if "chatbot" not in st.session_state:
    try:
        # Chatbot akan membaca API key dari .env Anda secara otomatis
        st.session_state.chatbot = LexaChatbot()
    except Exception as e:
        st.error(f"Gagal menginisialisasi Chatbot: {e}")
        st.info("Silakan periksa apakah 'GROQ API KEY' sudah didefinisikan dengan benar di file `.env` Anda.")
        st.stop()

# Menampilkan riwayat chat yang tersimpan (melewati system prompt indeks ke-0)
for message in st.session_state.chatbot.history:
    if message["role"] == "system":
        continue
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Form Input untuk User
if prompt := st.chat_input("Ada yang bisa saya bantu hari ini?"):
    # Tampilkan input user secara instan ke UI
    with st.chat_message("user"):
        st.markdown(prompt)

    # Tampilkan respon bot secara streaming (real-time)
    with st.chat_message("assistant"):
        response_placeholder = st.empty()
        full_response = ""
        
        try:
            # Memanggil generator stream dari llm.py
            for chunk in st.session_state.chatbot.send_message_stream(prompt):
                full_response += chunk
                response_placeholder.markdown(full_response + "▌")
            # Tampilkan respon akhir tanpa kursor ketik
            response_placeholder.markdown(full_response)
        except Exception as e:
            st.error(f"Terjadi kesalahan saat memproses jawaban: {e}")
