import os
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO

from reportlab.pdfgen import canvas

from date_extractor import days_until
from scoring_service import CATEGORIES, calculate_score, classify_email, refresh_classifier
from pdf_service import parse_pages, read_valid_pdf


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

    def test_festival_promotion_is_classified_as_offer(self):
        category, _ = classify_email(
            "Amazon Great Indian Festival: Diwali deals and up to 60% off",
            "Amazon Offers <deals@amazon.in>",
            "Shop festive sale discounts, bank offers, coupons and cashback. Limited time deal."
        )
        self.assertEqual(category, "OFFERS")

    def test_anthropic_discount_is_classified_as_offer(self):
        category, _ = classify_email(
            "A special offer on your Anthropic subscription",
            "Anthropic <updates@anthropic.com>",
            "Limited time discount. Save on your subscription with this promotional offer."
        )
        self.assertEqual(category, "OFFERS")

    def test_college_hall_ticket_is_not_other(self):
        category, _ = classify_email(
            "Semester examination hall ticket released",
            "Examinations Office <exams@university.ac.in>",
            "Download your hall ticket before the internal examination."
        )
        self.assertEqual(category, "COLLEGE")

    def test_score_is_numeric(self):
        self.assertGreater(calculate_score("urgent exam deadline fee payment"), 0)

    def test_days_until_accepts_python_date(self):
        target = date.today() + timedelta(days=5)
        self.assertEqual(days_until(target), 5)


    def test_pdf_parser_accepts_a_valid_pdf(self):
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer)
        pdf.drawString(40, 700, "Backpack PDF test")
        pdf.save()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as handle:
            handle.write(buffer.getvalue())
            path = handle.name
        try:
            self.assertEqual(len(read_valid_pdf(path).pages), 1)
        finally:
            os.remove(path)

    def test_pdf_parser_rejects_a_non_pdf_file(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as handle:
            handle.write(b"not a pdf")
            path = handle.name
        try:
            with self.assertRaises(Exception):
                read_valid_pdf(path)
        finally:
            os.remove(path)

    def test_page_range_is_bounded(self):
        self.assertEqual(parse_pages("1-3, 5"), {1, 2, 3, 5})
        with self.assertRaises(Exception):
            parse_pages("1-999999999")

    def test_days_until_accepts_iso_string(self):
        target = (date.today() + timedelta(days=3)).isoformat()
        self.assertEqual(days_until(target), 3)


if __name__ == "__main__":
    unittest.main()
