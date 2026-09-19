import { useEffect, useState } from "react";
import axios from "axios";

function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/dashboard"
      );

      setData(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  if (!data) {
    return <h2>Loading...</h2>;
  }

  return (
    <div>

      <div className="dashboard-hero">
        <h1>Backpack</h1>
        <p>
          Manage emails, deadlines, PDFs and
          documents from one workspace.
        </p>
      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <span>Critical</span>
          <h2>{data.priorities.CRITICAL}</h2>
        </div>

        <div className="stat-card">
          <span>High</span>
          <h2>{data.priorities.HIGH}</h2>
        </div>

        <div className="stat-card">
          <span>Medium</span>
          <h2>{data.priorities.MEDIUM}</h2>
        </div>

        <div className="stat-card">
          <span>Low</span>
          <h2>{data.priorities.LOW}</h2>
        </div>

        <div className="stat-card">
          <span>Total Emails</span>
          <h2>{data.total_emails}</h2>
        </div>

      </div>

      <div className="dashboard-section">

        <div className="dashboard-box">
          <h3>Email Intelligence</h3>
          <p>
            Categorize important emails and
            track deadlines automatically.
          </p>
        </div>

        <div className="dashboard-box">
          <h3>PDF Workspace</h3>
          <p>
            Convert, merge, split, rotate and
            manage documents.
          </p>
        </div>

        <div className="dashboard-box">
          <h3>Notes</h3>
          <p>
            Advanced note-taking system for your daily class notes
          </p>
        </div>

      </div>

    </div>
  );
}

export default Dashboard;