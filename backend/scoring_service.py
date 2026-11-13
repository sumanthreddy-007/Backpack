"""Local ML email classifier: TF-IDF/Logistic Regression plus weighted evidence."""
import html
import re
from functools import lru_cache
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

CATEGORIES = ["EDUCATION", "COLLEGE", "JOBS", "EVENTS & FESTS", "SECURITY", "OFFERS", "OTHER"]

SEED_DATA = {
 "EDUCATION": [
  "online course tutorial study material certification bootcamp lecture programming machine learning data structures textbook learning module",
  "course completion certificate learning platform class tutorial assignment educational webinar skill training",
  "learn Python Java JavaScript React SQL through guided lessons course modules practice exercises",
  "Coursera Udemy edX course enrollment learning subscription lecture certificate training",
  "new lesson available course progress study guide learning resources instructor",
 ],
 "COLLEGE": [
  "exam timetable hall ticket semester internal examination results grades attendance assignment course registration university department faculty",
  "college academic notice hostel fee payment scholarship admission registration project review certificate registrar principal campus office",
  "campus announcement student notice timetable examination fee payment hostel attendance department circular",
  "university examination cell end semester exam schedule internal marks results hall ticket",
  "college fee due tuition payment receipt attendance shortage academic calendar",
 ],
 "JOBS": [
  "placement campus recruitment interview job opening internship hiring resume career company assessment coding test",
  "career opportunity graduate role job application recruitment drive technical interview internship offer",
  "shortlisted candidate interview schedule assessment link recruiter hiring manager job vacancy",
  "software engineer internship application hiring careers placement opportunity",
 ],
 "EVENTS & FESTS": [
  "college fest cultural fest annual day technical fest event celebration registration invitation DJ dance music food",
  "Diwali celebration festival invitation wedding invitation ceremony birthday party event meetup cultural program",
  "hackathon event club event student gathering fest celebration invitation",
  "campus fest schedule concert cultural night event passes registration",
 ],
 "SECURITY": [
  "security alert suspicious login sign in verification one time password OTP authentication code account activity password reset",
  "new device login unusual activity verify your identity two factor authentication account security",
  "your verification code is OTP do not share password reset sign in alert",
  "account recovery security notice login attempt authentication code",
 ],
 "OFFERS": [
  "sale discount coupon offer deal cashback shopping promotional free shipping limited time exclusive offer subscribe",
  "special price marketing promotion black friday product sale buy now shopping deal",
  "Amazon Great Indian Festival Diwali sale festive deals limited time discounts bank offers coupons",
  "Amazon festival sale deals smartphones electronics home appliances price drop cashback coupon",
  "Anthropic special offer discount promotional deal subscription pricing limited time offer",
  "OpenAI special offer discount promotional deal subscription pricing limited time offer",
  "festival season offers flat percentage off use coupon code shop now exclusive deal",
  "your wishlist item is on sale price drop discount deal limited time",
  "save on your next purchase promo code free delivery cashback offer",
 ],
 "OTHER": [
  "personal update general announcement community message reminder information",
  "weather news daily digest miscellaneous message no clear category",
  "receipt transaction confirmation order shipped delivery status account statement",
  "newsletter weekly digest product news release notes community update",
 ],
}

LEGACY_MAP = {"FEES":"COLLEGE","PLACEMENTS":"JOBS","HOSTEL":"COLLEGE","SCHOLARSHIP":"COLLEGE","ACADEMIC":"COLLEGE","PROMOTION":"OFFERS","GENERAL":"OTHER"}

# Phrase weights are deliberately interpretable. Brand names alone carry almost
# no weight; they need accompanying promotional language to indicate an offer.
CATEGORY_EVIDENCE = {
 "OFFERS": {
  "great indian festival":5,"festival sale":5,"festive sale":5,"diwali sale":5,
  "black friday":5,"flash sale":5,"limited time offer":5,"exclusive offer":5,
  "special offer":4,"bank offer":4,"coupon code":4,"promo code":4,"use code":3,
  "flat off":4,"discount":3,"cashback":3,"price drop":3,"deal of the day":4,
  "shop now":3,"buy now":3,"free shipping":2,"sale":2,"offer":2,"coupon":3,
  "amazon":0.5,"anthropic":0.5,"openai":0.5,
 },
 "SECURITY": {
  "one time password":5,"verification code":5,"security alert":5,"suspicious login":5,
  "new sign-in":4,"new device":3,"password reset":4,"two-factor":4,"two factor":4,
  "do not share":3,"login attempt":3,"otp":4,
 },
 "COLLEGE": {
  "hall ticket":5,"semester exam":5,"internal examination":5,"exam timetable":5,
  "examination cell":4,"attendance shortage":4,"tuition fee":4,"fee payment":4,
  "academic calendar":4,"university notice":3,"hostel fee":3,"internal marks":4,
  "course registration":3,
 },
 "EDUCATION": {
  "course lesson":4,"course module":4,"learning path":4,"course certificate":4,
  "enroll in this course":4,"your course":2,"study material":4,"tutorial":2,
  "lecture":2,"learning resources":3,
 },
 "JOBS": {
  "job opening":5,"job opportunity":5,"interview invitation":5,"interview schedule":5,
  "campus recruitment":5,"placement drive":5,"internship opportunity":4,
  "shortlisted":3,"career opportunity":4,"hiring":2,"job application":4,"assessment link":3,
 },
 "EVENTS & FESTS": {
  "college fest":5,"cultural fest":5,"technical fest":5,"diwali celebration":4,
  "festival invitation":4,"event registration":3,"cultural night":4,"annual day":4,
  "hackathon":3,"concert":2,
 },
}

IMPORTANT_KEYWORDS = {
 "deadline":50,"registration":40,"exam":40,"fee":40,"payment":35,"hostel":30,
 "submission":35,"assignment":30,"attendance":25,"meeting":25,"urgent":30,
 "verification":20,"interview":30,"placement":35,"scholarship":35,"result":30,
 "admission":40,"course":20,"timetable":20,"orientation":25,"workshop":15,
 "seminar":15,"fee payment":50,"course registration":50,"hall ticket":40,
 "internal exam":35,"mid exam":35,"semester exam":40,"project review":35,
 "campus drive":40,"internship":35,"certificate verification":35,
}
PROMOTIONAL_KEYWORDS = {
 "sale":-50,"offer":-40,"discount":-40,"coupon":-40,"deal":-35,"shopping":-30,
 "cashback":-30,"buy now":-50,"limited time":-30,"promo":-30,"promotion":-30,
 "exclusive offer":-40,"special offer":-40,"save big":-40,"free shipping":-30,
 "flash sale":-50,"unsubscribe":-25,"click here":-20,"shop now":-40,
 "order now":-40,"mega sale":-50,"amazon sale":-50,"flipkart sale":-50,
}
TRUSTED_SENDERS = {".edu":40,".ac.in":40,"registrar":40,"academics":35,"accounts":35,"principal":40,"placements":35,"hostel":30,"examinations":35,"admin":25,"office":20}
DEADLINE_WORDS = {"last date":50,"before":20,"due":30,"deadline":50,"closing date":40,"submit before":40,"registration closes":50,"fee due":50,"payment due":50,"apply before":40}

def _normalise(value: str) -> str:
 value = html.unescape(value or "")
 value = re.sub(r"<[^>]+>", " ", value)
 value = re.sub(r"https?://\\S+", " ", value)
 return re.sub(r"\\s+", " ", value.lower()).strip()

def _bootstrap_training():
 texts, labels = [], []
 for category, examples in SEED_DATA.items():
  for example in examples:
   texts.append(example); labels.append(category)
 try:
  from database import get_training_emails
  rows = get_training_emails()
 except Exception:
  rows = []
 for row in rows:
  category = LEGACY_MAP.get(str(row.get("category","")).upper(), str(row.get("category","")).upper())
  if category in CATEGORIES and row.get("text"):
   texts.append(row["text"]); labels.append(category)
 return texts, labels

@lru_cache(maxsize=1)
def _train_model():
 texts, labels = _bootstrap_training()
 vectorizer = TfidfVectorizer(lowercase=True, strip_accents="unicode", ngram_range=(1,2), sublinear_tf=True, min_df=1, max_features=20000)
 model = LogisticRegression(max_iter=1600, class_weight="balanced", C=2.0, random_state=42)
 model.fit(vectorizer.fit_transform(texts), labels)
 return vectorizer, model

def refresh_classifier():
 _train_model.cache_clear()
 _train_model()

def _weighted_evidence(subject, sender, body):
 subject_text = _normalise(subject)
 combined = f" {subject_text} {_normalise(sender)} {_normalise(body)} "
 scores = {category:0.0 for category in CATEGORIES}
 for category, phrases in CATEGORY_EVIDENCE.items():
  for phrase, weight in phrases.items():
   if phrase in combined:
    scores[category] += weight * (1.5 if phrase in subject_text else 1.0)
 return scores

def classify_email(subject: str, sender: str, body: str):
 subject_clean, sender_clean, body_clean = _normalise(subject), _normalise(sender), _normalise(body)[:12000]
 text = f"{subject_clean} {subject_clean} {subject_clean} {sender_clean} {sender_clean} {body_clean}"
 vectorizer, model = _train_model()
 probabilities = model.predict_proba(vectorizer.transform([text]))[0]
 ranked = sorted(((float(p), str(label)) for p, label in zip(probabilities, model.classes_)), reverse=True)
 ml_confidence, ml_category = ranked[0]
 evidence = _weighted_evidence(subject_clean, sender_clean, body_clean)
 evidence_category, evidence_score = max(evidence.items(), key=lambda item:item[1])
 second_score = sorted(evidence.values(), reverse=True)[1]
 # Do not turn every uncertain ML prediction into OTHER. Use strong, distinctive
 # phrase evidence to override; otherwise keep the model's best class.
 if evidence_score >= 4.0 and evidence_score - second_score >= 1.5:
  category = evidence_category
  confidence = max(ml_confidence, min(0.95, 0.55 + evidence_score * 0.035))
 else:
  category, confidence = ml_category, ml_confidence
 return category, round(float(confidence), 4)

def calculate_score(text):
 text = _normalise(text)
 score = 0
 for keyword, points in IMPORTANT_KEYWORDS.items():
  if keyword in text: score += points
 for sender, points in TRUSTED_SENDERS.items():
  if sender in text: score += points
 for word, points in DEADLINE_WORDS.items():
  if word in text: score += points
 for keyword, points in PROMOTIONAL_KEYWORDS.items():
  if keyword in text: score += points
 return score

def get_priority(score):
 if score >= 150: return "CRITICAL"
 if score >= 90: return "HIGH"
 if score >= 40: return "MEDIUM"
 return "LOW"

def categorize_email(text, subject="", sender="", body=""):
 return classify_email(subject, sender, body or text)
