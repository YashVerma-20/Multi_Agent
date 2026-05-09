# Meta-Agent OS: Documentation

Meta-Agent OS is a sophisticated, full-stack AI orchestration platform designed to categorize user intent and instantiate specialized AI agents. It features a high-performance FastAPI backend with a modern React/Tailwind CSS frontend.

---

## 🏗️ System Architecture

### Backend (`src/main.py`)
- **Framework**: FastAPI (Python)
- **Database**: SQLite with `aiosqlite` for asynchronous conversation persistence.
- **Routing**: 
  - Uses **Groq (Llama-3.1-8b)** for rapid user intent classification.
  - Dynamically routes requests to specific system prompts based on category.
- **AI Models**: 
  - **Primary**: Google Gemini 1.5 Flash (via `google-generativeai` SDK).
  - **Fallback**: Groq Llama-3.1 if Gemini fails or for specific data tasks.
- **Endpoints**:
  - `POST /chat/completions`: Main conversation entry point.
  - `GET /history`: Retrieves all recent chat sessions.
  - `GET /history/{session_id}`: Loads full history for a specific session.
  - `DELETE /history/{session_id}`: Permanently deletes a chat session.

### Frontend (`frontend/`)
- **Core**: React 19 + Vite.
- **Styling**: Tailwind CSS v4 (configured via `@tailwindcss/postcss`).
- **Features**:
  - **AI Sandboxing**: Renders AI-generated HTML artifacts in a secured `iframe`.
  - **Dark Mode**: Native Tailwind v4 implementation with persistent system-matching toggle.
  - **Real-time History**: Dynamic sidebar with session deletion and agent-specific icons.
  - **Responsive Design**: Mobile-friendly sidebar and chat interface.

---

## 🧠 Specialized Agents

Meta-Agent OS instantiates specialized roles based on intent detection:

1. **Universal-UI-Architect-v1**:
   - **Role**: Builds frontend components.
   - **Constraints**: Strictly outputs pure HTML5/Tailwind (no React/JSX). Forces SVG sizing via system prompts and CSS "sledgehammer" overrides.
2. **Research-Analyst-v1**:
   - **Role**: Provides structured summaries and deep analysis.
3. **Data-Scientist-v1**:
   - **Role**: Statistical accuracy and mathematical logic (powered by Groq).
4. **General-Assistant-v1**:
   - **Role**: Helpful conversationalist for broad queries.

---

## 🛠️ Key Technical Solves

- **Localhost Networking**: Hardcoded `127.0.0.1` endpoints to bypass IPv4/IPv6 resolution mismatches common in modern browsers.
- **Security (CSP)**: Curated Content Security Policy in `index.html` to allow secure API and WebSocket connections.
- **SVG Constraint**: Implemented a two-pronged solution (System Prompt + `!important` CSS) to prevent AI-generated SVGs from breaking the layout.
- **V4 Dark Mode**: Implemented a custom variant (`@custom-variant dark`) in CSS to maintain theme performance without a traditional `tailwind.config.js`.

---

## 🚀 Getting Started

1. **Backend**:
   ```bash
   python -m src.main
   ```
2. **Frontend**:
   ```bash
   cd frontend && npm run dev
   ```
3. **Environment**:
   Requires a `.env` file with `GEMINI_API_KEY` and `GROQ_API_KEY`.
