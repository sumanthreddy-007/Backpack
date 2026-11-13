import os
import json

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from pdf_routes import router as pdf_router
from notes_routes import router as notes_router
from database import get_connection, save_email, get_all_email_training_rows, save_email_feedback
from gmail_service import get_gmail_service, extract_email_body, TOKEN_FILE
from scoring_service import calculate_score, get_priority, classify_email, refresh_classifier, CATEGORIES
from date_extractor import extract_dates, get_nearest_future_date, days_until

app = FastAPI(title="Backpack API")


@app.middleware("http")
async def reject_untrusted_browser_origins(request: Request, call_next):
    """Block cross-site browser requests to this local-only API."""
    origin = request.headers.get("origin")
    allowed = {"http://localhost:5173", "http://127.0.0.1:5173"}
    if origin and origin not in allowed:
        return JSONResponse(
            status_code=403,
            content={"detail": "Requests from this browser origin are not allowed."},
        )
    return await call_next(request)

app.include_router(pdf_router)
app.include_router(notes_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Backpack Running"}


@app.post("/gmail-credentials")
async def upload_gmail_credentials(file: UploadFile = File(...)):
    """Save a user's local Google OAuth Desktop-client JSON without exposing secrets to the UI."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Choose the OAuth client JSON downloaded from Google Cloud.")
    raw = await file.read(64 * 1024 + 1)
    if len(raw) > 64 * 1024:
        raise HTTPException(status_code=413, detail="OAuth configuration file is too large.")
    try:
        config = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="The selected file is not valid UTF-8 JSON.")
    installed = config.get("installed") if isinstance(config, dict) else None
    required = ("client_id", "client_secret", "auth_uri", "token_uri")
    if not isinstance(installed, dict) or any(not installed.get(key) for key in required):
        raise HTTPException(status_code=400, detail="Use an OAuth Client ID configured as a Desktop app.")
    destination = os.path.join(os.path.dirname(os.path.abspath(__file__)), "credentials.json")
    temporary = destination + ".tmp"
    try:
        with open(temporary, "w", encoding="utf-8") as output:
            json.dump(config, output)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)
    return {"message": "Google OAuth client configuration saved locally. You can now connect Gmail."}


@app.get("/connect-gmail")
def connect_gmail():
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId="me").execute()
        return {
            "email": profile["emailAddress"],
            "messages": profile.get("messagesTotal", 0),
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gmail connection failed: {exc}")


@app.post("/disconnect-gmail")
def disconnect_gmail():
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)
    return {"message": "Gmail account disconnected"}


def _header(headers, name):
    name = name.lower()
    for header in headers:
        if header.get("name", "").lower() == name:
            return header.get("value", "")
    return ""


def _analyse_message(service, message):
    headers = message.get("payload", {}).get("headers", [])
    subject = _header(headers, "Subject")
    sender = _header(headers, "From")
    date = _header(headers, "Date")
    body = extract_email_body(message.get("payload", {}))[:12000]

    category, confidence = classify_email(subject, sender, body)
    combined_text = f"{subject} {sender} {body}"
    score = calculate_score(combined_text)

    dates = extract_dates(combined_text)
    nearest_date = get_nearest_future_date(dates)
    if nearest_date:
        score += 30
        days = days_until(nearest_date)
        if days is not None:
            if days <= 7:
                score += 40
            elif days <= 14:
                score += 20

    return {
        "gmail_id": message["id"],
        "subject": subject or "(No subject)",
        "sender": sender,
        "body": body,
        "date": date,
        "dates": dates,
        "deadline": nearest_date,
        "category": category,
        "confidence": confidence,
        "score": score,
        "priority": get_priority(score),
    }


def sync_gmail_messages(max_results=100):
    service = get_gmail_service()
    refresh_classifier()

    max_results = max(1, min(int(max_results), 200))
    messages = []
    page_token = None

    while len(messages) < max_results:
        remaining = max_results - len(messages)
        response = service.users().messages().list(
            userId="me",
            maxResults=min(100, remaining),
            pageToken=page_token,
        ).execute()
        messages.extend(response.get("messages", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    analysed = []
    for item in messages[:max_results]:
        message = service.users().messages().get(
            userId="me",
            id=item["id"],
            format="full",
        ).execute()
        result = _analyse_message(service, message)
        save_email(
            gmail_id=result["gmail_id"],
            sender=result["sender"],
            subject=result["subject"],
            body=result["body"],
            category=result["category"],
            priority=result["priority"],
            score=result["score"],
            deadline=result["deadline"],
        )
        analysed.append(result)

    return analysed


@app.get("/sync-emails")
def sync_emails(max_results: int = 100):
    try:
        refresh_classifier()
        analysed = sync_gmail_messages(max_results)
        return {
            "synced": len(analysed),
            "emails": analysed,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Email sync failed: {exc}")


@app.get("/emails")
def get_emails():
    try:
        return sync_gmail_messages(100)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/important-emails")
def important_emails():
    # Backward-compatible endpoint used by older Backpack screens.
    return sync_emails(100)


@app.post("/email-feedback")
def email_feedback(payload: dict):
    gmail_id = str(payload.get("gmail_id") or "").strip()
    category = str(payload.get("category") or "").strip().upper()
    if not gmail_id:
        raise HTTPException(status_code=400, detail="gmail_id is required")
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Choose a valid email category")
    try:
        if not save_email_feedback(gmail_id, category):
            raise HTTPException(status_code=404, detail="Email not found")
        refresh_classifier()
        return {"message": "Correction saved. The local classifier will learn from this label.", "category": category}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save email feedback")


@app.post("/reclassify-stored")
def reclassify_stored(limit: int = 500):
    """Retrain locally and reclassify existing stored mail with the new taxonomy."""
    from scoring_service import classify_email, calculate_score, get_priority
    refresh_classifier()
    rows = get_all_email_training_rows(max(1, min(limit, 500)))
    updated = 0
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for row in rows:
            category, confidence = classify_email(row["subject"], row["sender"], row["body"])
            score = calculate_score(f'{row["subject"]} {row["sender"]} {row["body"]}')
            cursor.execute("""
                UPDATE emails
                SET category=%s, priority=%s, score=%s, processed_at=CURRENT_TIMESTAMP
                WHERE gmail_id=%s
                  AND NOT EXISTS (
                      SELECT 1 FROM email_feedback WHERE gmail_id=%s
                  )
            """, (category, get_priority(score), score, row["gmail_id"], row["gmail_id"]))
            updated += cursor.rowcount
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return {"updated": updated}


@app.get("/stored-emails")
def stored_emails(category: str | None = None, limit: int = 200):
    conn = get_connection()
    cursor = conn.cursor()
    params = []
    where = ""
    if category and category != "ALL":
        where = "WHERE category = %s"
        params.append(category)
    params.append(max(1, min(limit, 500)))

    cursor.execute(f"""
        SELECT
            gmail_id, sender, subject, category, priority, score, deadline,
            processed_at
        FROM emails
        {where}
        ORDER BY category ASC, score DESC, processed_at DESC
        LIMIT %s
    """, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "gmail_id": r[0],
            "sender": r[1],
            "subject": r[2],
            "category": r[3] or "OTHER",
            "priority": r[4] or "LOW",
            "score": r[5] or 0,
            "deadline": str(r[6]) if r[6] else None,
            "processed_at": str(r[7]),
        }
        for r in rows
    ]


@app.get("/email-categories")
def email_categories():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT category, COUNT(*)
        FROM emails
        GROUP BY category
        ORDER BY category
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    counts = {
        "EDUCATION": 0,
        "JOBS": 0,
        "EVENTS & FESTS": 0,
        "SECURITY": 0,
        "OFFERS": 0,
        "COLLEGE": 0,
        "OTHER": 0,
    }
    for category, count in rows:
        key = category or "OTHER"
        counts[key] = count
    return counts


@app.get("/dashboard")
def dashboard():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT priority, COUNT(*) FROM emails GROUP BY priority")
    priority_rows = cursor.fetchall()
    priority_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for row in priority_rows:
        priority_counts[row[0]] = row[1]

    cursor.execute("SELECT category, COUNT(*) FROM emails GROUP BY category")
    category_rows = cursor.fetchall()
    categories = {row[0] or "OTHER": row[1] for row in category_rows}
    cursor.close()
    conn.close()

    return {
        "priorities": priority_counts,
        "categories": categories,
        "total_emails": sum(priority_counts.values()),
    }


@app.get("/upcoming-deadlines")
def upcoming_deadlines():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT subject, sender, deadline, score
        FROM emails
        WHERE deadline IS NOT NULL
        ORDER BY deadline ASC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"subject": r[0], "sender": r[1], "deadline": str(r[2]), "score": r[3], "days_left": days_until(r[2])}
        for r in rows
    ]
