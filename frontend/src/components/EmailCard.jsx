const CATEGORY_LABELS = {
  "EDUCATION": "Education",
  "COLLEGE": "College",
  "JOBS": "Jobs & Career",
  "EVENTS & FESTS": "Events & Fests",
  "SECURITY": "Security",
  "OFFERS": "Offers",
  "OTHER": "Other",
};

function EmailCard({ subject, sender, priority, category, score, deadline }) {
  const priorityClass =
    priority === "CRITICAL" ? "priority-critical" :
    priority === "HIGH" ? "priority-high" :
    priority === "MEDIUM" ? "priority-medium" : "priority-low";

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
    </article>
  );
}

export default EmailCard;
