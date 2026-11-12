# ChatSphere AI

A Gemini-powered chat app: streaming replies, saved conversations, persistent
(user-controlled) memory, and browser-native voice input/output.

**Stack:** React + Vite + Tailwind + react-markdown + lucide-react · FastAPI +
Google Gen AI SDK + SQLAlchemy + SQLite + Pydantic + HTTPX · SSE streaming ·
Web Speech API.

## Run it

Needs Python 3.10+, Node 18+, and a Gemini API key from Google AI Studio.

Terminal 1, backend:

    cd backend
    python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env          # then set GEMINI_API_KEY (and check GEMINI_MODEL)
    uvicorn app.main:app --reload --port 8000

Terminal 2, frontend:

    cd frontend
    npm install
    npm run dev                   # open http://localhost:5173

Quick checks: `http://localhost:8000/api/health` should return
`"gemini_configured": true`; interactive API docs are at `http://localhost:8000/docs`.

If you get a model error, set `GEMINI_MODEL` in `backend/.env` to a model name
currently listed in Google AI Studio and restart the backend.

## Tests

    cd backend  && python3 -m unittest discover -s tests -t . -v    # sensitive-data filter, titles
    cd frontend && npm test                                         # SSE parser, speech-text helpers

## Layout

    backend/app/
      main.py            app + CORS + startup (creates tables)
      config.py          settings from environment (.env)
      routes/            health, conversations, chat (SSE), memory, settings
      services/          ai.py (Gemini), chat.py (one turn), memory.py, text.py
      models/            Conversation, Message, Memory, UserSettings
      schemas/           Pydantic request/response models
      db/                engine + session (swap DATABASE_URL for PostgreSQL later)
    frontend/src/
      App.jsx            state + wiring
      components/        Sidebar, ChatWindow, MessageBubble, Composer, MemoryPanel, ConfirmDialog
      hooks/             useSpeechRecognition, useSpeechSynthesis
      services/api.js    every backend call, including the SSE stream reader
      utils/             sse.js, speechText.js (pure, unit-tested)

## How memory works

- Stored in its own table, separate from messages. After each reply, one extra
  Gemini call looks at *your* message and may save up to 3 durable facts
  (preferences, response style, interests, useful context). It does not save chat
  messages wholesale.
- Saved memories are injected into the system prompt on later turns (all of them
  if there are 12 or fewer, otherwise the most relevant 12).
- Anything that looks like a password, key, card/ID number, etc. is rejected by a
  pattern filter, for both automatic and manually added memories. This filter is
  a safeguard, not a guarantee.
- Brain icon in the header: view, add, edit, delete, delete all, or switch memory
  off (nothing is saved or used while it is off).

## Known limitations

- JWT-based user authentication with secure password hashing.
- User-specific conversations, chat history, and memories.
- Protected API endpoints with authentication and access controls.
- Multi-user data isolation.
- Tables are created automatically; there are no migrations yet (add Alembic
  before changing the schema on a database you care about).
- Voice input uses the browser's speech recognition: Chrome/Edge/Safari only, and
  Chrome sends audio to Google's service to transcribe it. Firefox shows a text-only
  fallback. Spoken output uses the voices installed on your device.
- Code blocks are styled but have no syntax highlighting or per-block copy button.
- Memory extraction adds one Gemini request per message (messages under 12
  characters are skipped), which counts toward your rate limit.
- Regenerate replaces the previous answer; the old one is not kept.
