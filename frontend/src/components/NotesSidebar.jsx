import { useState } from "react";
import { Plus, Search, FolderPlus, Folder, FileText } from "lucide-react";

function NotesSidebar({
  notes = [],
  activeNoteId,
  onSelectNote,
  onCreateNote,
  folders = [],
  onCreateFolder,
  activeFolderId,
  onSelectFolder,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);

  // Filter notes based on search query and active folder
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.preview?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFolder = activeFolderId 
      ? note.folderId === activeFolderId 
      : true;

    return matchesSearch && matchesFolder;
  });

  const handleCreateFolderSubmit = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName("");
    setShowFolderInput(false);
  };

  return (
    <aside className="notes-sidebar">
      {/* Sidebar Header & Actions */}
      <div className="notes-sidebar-header">
        <button 
          className="slide-controls" 
          style={{ width: "100%", marginBottom: "12px", border: "1px solid var(--border)" }}
          onClick={onCreateNote}
        >
          <Plus size={16} /> New Note
        </button>

        <input
          type="text"
          className="notes-sidebar-search"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Navigation / Folders List */}
      <div className="notes-list">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Folders
          </span>
          <button 
            type="button" 
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}
            onClick={() => setShowFolderInput(!showFolderInput)}
          >
            <FolderPlus size={14} />
          </button>
        </div>

        {showFolderInput && (
          <form onSubmit={handleCreateFolderSubmit} style={{ marginBottom: "12px", display: "flex", gap: "4px" }}>
            <input
              type="text"
              className="notes-sidebar-search"
              style={{ height: "30px", fontSize: "12px" }}
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
          </form>
        )}

        <div 
          className={`note-item ${!activeFolderId ? "active" : ""}`}
          style={{ padding: "8px 12px", gap: "4px", flexDirection: "row", alignItems: "center" }}
          onClick={() => onSelectFolder(null)}
        >
          <Folder size={14} />
          <span className="note-item-title" style={{ fontSize: "13px" }}>All Notes</span>
        </div>

        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`note-item ${activeFolderId === folder.id ? "active" : ""}`}
            style={{ padding: "8px 12px", gap: "4px", flexDirection: "row", alignItems: "center" }}
            onClick={() => onSelectFolder(folder.id)}
          >
            <Folder size={14} />
            <span className="note-item-title" style={{ fontSize: "13px" }}>{folder.name}</span>
          </div>
        ))}

        <div style={{ height: "1px", background: "var(--border)", margin: "14px 0" }} />

        {/* Dynamic Notes List */}
        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
          Notes
        </span>

        {filteredNotes.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "12px", padding: "20px 0" }}>
            No notes found
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${activeNoteId === note.id ? "active" : ""}`}
              onClick={() => onSelectNote(note.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FileText size={14} style={{ flexShrink: 0 }} />
                <span className="note-item-title">{note.title || "Untitled Note"}</span>
              </div>
              {note.preview && <p className="note-item-preview">{note.preview}</p>}
              <span className="note-item-date">{note.updatedAt || note.date}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default NotesSidebar;