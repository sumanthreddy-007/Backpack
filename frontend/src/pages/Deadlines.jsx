import { useCallback, useEffect, useState } from "react";
import axios from "axios";

function formatDeadline(value) {
  if (!value) return "—";

  // Parse date-only values as local calendar dates to avoid timezone shifts.
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Deadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDeadlines = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.get("http://127.0.0.1:8000/upcoming-deadlines");
      setDeadlines(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load deadlines:", err);
      setError("Could not load deadlines. Check that the Backpack backend is running, then try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  return (
    <section className="deadlines-page">
      <header className="deadlines-header">
        <div>
          <h1>Upcoming Deadlines</h1>
          <p>Important dates extracted from emails.</p>
        </div>
      </header>

      <div className="deadlines-body">
        <section className="deadline-summary" aria-label="Deadline summary">
          <div className="deadline-stat">
            <span>Total Deadlines</span>
            <strong>{deadlines.length}</strong>
          </div>
        </section>

        {error && (
          <div className="deadline-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={fetchDeadlines}>Retry</button>
          </div>
        )}

        <div className="table-container">
          <table className="deadlines-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Sender</th>
                <th scope="col">Deadline</th>
                <th scope="col">Days Left</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="deadline-table-message" colSpan="4">Loading deadlines…</td>
                </tr>
              ) : deadlines.length === 0 ? (
                <tr>
                  <td className="deadline-table-message" colSpan="4">
                    {error ? "Deadlines are unavailable." : "No upcoming deadlines found."}
                  </td>
                </tr>
              ) : (
                deadlines.map((item, index) => {
                  const daysLeft = Number(item.days_left);
                  const hasDaysLeft = Number.isFinite(daysLeft);

                  return (
                    <tr key={item.id ?? item.gmail_id ?? `${item.subject}-${item.deadline}-${index}`}>
                      <td className="deadline-subject">{item.subject || "Untitled email"}</td>
                      <td className="deadline-sender">{item.sender || "—"}</td>
                      <td className="deadline-date">{formatDeadline(item.deadline)}</td>
                      <td>
                        <span className={hasDaysLeft && daysLeft <= 3 ? "days-danger" : "days-normal"}>
                          {hasDaysLeft ? daysLeft : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Deadlines;
