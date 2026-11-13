import unittest
from datetime import date, timedelta

from date_extractor import days_until
from scoring_service import CATEGORIES, calculate_score, classify_email, refresh_classifier


class EmailClassifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        refresh_classifier()

    def test_classifier_returns_supported_category_and_confidence(self):
        category, confidence = classify_email(
            "Semester examination hall ticket released",
            "Examinations Office <exams@university.ac.in>",
            "Download your hall ticket before the internal examination."
        )
        self.assertIn(category, CATEGORIES)
        self.assertGreaterEqual(confidence, 0.0)
        self.assertLessEqual(confidence, 1.0)

    def test_classifier_accepts_empty_body(self):
        category, confidence = classify_email(
            "New login verification code", "Google Security", ""
        )
        self.assertIn(category, CATEGORIES)
        self.assertIsInstance(confidence, float)

    def test_score_is_numeric(self):
        self.assertGreater(calculate_score("urgent exam deadline fee payment"), 0)

    def test_days_until_accepts_python_date(self):
        target = date.today() + timedelta(days=5)
        self.assertEqual(days_until(target), 5)

    def test_days_until_accepts_iso_string(self):
        target = (date.today() + timedelta(days=3)).isoformat()
        self.assertEqual(days_until(target), 3)


if __name__ == "__main__":
    unittest.main()
