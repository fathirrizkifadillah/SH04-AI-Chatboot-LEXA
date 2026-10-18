import gradio as gr
import uvicorn
from api import app as fastapi_app

try:
    import spaces
    HAS_SPACES = True
except ImportError:
    HAS_SPACES = False

# ZeroGPU watchdog Hugging Face mewajibkan minimal satu fungsi dengan @spaces.GPU
if HAS_SPACES:
    @spaces.GPU
    def zerogpu_worker(text: str = "ping"):
        return f"ZeroGPU Worker Active: {text}"
else:
    def zerogpu_worker(text: str = "ping"):
        return f"Worker Active: {text}"

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
    with gr.Row():
        test_in = gr.Textbox(value="ping", visible=False)
        test_out = gr.Textbox(visible=False)
        test_btn = gr.Button("ZeroGPU Check", visible=False)
        test_btn.click(fn=zerogpu_worker, inputs=test_in, outputs=test_out)

# Mount Gradio ke FastAPI di path /gradio
# Semua endpoint REST & WebSocket FastAPI tetap berada di root / (/api/chat, /api/admin, dll)
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
