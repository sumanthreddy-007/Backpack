# Backpack

A local-first student productivity workspace for notes, Gmail organization, deadlines and PDF tools.

## Quick start

### Backend
1. Create PostgreSQL database `backpack`.
2. Run `schema.sql`.
3. Copy `backend/.env.example` to `backend/.env` and fill in the database password.
4. Put your Google OAuth desktop client JSON at `backend/credentials.json`.
5. Install dependencies: `pip install -r backend/requirements.txt`.
6. Run: `uvicorn main:app --reload` from `backend/`.

### Frontend
From `frontend/`:

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Gmail setup
See **Connect → First-time setup** inside Backpack. Gmail access is readonly. Use **Change account** there to remove the local OAuth token and authorize another Google account.

## Privacy
See `docs/PRIVACY.md` and the in-app Privacy page.

Never commit `credentials.json`, `token.json` or `.env`.
