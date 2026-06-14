# Study Assistant
 
A conversational AI assistant that helps students understand homework and study material. Instead of giving direct answers, it explains concepts in simple terms, offers hints, and guides the student toward solving the problem themselves.
 
## What it does
 
- Student types a question or pastes a homework problem
- Assistant explains the concept behind it in simple language
- Hints mode gives step-by-step nudges without revealing the full answer
- Automatically adjusts tone for different subjects (math, history, science, etc.)
- Supports follow-up questions so students can ask "why?" or "explain differently"
## Architecture
 
```
Frontend / Postman → Backend (Node.js or Python) → Claude API → AI response
```
 
## Tech stack
 
- **Frontend**: Simple chat UI (HTML/CSS/JS) or Postman for testing
- **Backend**: Node.js or Python
- **AI**: Anthropic Claude API
