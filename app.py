# MUST BE FIRST IMPORT FOR HUGGING FACE ZEROGPU
try:
    import spaces
except ImportError:
    class spaces:
        @staticmethod
        def GPU(func=None, duration=None):
            def decorator(f):
                return f
            return decorator if func is None else decorator(func)

# ZeroGPU scanner Hugging Face mendeteksi decorator @spaces.GPU secara statis di top level
@spaces.GPU(duration=60)
def zerogpu_worker(text: str = "ping"):
    return f"ZeroGPU Worker Active: {text}"

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
    with gr.Accordion("ZeroGPU Hardware Status", open=False):
        test_in = gr.Textbox(value="ping", label="Input")
        test_out = gr.Textbox(label="Output")
        test_btn = gr.Button("Check GPU Allocation")
        test_btn.click(fn=zerogpu_worker, inputs=test_in, outputs=test_out)

# Mount Gradio ke FastAPI di path /gradio
# Semua endpoint REST & WebSocket FastAPI tetap berada di root / (/api/chat, /api/admin, dll)
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
