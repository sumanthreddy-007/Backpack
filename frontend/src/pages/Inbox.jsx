import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BriefcaseBusiness,
  CalendarDays,
  GraduationCap,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShoppingBag,
} from "lucide-react";

import EmailCard from "../components/EmailCard";

const API = "http://127.0.0.1:8000";

const CATEGORIES = [
  { id: "EDUCATION", label: "Education", icon: GraduationCap, hint: "Classes, exams, courses" },
  { id: "COLLEGE", label: "College", icon: GraduationCap, hint: "Notices, exams, fees, campus" },
  { id: "JOBS", label: "Jobs & Career", icon: BriefcaseBusiness, hint: "Jobs, placements, internships" },
  { id: "EVENTS & FESTS", label: "Events & Fests", icon: CalendarDays, hint: "Fests, invitations, celebrations" },
  { id: "SECURITY", label: "Security", icon: KeyRound, hint: "OTP, login, verification" },
  { id: "OFFERS", label: "Offers", icon: ShoppingBag, hint: "Deals and promotions" },
  { id: "OTHER", label: "Other", icon: MoreHorizontal, hint: "No strong category match" },
];

function Inbox() {
  const [emails, setEmails] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadStored = async () => {
    const [emailRes, countRes] = await Promise.all([
      axios.get(`${API}/stored-emails?limit=300`),
      axios.get(`${API}/email-categories`),
    ]);
    setEmails(emailRes.data || []);
    setCounts(countRes.data || {});
  };

  const syncEmails = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await axios.get(`${API}/sync-emails?max_results=100`);
      await loadStored();
      setMessage(`${res.data.synced} emails analyzed and organized locally.`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setMessage(detail || "Could not sync Gmail. Connect Gmail first.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialiseInbox = async () => {
      try {
        await loadStored();
        // Older Backpack versions used FEES/PLACEMENTS/etc. Reclassify those
        // stored rows once so the new ML taxonomy is visible immediately.
        await axios.post(`${API}/reclassify-stored?limit=500`);
        await loadStored();
      } catch (error) {
        console.error("Failed to initialise email classification", error);
      }
    };
    initialiseInbox();
  }, []);

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emails.filter((email) => {
      const categoryMatch = selectedCategory === "ALL" || email.category === selectedCategory;
      const searchMatch = !q ||
        email.subject?.toLowerCase().includes(q) ||
        email.sender?.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [emails, search, selectedCategory]);

  return (
    <div className="inbox-page">
      <div className="inbox-header">
        <div>
          <h1>Inbox</h1>
          <p>Backpack learns from your existing mail and organizes it into useful categories.</p>
        </div>
        <button className="inbox-sync-button" onClick={syncEmails} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          {loading ? "Analyzing…" : "Sync & organize"}
        </button>
      </div>

      <div className="inbox-body">
        <div className="inbox-guide">
          <strong>Choose a box first.</strong>
          <span>For example, open <b>Events & Fests</b> for college fests, Diwali events or invitations.</span>
          <span className="inbox-guide-model">Local ML classifier · existing stored mail + curated examples · no external AI service</span>
        </div>

        <div className="category-grid" aria-label="Email categories">
          <button
            className={`category-box ${selectedCategory === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedCategory("ALL")}
          >
            <div className="category-box-icon"><Search size={17} /></div>
            <div><strong>All mail</strong><small>{emails.length} messages</small></div>
          </button>

          {CATEGORIES.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              className={`category-box ${selectedCategory === id ? "active" : ""}`}
              onClick={() => setSelectedCategory(id)}
            >
              <div className="category-box-icon"><Icon size={17} /></div>
              <div>
                <strong>{label}</strong>
                <small>{counts[id] || 0} · {hint}</small>
              </div>
            </button>
          ))}
        </div>

        <div className="inbox-toolbar">
          <label className="inbox-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search this category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span>{filteredEmails.length} shown</span>
        </div>

        {message && <div className="inbox-message">{message}</div>}

        <div className="email-list">
          {filteredEmails.length === 0 ? (
            <div className="inbox-empty">
              <strong>No emails in this box.</strong>
              <span>Try another category or press “Sync & organize”.</span>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <EmailCard
                key={email.gmail_id || `${email.subject}-${email.sender}`}
                subject={email.subject}
                sender={email.sender}
                priority={email.priority}
                category={email.category}
                score={email.score}
                deadline={email.deadline}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Inbox;
