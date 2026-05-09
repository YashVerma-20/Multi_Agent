import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import os
import sys
import traceback
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from groq import AsyncGroq

# 1. Setup Environment
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# 2. Configure AI Clients
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# 3. Models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    provider: str = "gemini" 
    model: str = "gemini-1.5-flash"

class ChatResponse(BaseModel):
    response: str
    provider: str

# 4. FastAPI Setup
app = FastAPI(title="Meta-Agent OS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. Core Logic
async def generate_response(request: ChatRequest) -> str:
    try:
        model_name = request.model
        
        if request.provider == "gemini":
            if not GEMINI_API_KEY:
                return "Error: Gemini API Key not set in .env"
            
            if not model_name or "gemini" not in model_name:
                model_name = "gemini-1.5-flash"
                
            model = genai.GenerativeModel(model_name)
            # Format history for Gemini
            history = [{"role": "user" if m.role == "user" else "model", "parts": [m.content]} for m in request.messages[:-1]]
            chat = model.start_chat(history=history)
            response = await chat.send_message_async(request.messages[-1].content)
            return response.text

        elif request.provider == "groq":
            if not groq_client:
                return "Error: Groq API Key not set in .env"
            
            if not model_name or "llama" not in model_name:
                model_name = "llama-3.1-8b-instant"
            
            groq_messages = [{"role": m.role, "content": m.content} for m in request.messages]
            response = await groq_client.chat.completions.create(
                model=model_name,
                messages=groq_messages,
                temperature=0.7,
            )
            return response.choices[0].message.content

        return "Unknown provider."
    except Exception as e:
        traceback.print_exc()
        return f"AI Error: {str(e)}"

# 6. Endpoints
@app.get("/")
async def root():
    return {"status": "Backend Online"}

@app.post("/chat/completions", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # This captures the request from your UI
    reply = await generate_response(request)
    return ChatResponse(response=reply, provider=request.provider)

if __name__ == "__main__":
    import uvicorn
    print(f"--- STARTING META-AGENT OS ---")
    print(f"Gemini Key: {'LOADED' if GEMINI_API_KEY else 'MISSING'}")
    print(f"Groq Key:   {'LOADED' if GROQ_API_KEY else 'MISSING'}")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)