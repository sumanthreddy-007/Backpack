import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

import Sidebar from "./components/Sidebar";

import Connect from "./pages/Connect";
import Deadlines from "./pages/Deadlines";
import Inbox from "./pages/Inbox";
import PdfTools from "./pages/PdfTools";
import Notes from "./pages/Notes";
import Privacy from "./pages/Privacy";

function KeyboardNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const routes = { "1": "/notes", "2": "/inbox", "3": "/deadlines", "4": "/pdf-tools", "5": "/connect", "6": "/privacy" };
      if (routes[e.key]) { e.preventDefault(); navigate(routes[e.key]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  return null;
}

function App() {
  return (
    <BrowserRouter>

      <KeyboardNavigation />

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 2500,
          style: {
            background: "#111",
            color: "#fff",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />

      <div className="layout">

        <Sidebar />

        <main className="content">

          <Routes>

            <Route
              path="/"
              element={<Navigate to="/notes" replace />}
            />

            <Route
              path="/connect"
              element={<Connect />}
            />

            <Route
              path="/deadlines"
              element={<Deadlines />}
            />

            <Route
              path="/inbox"
              element={<Inbox />}
            />

            <Route
              path="/pdf-tools"
              element={<PdfTools />}
            />

            <Route
              path="/notes"
              element={<Notes />}
            />

            <Route path="/privacy" element={<Privacy />} />

            <Route
              path="*"
              element={<Navigate to="/notes" replace />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}

export default App;