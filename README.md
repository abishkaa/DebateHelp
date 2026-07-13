# DebateHelp

DebateHelp is a full-stack debate training app with real argument analysis, live debate sessions, coaching notes, team/workspace features, and the Stitch-inspired neon interface.

## Local development

The easiest way to run the app locally is from the frontend folder:

```powershell
cd frontend
npm install
npm run dev
```

During local development, Vite proxies `/api` to `http://localhost:8001`. If the backend is not already running, the Vite config starts it automatically with:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

The dev server now waits for `http://127.0.0.1:8001/health/backend` before reporting the backend as ready.

## Manual backend run

If you want to run the backend yourself:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Then open:

```text
http://localhost:5173
```

## Useful checks

```powershell
cd frontend
npm run build
```

```powershell
.\.venv\Scripts\python.exe -m compileall -q services models routers main.py database.py security.py
```

## Important environment variables

Production should include:

- `FRONTEND_URL`
- `CORS_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- database/auth secrets required by the backend

For local development, the Vite auto-start helper provides safe localhost CORS defaults when those variables are not already set.
