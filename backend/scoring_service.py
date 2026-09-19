"""Email scoring and ML-assisted categorisation for Backpack.

The classifier is intentionally local: no email content is sent to an external
AI service.  It combines a small curated seed set with the user's already
stored/labeled emails and retrains when emails are synced.
"""

import re
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


CATEGORIES = [
    "EDUCATION",
    "COLLEGE",
    "JOBS",
    "EVENTS & FESTS",
    "SECURITY",
    "OFFERS",
    "OTHER",
]

# Bootstrap examples give the model useful vocabulary before the user has
# enough historical mail for their own data to dominate the classifier.
SEED_DATA = {
    "EDUCATION": [
        "online course tutorial study material certification bootcamp lecture programming machine learning data structures textbook learning module study lesson",
        "course completion certificate learning platform class tutorial assignment educational webinar skill training",
    ],
    "COLLEGE": [
        "exam timetable hall ticket semester internal examination results grades attendance assignment course registration university class department faculty",
        "college academic notice hostel fee payment scholarship admission registration project review certificate registrar principal campus office",
        "campus announcement student notice timetable examination fee payment hostel attendance department event circular",
    ],
    "JOBS": [
        "placement campus recruitment interview job opening internship hiring resume career company assessment coding test",
        "career opportunity graduate role job application recruitment drive technical interview internship offer",
    ],
    "EVENTS & FESTS": [
        "college fest cultural fest annual day technical fest event celebration registration invitation dj dance music food",
        "diwali celebration festival invitation wedding invitation ceremony birthday party event meetup cultural program",
        "hackathon event club event student gathering fest celebration invitation",
    ],
    "SECURITY": [
        "security alert suspicious login sign in verification one time password OTP authentication code account activity password reset",
        "new device login unusual activity verify your identity two factor authentication account security",
    ],
    "OFFERS": [
        "sale discount coupon offer deal cashback shopping promotional free shipping limited time exclusive offer subscribe",
        "special price marketing promotion black friday product sale buy now shopping deal",
    ],
    "OTHER": [
        "newsletter general announcement community message personal update reminder invitation information",
        "weather news daily digest miscellaneous message no clear category",
    ],
}

# Categories used by older Backpack versions are mapped into the new taxonomy
# so existing rows can contribute to training instead of being discarded.
LEGACY_MAP = {
    "FEES": "COLLEGE",
    "PLACEMENTS": "JOBS",
    "HOSTEL": "EDUCATION",
    "SCHOLARSHIP": "COLLEGE",
    "ACADEMIC": "COLLEGE",
    "PROMOTION": "OFFERS",
    "GENERAL": "OTHER",
}

IMPORTANT_KEYWORDS = {
    "deadline": 50, "registration": 40, "exam": 40, "fee": 40,
    "payment": 35, "hostel": 30, "submission": 35, "assignment": 30,
    "attendance": 25, "meeting": 25, "urgent": 30, "verification": 20,
    "interview": 30, "placement": 35, "scholarship": 35, "result": 30,
    "admission": 40, "course": 20, "timetable": 20, "orientation": 25,
    "workshop": 15, "seminar": 15, "fee payment": 50,
    "course registration": 50, "hall ticket": 40, "internal exam": 35,
    "mid exam": 35, "semester exam": 40, "project review": 35,
    "campus drive": 40, "internship": 35, "certificate verification": 35,
}

PROMOTIONAL_KEYWORDS = {
    "sale": -50, "offer": -40, "discount": -40, "coupon": -40,
    "deal": -35, "shopping": -30, "cashback": -30, "buy now": -50,
    "limited time": -30, "promo": -30, "promotion": -30,
    "exclusive offer": -40, "special offer": -40, "save big": -40,
    "free shipping": -30, "flash sale": -50, "unsubscribe": -25,
    "click here": -20, "shop now": -40, "order now": -40,
    "mega sale": -50, "amazon sale": -50, "flipkart sale": -50,
}

TRUSTED_SENDERS = {
    ".edu": 40, ".ac.in": 40, "registrar": 40, "academics": 35,
    "accounts": 35, "principal": 40, "placements": 35, "hostel": 30,
    "examinations": 35, "admin": 25, "office": 20,
}

DEADLINE_WORDS = {
    "last date": 50, "before": 20, "due": 30, "deadline": 50,
    "closing date": 40, "submit before": 40, "registration closes": 50,
    "fee due": 50, "payment due": 50, "apply before": 40,
}


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _bootstrap_training():
    texts = []
    labels = []
    for category, examples in SEED_DATA.items():
        for example in examples:
            texts.append(example)
            labels.append(category)

    try:
        from database import get_training_emails
        rows = get_training_emails()
    except Exception:
        rows = []

    for row in rows:
        category = LEGACY_MAP.get(str(row.get("category", "")).upper(), str(row.get("category", "")).upper())
        if category not in CATEGORIES:
            continue
        text = row.get("text", "")
        if text:
            texts.append(text)
            labels.append(category)

    return texts, labels


@lru_cache(maxsize=1)
def _train_model():
    texts, labels = _bootstrap_training()
    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
        max_features=12000,
    )
    matrix = vectorizer.fit_transform(texts)
    model = LogisticRegression(
        max_iter=1200,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(matrix, labels)
    return vectorizer, model


def refresh_classifier():
    _train_model.cache_clear()
    _train_model()


def classify_email(subject: str, sender: str, body: str):
    # Subject and sender are repeated deliberately: they usually carry a much
    # stronger classification signal than boilerplate email bodies.
    subject = _normalise(subject)
    sender = _normalise(sender)
    body = _normalise(body)[:12000]
    text = f"{subject} {subject} {sender} {sender} {body}"

    vectorizer, model = _train_model()
    probabilities = model.predict_proba(vectorizer.transform([text]))[0]
    best_index = probabilities.argmax()
    category = str(model.classes_[best_index])
    confidence = float(probabilities[best_index])

    # The model is trained on a small local seed set, so raw probabilities
    # are naturally lower than a large production classifier. Keep the
    # prediction when it has useful confidence and a meaningful lead over the
    # second class; otherwise place it in OTHER.
    ranked = sorted((float(p) for p in probabilities), reverse=True)
    margin = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]
    if confidence < 0.17 or margin < 0.025:
        category = "OTHER"

    return category, round(confidence, 4)


def calculate_score(text):
    text = _normalise(text)
    score = 0
    for keyword, points in IMPORTANT_KEYWORDS.items():
        if keyword in text:
            score += points
    for sender, points in TRUSTED_SENDERS.items():
        if sender in text:
            score += points
    for word, points in DEADLINE_WORDS.items():
        if word in text:
            score += points
    for keyword, points in PROMOTIONAL_KEYWORDS.items():
        if keyword in text:
            score += points
    return score


def get_priority(score):
    if score >= 150:
        return "CRITICAL"
    if score >= 90:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def categorize_email(text, subject="", sender="", body=""):
    # Keep the old function signature usable by the rest of the backend.
    return classify_email(subject, sender, body or text)
