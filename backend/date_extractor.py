import re
from datetime import datetime
from dateutil import parser

DATE_PATTERNS = [
    r"\d{1,2}/\d{1,2}/\d{2,4}",          # 15/07/2026
    r"\d{1,2}-\d{1,2}-\d{2,4}",          # 15-07-2026
    r"\d{1,2}\s+[A-Za-z]+\s+\d{2,4}",    # 20 June 2026
    r"[A-Za-z]+\s+\d{1,2},?\s+\d{2,4}",  # June 20, 2026
]

DEADLINE_KEYWORDS = [
    "deadline",
    "last date",
    "due date",
    "submit before",
    "payment due",
    "fee payment",
    "registration closes",
    "apply before",
    "closing date",
    "expires on",
]


def extract_dates(text):
    """
    Extract all valid dates from text.
    Returns list of YYYY-MM-DD strings.
    """

    if not text:
        return []

    found_dates = set()

    for pattern in DATE_PATTERNS:

        matches = re.findall(pattern, text)

        for match in matches:

            try:
                parsed_date = parser.parse(
                    match,
                    dayfirst=True,
                    fuzzy=True
                ).date()

                found_dates.add(
                    parsed_date.strftime("%Y-%m-%d")
                )

            except Exception:
                continue

    return sorted(found_dates)


def find_deadline_dates(text):
    """
    Extract dates that appear near deadline-related keywords.
    """

    if not text:
        return []

    deadline_dates = []

    lines = text.split("\n")

    for line in lines:

        lower_line = line.lower()

        if any(
            keyword in lower_line
            for keyword in DEADLINE_KEYWORDS
        ):

            dates = extract_dates(line)

            deadline_dates.extend(dates)

    return list(set(deadline_dates))


def get_nearest_future_date(date_list):
    """
    Return nearest future date from list.
    """

    if not date_list:
        return None

    today = datetime.today().date()

    future_dates = []

    for date_str in date_list:

        try:

            date_obj = datetime.strptime(
                date_str,
                "%Y-%m-%d"
            ).date()

            if date_obj >= today:
                future_dates.append(date_obj)

        except Exception:
            continue

    if not future_dates:
        return None

    nearest = min(future_dates)

    return nearest.strftime("%Y-%m-%d")


def days_until(date_string):
    """
    Return number of days remaining until date.
    """

    if not date_string:
        return None

    try:

        target_date = datetime.strptime(
            date_string,
            "%Y-%m-%d"
        ).date()

        today = datetime.today().date()

        return (target_date - today).days

    except Exception:
        return None