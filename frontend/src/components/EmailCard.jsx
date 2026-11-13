import { useState } from "react";

const CATEGORY_LABELS = {
  EDUCATION: "Education", COLLEGE: "College", JOBS: "Jobs & Career",
  "EVENTS & FESTS": "Events & Fests", SECURITY: "Security",
  OFFERS: "Offers", OTHER: "Other",
};
const CATEGORY_IDS = Object.keys(CATEGORY_LABELS);

function EmailCard({ gmailId, onCategoryChange, subject, sender, priority, category, score, deadline }) {
  const priorityClass =
    priority === "CRITICAL" ? "priority-critical" :
    priority === "HIGH" ? "priority-high" :
    priority === "MEDIUM" ? "priority-medium" : "priority-low";
  const [saving, setSaving] = useState(false);

  const handleCategoryChange = async (event) => {
    const nextCategory = event.target.value;
    if (!gmailId || !nextCategory || nextCategory === category || saving) return;
    setSaving(true);
    try {
      await onCategoryChange(gmailId, nextCategory);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="email-card">
      <div className="email-card-top">
        <span className="email-category-label">{CATEGORY_LABELS[category] || "Other"}</span>
        <span className={priorityClass}>{priority}</span>
      </div>
      <h3>{subject}</h3>
      <div className="email-meta">
        <p>{sender}</p>
        {deadline && <p>Deadline: {deadline}</p>}
        <p className="email-score">Relevance {score}</p>
      </div>
      <label className="email-correction">
        <span>Wrong category?</span>
        <select aria-label={"Correct category for " + subject} value={category || "OTHER"} onChange={handleCategoryChange} disabled={saving || !gmailId}>
          {CATEGORY_IDS.map((id) => <option key={id} value={id}>{CATEGORY_LABELS[id]}</option>)}
        </select>
        {saving && <small>Saving…</small>}
      </label>
    </article>
  );
}

export default EmailCard;
