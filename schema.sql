

-- ==========================================================
-- EMAILS
-- ==========================================================

CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,

    gmail_id VARCHAR(255) UNIQUE NOT NULL,

    sender TEXT,
    subject TEXT,
    body TEXT,

    category VARCHAR(50),
    priority VARCHAR(20),

    score INTEGER,

    deadline DATE,

    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT COUNT(*) FROM emails;

SELECT gmail_id, COUNT(*)
FROM emails
GROUP BY gmail_id
HAVING COUNT(*) > 1;


-- ==========================================================
-- FOLDERS
-- ==========================================================

CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) UNIQUE NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO folders(name)
VALUES ('General')
ON CONFLICT(name) DO NOTHING;


-- ==========================================================
-- NOTES
-- ==========================================================

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,

    title TEXT NOT NULL DEFAULT 'Untitled',

    content JSONB NOT NULL DEFAULT '{}'::jsonb,

    folder_id INTEGER NOT NULL
        REFERENCES folders(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================================
-- INDEXES
-- ==========================================================

CREATE INDEX IF NOT EXISTS idx_notes_updated
ON notes(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_title
ON notes(title);

CREATE INDEX IF NOT EXISTS idx_notes_folder
ON notes(folder_id);
