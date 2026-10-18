import gradio as gr
import uvicorn
from api import app as fastapi_app

# UI Status informatif untuk landing page Space di /gradio
with gr.Blocks(title="Lexa AI Platform API") as demo:
    gr.Markdown(
        """
        # 🤖 Lexa AI Platform — Backend API Server
        Status: **🟢 Online & Active**
        
        Backend server untuk **Lexa Chatbot Widget** dan **Admin Dashboard**.
        
        - 📖 **API Documentation (Swagger UI)**: [/docs](/docs)
        - 🩺 **Health Check**: [/health](/health)
        """
    )

# Mount Gradio ke FastAPI di path /gradio
# Semua endpoint REST & WebSocket FastAPI tetap berada di root / (/api/chat, /api/admin, dll)
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
