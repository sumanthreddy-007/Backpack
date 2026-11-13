import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()


# ==========================================================
# DB CONNECTION (FIXED - NO GLOBAL CURSOR)
# ==========================================================

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )


# ==========================================================
# EMAIL FUNCTIONS
# ==========================================================

def save_email(
    gmail_id,
    sender,
    subject,
    body,
    category,
    priority,
    score,
    deadline=None
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO emails (
            gmail_id,
            sender,
            subject,
            body,
            category,
            priority,
            score,
            deadline
        )
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (gmail_id)
        DO UPDATE SET
            sender = EXCLUDED.sender,
            subject = EXCLUDED.subject,
            body = EXCLUDED.body,
            category = COALESCE(
                (SELECT category FROM email_feedback WHERE gmail_id = EXCLUDED.gmail_id),
                EXCLUDED.category
            ),
            priority = EXCLUDED.priority,
            score = EXCLUDED.score,
            deadline = EXCLUDED.deadline,
            processed_at = CURRENT_TIMESTAMP
    """, (
        gmail_id,
        sender,
        subject,
        body,
        category,
        priority,
        score,
        deadline
    ))

    conn.commit()
    cursor.close()
    conn.close()
    # ==========================================================
def get_training_emails(limit=1000):
    """Return only human-corrected labels; never train on model predictions."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_feedback (
                gmail_id TEXT PRIMARY KEY,
                sender TEXT NOT NULL DEFAULT '',
                subject TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                corrected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            SELECT sender, subject, body, category
            FROM email_feedback
            ORDER BY corrected_at DESC
            LIMIT %s
        """, (max(1, min(int(limit), 5000)),))
        rows = cursor.fetchall()
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return [
        {"text": f"{r[0] or ''} {r[1] or ''} {r[2] or ''}", "category": r[3]}
        for r in rows
    ]


def save_email_feedback(gmail_id, category):
    """Persist a user's corrected label and update the visible email row."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_feedback (
                gmail_id TEXT PRIMARY KEY,
                sender TEXT NOT NULL DEFAULT '',
                subject TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                corrected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            SELECT sender, subject, body FROM emails WHERE gmail_id=%s
        """, (gmail_id,))
        row = cursor.fetchone()
        if not row:
            return False
        cursor.execute("""
            INSERT INTO email_feedback (gmail_id, sender, subject, body, category)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (gmail_id) DO UPDATE SET
                sender=EXCLUDED.sender,
                subject=EXCLUDED.subject,
                body=EXCLUDED.body,
                category=EXCLUDED.category,
                corrected_at=CURRENT_TIMESTAMP
        """, (gmail_id, row[0] or "", row[1] or "", row[2] or "", category))
        cursor.execute("""
            UPDATE emails SET category=%s, processed_at=CURRENT_TIMESTAMP
            WHERE gmail_id=%s
        """, (category, gmail_id))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def get_all_email_training_rows(limit=500):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT gmail_id, sender, subject, body
        FROM emails
        ORDER BY processed_at DESC
        LIMIT %s
    """, (limit,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"gmail_id": r[0], "sender": r[1] or "", "subject": r[2] or "", "body": r[3] or ""}
        for r in rows
    ]

# NOTES FUNCTIONS
# ==========================================================

def get_folder_id(folder_name="General"):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id FROM folders WHERE name=%s
    """, (folder_name,))

    row = cursor.fetchone()

    if row:
        cursor.close()
        conn.close()
        return row[0]

    cursor.execute("""
        INSERT INTO folders(name)
        VALUES(%s)
        RETURNING id
    """, (folder_name,))

    folder_id = cursor.fetchone()[0]

    conn.commit()
    cursor.close()
    conn.close()

    return folder_id


def create_note(title="Untitled", content=None, folder="General"):
    if content is None:
        content = {}

    conn = get_connection()
    cursor = conn.cursor()

    folder_id = get_folder_id(folder)

    cursor.execute("""
        INSERT INTO notes (
            title,
            content,
            folder_id
        )
        VALUES (%s,%s,%s)
        RETURNING id
    """, (
        title,
        json.dumps(content),
        folder_id
    ))

    note_id = cursor.fetchone()[0]

    conn.commit()
    cursor.close()
    conn.close()

    return note_id


def get_all_notes():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            n.id,
            n.title,
            n.content,
            f.name,
            n.created_at,
            n.updated_at
        FROM notes n
        JOIN folders f ON n.folder_id = f.id
        ORDER BY n.updated_at DESC
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return [
        {
            "id": r[0],
            "title": r[1],
            "content": r[2],
            "folder": r[3],
            "created_at": str(r[4]),
            "updated_at": str(r[5])
        }
        for r in rows
    ]


def get_note(note_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            n.id,
            n.title,
            n.content,
            f.name,
            n.created_at,
            n.updated_at
        FROM notes n
        JOIN folders f ON n.folder_id = f.id
        WHERE n.id=%s
    """, (note_id,))

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "title": row[1],
        "content": row[2],
        "folder": row[3],
        "created_at": str(row[4]),
        "updated_at": str(row[5])
    }


def update_note(note_id, title, content, folder):
    conn = get_connection()
    cursor = conn.cursor()

    folder_id = get_folder_id(folder)

    cursor.execute("""
        UPDATE notes
        SET title=%s,
            content=%s,
            folder_id=%s,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=%s
    """, (
        title,
        json.dumps(content),
        folder_id,
        note_id
    ))

    conn.commit()
    cursor.close()
    conn.close()


def delete_note(note_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM notes WHERE id=%s
    """, (note_id,))

    conn.commit()
    cursor.close()
    conn.close()


def search_notes(keyword):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            n.id,
            n.title,
            n.content,
            f.name,
            n.created_at,
            n.updated_at
        FROM notes n
        JOIN folders f ON n.folder_id = f.id
        WHERE LOWER(n.title) LIKE LOWER(%s)
        ORDER BY n.updated_at DESC
    """, (f"%{keyword}%",))

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return [
        {
            "id": r[0],
            "title": r[1],
            "content": r[2],
            "folder": r[3],
            "created_at": str(r[4]),
            "updated_at": str(r[5])
        }
        for r in rows
    ]



def get_folders():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name FROM folders ORDER BY name
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return [{"id": r[0], "name": r[1]} for r in rows]


def create_folder(folder_name):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO folders(name)
        VALUES(%s)
        ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name
        RETURNING id
    """, (folder_name,))
    folder_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()
    return folder_id


def rename_folder(folder_id, new_name):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE folders
        SET name=%s
        WHERE id=%s
    """, (new_name, folder_id))

    conn.commit()
    cursor.close()
    conn.close()


def delete_folder(folder_id):
    conn = get_connection()
    cursor = conn.cursor()

    general_id = get_folder_id("General")

    cursor.execute("""
        UPDATE notes
        SET folder_id=%s
        WHERE folder_id=%s
    """, (general_id, folder_id))

    cursor.execute("""
        DELETE FROM folders WHERE id=%s
    """, (folder_id,))

    conn.commit()
    cursor.close()
    conn.close()


def move_note(note_id, folder_name):
    conn = get_connection()
    cursor = conn.cursor()

    folder_id = get_folder_id(folder_name)

    cursor.execute("""
        UPDATE notes
        SET folder_id=%s,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=%s
    """, (folder_id, note_id))

    conn.commit()
    cursor.close()
    conn.close()