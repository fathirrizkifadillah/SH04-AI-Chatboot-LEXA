import os
import asyncio
import logging
from groq import AsyncGroq
from core.database import SessionLocal, ChatSession, UnansweredQuery
from core.settings import SettingsManager

logger = logging.getLogger("lexa")

class LexaChatbot:
    """
    Kelas utama untuk chatbot customer service Lexa menggunakan Groq API.
    """
    def __init__(
        self,
        session_id=None,
        system_instruction=None,
        model="openai/gpt-oss-120b",
        vision_model="qwen/qwen3.8-27b",
        rag_pipeline=None,
        max_history_turns=10,
    ):
        # Mengambil API key dari environment variable (.env)
        self.api_key = os.getenv("GROQ_API_KEY", "").strip()
        
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY belum diset. Tambahkan di file .env Anda."
            )
            
        # Inisialisasi client Groq (async)
        self.client = AsyncGroq(api_key=self.api_key)
        self.model = model
        self.vision_model = vision_model
        self.rag_pipeline = rag_pipeline
        self.max_history_turns = max_history_turns
        self.last_references = []
        self.session_id = session_id or "default"
        
        # Menggunakan system prompt dari SettingsManager
        self.default_system_instruction = SettingsManager.get_settings().get("system_prompt", "Anda adalah asisten AI.")
        
        self.system_instruction = system_instruction or self.default_system_instruction
        self.history = []
        self._load_history()

    def _load_history(self):
        """Memuat riwayat chat dari database PostgreSQL."""
        db = SessionLocal()
        try:
            session = db.query(ChatSession).filter(ChatSession.session_id == self.session_id).first()
            if session and session.history:
                self.history = session.history
            else:
                self.reset_chat(save=False)
        finally:
            db.close()

    def _save_history(self):
        """Menyimpan riwayat chat saat ini ke database PostgreSQL."""
        db = SessionLocal()
        try:
            session = db.query(ChatSession).filter(ChatSession.session_id == self.session_id).first()
            if not session:
                session = ChatSession(session_id=self.session_id, history=self.history)
                db.add(session)
            else:
                # Tetapkan list baru agar SQLAlchemy mendeteksi perubahan JSON
                session.history = list(self.history)
            db.commit()
        finally:
            db.close()

    def reset_chat(self, save=True):
        """Mengosongkan riwayat percakapan dan menetapkan ulang System Prompt."""
        self.history = [
            {"role": "system", "content": self.system_instruction}
        ]
        self.last_references = []
        if save:
            self._save_history()

    def _trim_history(self):
        """Batasi riwayat chat per sesi agar tidak menumpuk token."""
        max_messages = self.max_history_turns * 2
        if len(self.history) > 1 + max_messages:
            self.history = [self.history[0]] + self.history[-max_messages:]
            self._save_history()

    def _log_unanswered_query(self, message: str):
        """Mencatat pertanyaan yang tidak ditemukan di RAG ke database."""
        db = SessionLocal()
        try:
            query = UnansweredQuery(session_id=self.session_id, user_query=message)
            db.add(query)
            db.commit()
        finally:
            db.close()

    def _prepare_messages(self, message: str, image_data_url: str = None) -> list:
        """
        Melakukan pencarian RAG (jika diaktifkan) dan menyisipkan konteks dokumen
        ke dalam system prompt sementara untuk pemanggilan model.
        Mendukung multimodal vision jika image_data_url disertakan.
        """
        self.last_references = []
        context_str = ""

        # Lakukan pencarian RAG jika pipeline tersedia (hanya jika query teks relevan)
        if self.rag_pipeline and not image_data_url:
            from core.config import Config
            results = self.rag_pipeline.search(message, top_k=Config.RAG_TOP_K, threshold=Config.RAG_THRESHOLD)
            self.last_references = results
            
            if results:
                context_str = (
                    "\n\n[DOKUMEN REFERENSI BASIS PENGETAHUAN]\n"
                    "Gunakan informasi di bawah ini untuk menjawab pertanyaan pelanggan. "
                    "Jawab secara jujur berdasarkan referensi ini saja. "
                    "Jika informasi tidak ada di referensi, jawablah jujur bahwa informasi "
                    "belum tersedia dan arahkan ke info@lexatech.id atau +62 853 2013 2014.\n\n"
                )
                for i, res in enumerate(results):
                    chunk = res["chunk"]
                    source = chunk["metadata"]["source"]
                    doc_title = chunk["metadata"]["document_title"]
                    context_str += f"Dokumen #{i+1} | Sumber: {source} ({doc_title}):\n{chunk['content']}\n---\n\n"
            else:
                self._log_unanswered_query(message)
                context_str = (
                    "\n\n[CATATAN SISTEM]\n"
                    "Tidak ditemukan informasi relevan di basis pengetahuan untuk pertanyaan ini. "
                    "Jawab jujur bahwa informasi spesifik tersebut belum tersedia di dokumentasi kami. "
                    "Arahkan pelanggan ke info@lexatech.id atau +62 853 2013 2014 untuk informasi lebih lanjut. "
                    "JANGAN mengarang jawaban.\n"
                )

        # Refresh system instruction from settings if updated
        dynamic_prompt = SettingsManager.get_settings().get("system_prompt")
        if dynamic_prompt:
            self.system_instruction = dynamic_prompt

        # Buat salinan riwayat chat yang valid untuk dikirim ke API Groq (OpenAI format)
        messages_to_send = []
        has_system = False
        
        for msg in self.history:
            role = msg.get("role", "user")
            content = str(msg.get("content", ""))
            
            # Map role custom agar sesuai format Groq/OpenAI (hanya system, user, assistant)
            if role in ("admin", "bot"):
                role = "assistant"
            elif role not in ("system", "user", "assistant"):
                continue
                
            # Filter internal system markers seperti [HANDOFF REQUESTED]
            if role == "system" and (content.startswith("[HANDOFF") or content.startswith("[CATATAN SISTEM]")):
                continue
                
            if role == "system":
                if not has_system:
                    messages_to_send.append({
                        "role": "system", 
                        "content": (self.system_instruction or "Anda adalah asisten AI.") + context_str
                    })
                    has_system = True
                continue
                
            clean_content = content.strip()
            if not clean_content:
                continue

            messages_to_send.append({"role": role, "content": clean_content})
            
        if not has_system:
            messages_to_send.insert(0, {
                "role": "system",
                "content": (self.system_instruction or "Anda adalah asisten AI.") + context_str
            })

        # Inject multimodal vision image_url to the current user message turn
        if image_data_url:
            for i in range(len(messages_to_send) - 1, -1, -1):
                if messages_to_send[i]["role"] == "user":
                    user_text = messages_to_send[i]["content"]
                    messages_to_send[i]["content"] = [
                        {"type": "text", "text": str(user_text)},
                        {"type": "image_url", "image_url": {"url": image_data_url}}
                    ]
                    break
            
        return messages_to_send

    async def send_message(self, message: str, image_data_url: str = None) -> str:
        """
        Mengirim pesan ke Groq API dan menyimpan percakapan ke dalam riwayat.
        Mengembalikan jawaban model dalam bentuk string utuh.
        """
        self._load_history()
        self.history.append({"role": "user", "content": message})
        self._save_history()
        messages_to_send = self._prepare_messages(message, image_data_url=image_data_url)
        model_to_use = self.vision_model if image_data_url else self.model
        
        max_retries = 3
        backoff_delay = 0.5
        chat_completion = None
        last_error = None

        for attempt in range(max_retries):
            try:
                chat_completion = await self.client.chat.completions.create(
                    messages=messages_to_send,
                    model=model_to_use,
                )
                break
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "invalid_api_key" in err_str or "model_not_found" in err_str:
                    break
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Groq API request failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {backoff_delay}s..."
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2

        if chat_completion is None:
            if self.history and self.history[-1]["role"] == "user":
                self.history.pop()
                self._save_history()
            raise RuntimeError(f"Gagal memproses request ke Groq API: {last_error}")

        reply = chat_completion.choices[0].message.content
        self.history.append({"role": "assistant", "content": reply})
        self._save_history()
        self._trim_history()
        return reply

    async def send_message_stream(self, message: str, file_metadata: dict = None, image_data_url: str = None):
        """
        Mengirim pesan ke Groq API dan menghasilkan (yield) jawaban per kata/token
        secara streaming (real-time). Mendukung vision multimodal jika image_data_url dikirimkan.
        """
        self._load_history()
        user_msg = {"role": "user", "content": message}
        if file_metadata:
            user_msg["file"] = file_metadata
        self.history.append(user_msg)
        self._save_history()
        messages_to_send = self._prepare_messages(message, image_data_url=image_data_url)
        model_to_use = self.vision_model if image_data_url else self.model
        
        max_retries = 3
        backoff_delay = 0.5
        stream = None

        for attempt in range(max_retries):
            try:
                stream = await self.client.chat.completions.create(
                    messages=messages_to_send,
                    model=model_to_use,
                    stream=True,
                )
                break
            except Exception as e:
                err_str = str(e).lower()
                if "invalid_api_key" in err_str or "model_not_found" in err_str:
                    if self.history and self.history[-1]["role"] == "user":
                        self.history.pop()
                        self._save_history()
                    raise RuntimeError(f"Gagal memproses stream request ke Groq API: {e}")
                if attempt < max_retries - 1:
                    logger.warning(
                        f"Groq API stream failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {backoff_delay}s..."
                    )
                    await asyncio.sleep(backoff_delay)
                    backoff_delay *= 2
                else:
                    if self.history and self.history[-1]["role"] == "user":
                        self.history.pop()
                        self._save_history()
                    raise RuntimeError(f"Gagal memproses stream request ke Groq API: {e}")

        if stream is None:
            raise RuntimeError("Gagal mendapatkan stream dari Groq API")

        try:
            full_reply = ""
            async for chunk in stream:
                content = chunk.choices[0].delta.content or ""
                full_reply += content
                yield content
                
            self.history.append({"role": "assistant", "content": full_reply})
            self._save_history()
            self._trim_history()
            
        except Exception as e:
            if self.history and self.history[-1]["role"] == "user":
                self.history.pop()
                self._save_history()
            raise RuntimeError(f"Gagal memproses stream response: {e}")
