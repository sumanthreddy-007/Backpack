import { useEffect, useState } from "react";
import axios from "axios";

function Deadlines() {
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const fetchDeadlines = async () => {
    try {
      const res = await axios.get(
        "http://127.0.0.1:8000/upcoming-deadlines"
      );

      setDeadlines(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>

      <div className="page-header">
        <h1>Upcoming Deadlines</h1>
        <p>
          Important dates extracted from emails.
        </p>
      </div>

      <div className="deadline-summary">
        <div className="deadline-stat">
          <span>Total Deadlines</span>
          <h2>{deadlines.length}</h2>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Sender</th>
              <th>Deadline</th>
              <th>Days Left</th>
            </tr>
          </thead>

          <tbody>
            {deadlines.map((item, index) => (
              <tr key={index}>
                <td>{item.subject}</td>
                <td>{item.sender}</td>
                <td>{item.deadline}</td>
                <td>
                  <span
                    className={
                      item.days_left <= 3
                        ? "days-danger"
                        : "days-normal"
                    }
                  >
                    {item.days_left}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}

export default Deadlines;