import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import os
import sys
import traceback
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from groq import AsyncGroq
import aiosqlite

# 1. Setup Environment
# Look for .env in the parent directory of this file
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# 2. Configure AI Clients
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
groq_client = AsyncGroq(api_key=GROQ_API_KEY, timeout=120.0) if GROQ_API_KEY else None

# 3. Data Models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    provider: str = "gemini" 
    model: str = "gemini-2.5-flash"
    session_id: str = "default_session"

class ChatResponse(BaseModel):
    response: str
    provider: str
    selected_agent: str = "Default Agent"

# 4. FastAPI Setup
async def init_db():
    async with aiosqlite.connect("meta_os.db") as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS conversation_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                selected_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- STARTING META-AGENT OS ---")
    await init_db()
    yield

app = FastAPI(title="Meta-Agent OS", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def categorize_request(user_input: str) -> str:
    """Categorize the user intent into one of 4 predefined tasks."""
    if not groq_client: return "GENERAL"
    prompt = f"Categorize the following user request into exactly one of these categories: [CODING, RESEARCH, DATA_ANALYSIS, GENERAL]. Return ONLY the category name and nothing else.\nRequest: {user_input}"
    try:
        response = await groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=10
        )
        cat = response.choices[0].message.content.strip().upper()
        if "CODING" in cat: return "CODING"
        if "RESEARCH" in cat: return "RESEARCH"
        if "DATA_ANALYSIS" in cat: return "DATA_ANALYSIS"
        return "GENERAL"
    except Exception as e:
        print(f"Categorization Error: {e}")
        return "GENERAL"

def get_valid_gemini_model() -> str:
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods and 'gemini-2.5-flash' in m.name:
                return m.name
    except Exception as e:
        print(f"Error listing Gemini models: {e}")
    return 'models/gemini-2.5-flash'

# 5. Core AI Logic
async def generate_response(request: ChatRequest) -> tuple[str, str, str]:
    try:
        user_message = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
        category = await categorize_request(user_message) if user_message else "GENERAL"
        
        selected_agent = ""
        provider = request.provider
        
        if category == "CODING":
            selected_agent = "Universal-UI-Architect-v1 (Gemini-2.5-Flash)"
            provider = "gemini"
            sys_instruct = "STRICT RULE: You are the Universal UI Architect Agent. Your directive is to write responsive, visually engaging frontend code for ANY industry requested using React and Tailwind CSS. Output ONLY the HTML/Tailwind code wrapped in a standard markdown code block starting exactly with ```html and ending with ```. You MUST press ENTER immediately after typing ```html. Introduce yourself briefly before the code block. CRITICAL UI RULE: You must NEVER generate raw <svg> tags without sizing classes. Every single <svg> element you generate MUST include Tailwind sizing classes, for example: class='w-6 h-6'. Failure to size SVGs will break the layout. CRITICAL FORMATTING RULE: You must output PURE, valid HTML5 only. Do NOT output React or JSX syntax. Use standard HTML comments (<!-- -->) and standard class attributes (class=), NEVER className=. Ensure all Tailwind utility classes are applied via standard HTML class attributes. Output must be a single, self-contained HTML snippet that can be rendered in an iframe."
        elif category == "RESEARCH":
            selected_agent = "Research-Analyst-v1 (Gemini-2.5-Flash)"
            provider = "gemini"
            sys_instruct = "You are a Senior Research Analyst. Provide structured summaries with key citations and objective analysis."
        elif category == "DATA_ANALYSIS":
            selected_agent = "Data-Scientist-v1 (Groq Llama-3.1)"
            provider = "groq"
            sys_instruct = "You are a Data Scientist. Focus on statistical accuracy, data structures, and mathematical logic."
        else: # GENERAL
            selected_agent = "General-Assistant-v1 (Groq Llama-3.1)"
            provider = "groq"
            sys_instruct = "You are a helpful General Assistant."

        if provider == "gemini":
            if not GEMINI_API_KEY:
                return "Error: Gemini API Key not set in .env", provider, selected_agent
            
            try:
                print(f"Attempting to call Gemini with model: models/gemini-2.5-flash")
                
                formatting_template = """You are a specialized agent dynamically instantiated by the Meta-Agent OS Orchestrator. Do NOT output backend code. You MUST format your very first introduction using exactly this Markdown structure:

### 🟢 [Insert Your Specific Agent Name] Initialized
**Status:** Online and ready.
---
I have been deployed by the Orchestrator. My core capabilities include:
* [Capability 1]: [Brief description]
* [Capability 2]: [Brief description]
---
**Awaiting Command:** [Ask the user for their specific input, data, or URL to begin.]

Ensure you strictly follow this layout for your introduction. Do not break character."""
                
                system_prompt = f"{sys_instruct}\n\n{formatting_template}"
                model = genai.GenerativeModel(
                    model_name='models/gemini-2.5-flash',
                    system_instruction=system_prompt
                )
                
                # Format history (Gemini expects 'model' instead of 'assistant')
                history = [{"role": "user" if m.role == "user" else "model", "parts": [m.content]} for m in request.messages[:-1]]
                chat = model.start_chat(history=history)
                
                # Use the async method for non-blocking FastAPI performance
                response = await chat.send_message_async(request.messages[-1].content, request_options={"timeout": 300.0})
                return response.text, provider, selected_agent
            except Exception as first_e:
                print(f"Gemini error: {first_e}. Attempting fallback...")
                try:
                    model_name = "models/gemini-1.5-flash"
                    print(f"Attempting to call Gemini with model: {model_name}")
                    model = genai.GenerativeModel(model_name=model_name, system_instruction=sys_instruct)
                    history = [{"role": "user" if m.role == "user" else "model", "parts": [m.content]} for m in request.messages[:-1]]
                    chat = model.start_chat(history=history)
                    response = await chat.send_message_async(request.messages[-1].content, request_options={"timeout": 300.0})
                    return response.text, provider, selected_agent
                except Exception as second_e:
                    print(f"Gemini fallback error: {second_e}")
                    return f"Gemini Error: {first_e} | Fallback Error: {second_e}", provider, selected_agent

        elif provider == "groq":
            if not groq_client:
                return "Error: Groq API Key not set in .env", provider, selected_agent
            
            formatting_template = """STRICT RULE: You are the Master Orchestrator. When a user makes a request, first classify their intent into one of four categories: BUILD (coding/creating), RESEARCH (data/analysis), AUDIT (security/testing), or STRATEGIZE (planning/business). If their request is specific, execute it. If it is broad or vague, generate a Human-in-the-Loop prompt offering 3 highly specialized agents specifically from that identified category. Format your response exactly like this:

### 🧠 Orchestrator Routing Required
Intent Detected: [Category]
I have analyzed your request. To proceed, I can instantiate one of the following specialists:

* Option 1: [Agent Name] - [Brief description]
* Option 2: [Agent Name] - [Brief description]
* Option 3: [Agent Name] - [Brief description]

Please reply with your selected option.

When instantiating an agent immediately, you are a specialized agent dynamically instantiated by the Meta-Agent OS Orchestrator. Do NOT output backend code. You MUST format your very first introduction using exactly this Markdown structure:

### 🟢 [Insert Your Specific Agent Name] Initialized
**Status:** Online and ready.
---
I have been deployed by the Orchestrator. My core capabilities include:
* [Capability 1]: [Brief description]
* [Capability 2]: [Brief description]
---
**Awaiting Command:** [Ask the user for their specific input, data, or URL to begin.]

Ensure you strictly follow this layout for your introduction. Do not break character."""
            
            groq_messages = [{"role": "system", "content": sys_instruct}] + [{"role": "user" if m.role == "user" else "assistant", "content": m.content} for m in request.messages]
            system_message = {"role": "system", "content": formatting_template}
            groq_messages.insert(0, system_message)
            response = await groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=groq_messages,
                temperature=0.7,
            )
            return response.choices[0].message.content, provider, selected_agent

        return "Unknown provider.", provider, selected_agent
    except Exception as e:
        # This will print the full error stack to your terminal for debugging
        print("--- AI EXECUTION ERROR ---")
        traceback.print_exc()
        return f"AI Error: {str(e)}", "unknown", "Error-Agent"

# 6. API Endpoints
@app.get("/")
async def root():
    return {"status": "Meta-Agent OS Backend Running"}

@app.post("/chat/completions", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    user_msg = request.messages[-1].content if request.messages else ""
    
    async with aiosqlite.connect("meta_os.db") as db:
        await db.execute(
            "INSERT INTO conversation_memory (session_id, role, content) VALUES (?, ?, ?)",
            (request.session_id, "user", user_msg)
        )
        await db.commit()

    reply, provider, agent_name = await generate_response(request)
    
    async with aiosqlite.connect("meta_os.db") as db:
        await db.execute(
            "INSERT INTO conversation_memory (session_id, role, content, selected_agent) VALUES (?, ?, ?, ?)",
            (request.session_id, "model", reply, agent_name)
        )
        await db.commit()

    return ChatResponse(response=reply, provider=provider, selected_agent=agent_name)

@app.get("/history")
async def get_history():
    async with aiosqlite.connect("meta_os.db") as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute('''
            SELECT 
                session_id,
                MAX(created_at) as last_active,
                (SELECT content FROM conversation_memory c2 WHERE c2.session_id = c1.session_id AND role='user' ORDER BY created_at ASC LIMIT 1) as title,
                (SELECT selected_agent FROM conversation_memory c3 WHERE c3.session_id = c1.session_id AND role='model' AND selected_agent IS NOT NULL ORDER BY created_at DESC LIMIT 1) as agent
            FROM conversation_memory c1
            GROUP BY session_id
            ORDER BY last_active DESC
        ''')
        rows = await cursor.fetchall()
        return [{"session_id": r["session_id"], "title": r["title"] or "New Chat", "agent": r["agent"]} for r in rows]

@app.get("/history/{session_id}")
async def get_session_history(session_id: str):
    async with aiosqlite.connect("meta_os.db") as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT role, content, selected_agent, created_at FROM conversation_memory WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

@app.delete("/history/{session_id}")
async def delete_session(session_id: str):
    async with aiosqlite.connect("meta_os.db") as db:
        await db.execute("DELETE FROM conversation_memory WHERE session_id = ?", (session_id,))
        await db.commit()
    return {"status": "deleted"}

# 7. Entry Point
if __name__ == "__main__":
    import uvicorn
    print(f"--- STARTING META-AGENT OS ---")
    print(f"Gemini Key: {'LOADED' if GEMINI_API_KEY else 'MISSING'}")
    print(f"Groq Key:   {'LOADED' if GROQ_API_KEY else 'MISSING'}")
    print(f"Server Path: {os.path.abspath(__file__)}")
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)