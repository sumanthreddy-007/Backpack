import { Link, useLocation } from "react-router-dom";
import {
  Mail,
  CalendarDays,
  FileText,
  FolderOpen,
  Plug,
  Backpack,
  ShieldCheck,
} from "lucide-react";

function Sidebar() {
  let location;
  
  // Safe routing context verification to prevent complete app crashes
  try {
    location = useLocation();
  } catch (e) {
    location = { pathname: "/" };
  }

  // Matches paths flexibly so that nested routes (e.g., /notes/note_id) keep parent links active
  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const items = [
    {
      name: "Notes",
      path: "/notes",
      icon: FileText,
    },
    {
      name: "Inbox",
      path: "/inbox",
      icon: Mail,
    },
    {
      name: "Deadlines",
      path: "/deadlines",
      icon: CalendarDays,
    },
    {
      name: "PDF Tools",
      path: "/pdf-tools",
      icon: FolderOpen,
    },
    { name: "Connect", path: "/connect", icon: Plug },
    { name: "Privacy", path: "/privacy", icon: ShieldCheck },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-box">
          <Backpack size={26} />
        </div>
        <div>
          <h2>Backpack</h2>
          <p>Your Productivity Hub</p>
        </div>
      </div>

      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={active ? "active-link" : ""}
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>Backpack</span>
        <small>Version 2.0</small>
      </div>
    </aside>
  );
}

export default Sidebar;