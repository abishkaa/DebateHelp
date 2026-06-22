# Debate Coach - AI Argument Challenger

An AI-powered debate coach that challenges your arguments using real evidence through a ReAct agent architecture. Built for the ISSAI Software Development Track as a university passion project.

## 🏛️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React UI      │────▶│  FastAPI Backend │────▶│  PostgreSQL DB  │
│   (Vite)        │◀────│  (Python)        │◀────│  (Chat History) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Oylan API      │
                       │   (ISSAI LLM)    │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Brave Search   │
                       │   (Web Search)   │
                       └──────────────────┘
```

### Key Components

**Backend (FastAPI)**
- `main.py` - Application entry point with CORS middleware
- `database.py` - SQLAlchemy async database configuration
- `models/message.py` - PostgreSQL ORM models (Message, Session)
- `services/oylan.py` - Oylan API integration + ReAct agent loop + tools
- `services/chat.py` - Database operations for chat history
- `services/chat_service.py` - Business logic layer
- `routers/chat.py` - API endpoints (`/chat`, `/history/{session_id}`)

**Frontend (React + Vite)**
- `src/App.jsx` - Main application component with state management
- `src/index.css` - Manuscript-themed styling (parchment, leather, gold)
- Session persistence via localStorage

**ReAct Agent Pattern**
The agent uses a text-based tool-calling protocol since Oylan doesn't support native function calling:
1. LLM responds with `TOOL: tool_name("argument")` when it needs to use a tool
2. Python backend parses this line and executes the actual tool
3. Tool result is fed back into the conversation
4. Loop continues until LLM provides a plain-text final answer

**Tools Available:**
- `search_counterarguments(topic)` - Find opposing viewpoints via Brave Search
- `check_facts(claim)` - Verify factual claims
- `suggest_sources(topic)` - Find credible academic sources

## 📋 Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+
- Oylan API credentials (from ISSAI)
- Brave Search API key (optional, for real web search)

## 🚀 Setup Instructions

### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (with Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Step 2: Create Database and User

```bash
# Switch to postgres user
sudo -i -u postgres

# Enter psql
psql

# Inside psql, run:
CREATE DATABASE debate_coach;
CREATE USER debate_user WITH PASSWORD 'debate_pass';
GRANT ALL PRIVILEGES ON DATABASE debate_coach TO debate_user;
\q

# Exit postgres user
exit
```

### Step 3: Set Environment Variables

Create a `.env` file in the project root:

```env
# Oylan API Configuration
OYLAN_API_KEY=your_oylan_api_key_here
OYLAN_ASSISTANT_ID=your_assistant_id_here
OYLAN_BASE_URL=https://oylan.nu.edu.kz/api/v1

# Database Configuration
DATABASE_URL=postgresql+asyncpg://debate_user:debate_pass@localhost:5432/debate_coach

# Brave Search API (Optional - for real web search)
BRAVE_API_KEY=your_brave_api_key_here
```

### Step 4: Install Backend Dependencies

```bash
cd ~/DebateHelp
pip install -r requirements.txt
```

### Step 5: Initialize Frontend

```bash
cd ~/DebateHelp/frontend
npm install
```

## 🏃 Running the Application

### Terminal 1: Start Backend

```bash
cd ~/DebateHelp
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Terminal 2: Start Frontend

```bash
cd ~/DebateHelp/frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🧪 Testing the Backend

Test the health endpoint:
```bash
curl http://localhost:8000/health
```

Test the root endpoint:
```bash
curl http://localhost:8000/
```

Test the chat endpoint (replace session_id with a UUID):
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Social media improves mental health.",
    "session_id": "test-session-123",
    "difficulty": "Normal"
  }'
```

Test the history endpoint:
```bash
curl http://localhost:8000/history/test-session-123
```

## 📁 Project Structure

```
DebateHelp/
├── main.py                 # FastAPI app entry point
├── database.py             # Database configuration
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (create this)
├── README.md               # This file
│
├── models/
│   ├── __init__.py
│   ├── chat.py             # Pydantic models for API
│   └── message.py          # SQLAlchemy ORM models
│
├── routers/
│   ├── __init__.py
│   └── chat.py             # API route handlers
│
├── services/
│   ├── __init__.py
│   ├── oylan.py            # Oylan API + ReAct agent + tools
│   ├── chat.py             # Database service layer
│   └── chat_service.py     # Business logic
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx         # Main React component
        └── index.css       # Manuscript theme styles
```

## 🎨 UI Theme

The interface uses a "manuscript/ancient archive" aesthetic:
- **Parchment backgrounds** (#f5e6c8, #e8d4a8)
- **Leather-brown headers** (#5c4033, #3d2817)
- **Antique gold accents** (#c9a961, #dcc48a)
- **Scholarly citation footnotes** styled like academic references
- **Debate hall atmosphere** with elegant typography

## 🔧 Difficulty Levels

- **🕊️ Gentle**: Constructive feedback, mild counterarguments, encouraging tone
- **⚖️ Normal**: Balanced approach, solid evidence, respectful questioning
- **🔥 Aggressive**: Vigorous challenges, direct fallacy detection, rigorous demands

## 🗄️ Database Schema

**sessions** table:
- `id` (VARCHAR, PK) - Session UUID
- `difficulty` (VARCHAR) - Selected difficulty level
- `created_at` (TIMESTAMP) - Session creation time

**messages** table:
- `id` (INTEGER, PK) - Message ID
- `session_id` (VARCHAR, FK) - Reference to session
- `role` (VARCHAR) - "user" or "assistant"
- `content` (TEXT) - Message content
- `created_at` (TIMESTAMP) - Message timestamp

## 🐛 Troubleshooting

**Database connection error:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
```

**Oylan API errors:**
- Ensure `OYLAN_API_KEY` and `OYLAN_ASSISTANT_ID` are correct
- Check network connectivity to `oylan.nu.edu.kz`

**Frontend can't connect to backend:**
- Ensure backend is running on port 8000
- Check CORS settings in `main.py`
- Verify no firewall blocking localhost connections

**Brave Search not working:**
- The app works without Brave API (returns simulated results)
- To enable real search, get a key at https://brave.com/search/api/

## 📝 License

This project is part of the ISSAI Software Development Track coursework.

## 🙏 Acknowledgments

- ISSAI (International IT University) for the Oylan API
- Course instructors for guidance on Урок 5 (PostgreSQL integration)
