import { useRef, useState } from "react";
import axios from "axios";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

const API = "http://127.0.0.1:8000";

function Connect() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [credentialsFile, setCredentialsFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const uploadCredentials = async () => {
    if (!credentialsFile) {
      setMessage("Choose the OAuth Desktop app JSON file first.");
      setMessageType("error");
      return;
    }
    const form = new FormData();
    form.append("file", credentialsFile);
    setUploading(true);
    setMessage("");
    try {
      const res = await axios.post(`${API}/gmail-credentials`, form, { timeout: 15000 });
      setMessage(res.data.message);
      setMessageType("success");
      setCredentialsFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Could not save the OAuth configuration.");
      setMessageType("error");
    } finally {
      setUploading(false);
    }
  };

  const connectGmail = async () => {
    setLoading(true);
    setMessage("");
    setMessageType("");
    try {
      const res = await axios.get(`${API}/connect-gmail`, { timeout: 120000 });
      setProfile(res.data);
      setMessage(`Connected to ${res.data.email}. Backpack will use readonly Gmail access.`);
      setMessageType("success");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessage(detail || "Connection failed. Make sure the backend is running and credentials.json is inside backend/.");
      setMessageType("error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = async () => {
    setLoading(true);
    setMessage("");
    try {
      await axios.post(`${API}/disconnect-gmail`);
      setProfile(null);
      setMessage("Account disconnected. Press Connect Gmail and choose another Google account.");
      setMessageType("success");
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Could not disconnect the account.");
      setMessageType("error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connect-page">
      <div className="page-header">
        <h1>Connect Gmail</h1>
        <p>Connect your Gmail account and let Backpack organize emails and deadlines.</p>
      </div>

      <div className="page-body">
        <section className="connect-card">
          <div className="connect-title">
            <ShieldCheck size={18} />
            <h3>Google Account</h3>
          </div>
          <p className="connect-description">Backpack requests <strong>readonly</strong> Gmail access. It cannot send, delete or edit your mail.</p>

          <div className="connect-actions">
            <button className="page-btn connect-primary" onClick={connectGmail} disabled={loading || uploading}>
              {loading ? "Waiting for Google..." : profile ? "Refresh connection" : "Connect Gmail"}
            </button>
            {profile && (
              <button className="connect-secondary" onClick={switchAccount} disabled={loading}>
                <RefreshCw size={15} /> Change account
              </button>
            )}
          </div>

          {message && <div className={`connect-message ${messageType}`}>{message}</div>}

          <div className="oauth-upload">
            <div className="setup-heading">Google OAuth configuration</div>
            <p className="connect-description">Select the Desktop app JSON you downloaded. Backpack saves it locally in the backend; the client secret is not displayed in the page.</p>
            <div className="connect-actions">
              <input ref={fileInput} type="file" accept=".json,application/json" onChange={(event) => setCredentialsFile(event.target.files?.[0] || null)} aria-label="Choose Google OAuth client JSON" />
              <button type="button" className="page-btn connect-primary" onClick={uploadCredentials} disabled={!credentialsFile || uploading}>
                {uploading ? "Saving configuration…" : "Save Google details"}
              </button>
            </div>
          </div>

          <div className="setup-guide">
            <div className="setup-heading">First-time setup</div>
            <a className="console-button" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
              <span>Open Google Cloud Console</span>
              <ExternalLink size={14} />
            </a>
            <ol>
              <li>Create or select a Google Cloud project.</li>
              <li>Enable the <strong>Gmail API</strong>.</li>
              <li>Configure the OAuth consent screen if Google asks for it.</li>
              <li>Create an <strong>OAuth Client ID → Desktop app</strong>.</li>
              <li>Download the JSON file and rename it <code>credentials.json</code>.</li>
              <li>Put it directly inside <code>backend/</code>.</li>
              <li>Return here and press <strong>Connect Gmail</strong>.</li>
            </ol>
            <div className="setup-note">Backpack creates <code>token.json</code> automatically after Google authorization. Keep both files private and never commit them to GitHub.</div>
          </div>
        </section>

        {profile && (
          <section className="profile-card">
            <h3>Connected Account</h3>
            <div className="profile-row"><span>Email</span><strong>{profile.email}</strong></div>
            <div className="profile-row"><span>Total Messages</span><strong>{profile.messages}</strong></div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Connect;
