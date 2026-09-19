import base64
import os

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")


def get_gmail_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not os.path.exists(CREDENTIALS_FILE) and not creds:
        raise FileNotFoundError(
            "credentials.json was not found in backend/. Open Connect Gmail for setup instructions."
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError("credentials.json is required for the first Gmail connection.")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w", encoding="utf-8") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def _decode_part(data):
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def extract_email_body(payload):
    """Recursively extract the best available plain-text body."""
    if not payload:
        return ""

    mime = payload.get("mimeType", "")
    data = payload.get("body", {}).get("data")
    if mime == "text/plain" and data:
        return _decode_part(data)

    parts = payload.get("parts") or []
    plain = []
    html_fallback = []
    for part in parts:
        part_text = extract_email_body(part)
        if part_text:
            if part.get("mimeType") == "text/plain":
                plain.append(part_text)
            else:
                html_fallback.append(part_text)

    if plain:
        return "\n".join(plain)
    if html_fallback:
        return "\n".join(html_fallback)
    return _decode_part(data)
