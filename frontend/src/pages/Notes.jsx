import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FolderPlus, FilePlus, MoreHorizontal, Trash2, X } from "lucide-react";
import NotesEditor from "../components/NotesEditor";
import "../Notes.css";

const API = "http://127.0.0.1:8000/api";

const emptyNoteContent = () => ({
  slides: [{
    id: Date.now(),
    content: { type: "doc", content: [{ type: "paragraph" }] },
    drawings: [],
  }],
});

function NameDialog({ open, title, placeholder, onClose, onSubmit }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const clean = value.trim().replace(/\s+/g, " ");
    if (!clean) {
      setError("Enter a name first.");
      inputRef.current?.focus();
      return;
    }
    try {
      setError("");
      await onSubmit(clean);
    } catch (error) {
      setError(error?.response?.data?.detail || "Could not create this item.");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="notes-modal-backdrop" onMouseDown={onClose}>
      <div className="notes-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <button className="notes-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <h3>{title}</h3>
        <input
          ref={inputRef}
          value={value}
          maxLength={200}
          placeholder={placeholder}
          aria-label="Name"
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
          }}
        />
        {error && <div className="notes-modal-error" role="alert">{error}</div>}
        <div className="notes-modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}

function Notes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [activeFolder, setActiveFolder] = useState("All");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(null);
  const [contextNote, setContextNote] = useState(null);
  const [dirtyNotes, setDirtyNotes] = useState(new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async (keepActive = true) => {
    const [notesRes, foldersRes] = await Promise.all([
      axios.get(`${API}/notes`),
      axios.get(`${API}/folders`),
    ]);
    const loadedNotes = Array.isArray(notesRes.data) ? notesRes.data : [];
    const loadedFolders = Array.isArray(foldersRes.data) ? foldersRes.data : [];
    setNotes(loadedNotes);
    setFolders(loadedFolders);
    if (keepActive && (!activeNoteId || !loadedNotes.some((n) => n.id === activeNoteId))) {
      setActiveNoteId(loadedNotes[0]?.id ?? null);
    }
  }, [activeNoteId]);

  useEffect(() => {
    load().catch((e) => {
      console.error("Failed to load notes", e);
      setStatus("Could not load notes. Is the backend running?");
    });
  }, [load]);

  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      const folderMatch = activeFolder === "All" || note.folder === activeFolder;
      const textMatch = !q || String(note.title || "").toLowerCase().includes(q);
      return folderMatch && textMatch;
    });
  }, [notes, activeFolder, query]);

  const activeNote = notes.find((note) => note.id === activeNoteId) || null;

  const openDialog = useCallback((type) => {
    setContextNote(null);
    setStatus("");
    setDialog(type);
  }, []);

  const createNote = useCallback(async (title) => {
    const folder = activeFolder === "All" ? "General" : activeFolder;
    const res = await axios.post(`${API}/notes`, {
      title,
      folder,
      content: emptyNoteContent(),
    });
    const newId = res.data?.id;
    if (!newId) throw new Error("The server did not return the new note ID.");
    await load(false);
    setActiveNoteId(newId);
    setDialog(null);
    setStatus(`Created ${title}`);
  }, [activeFolder, load]);

  const createFolder = useCallback(async (name) => {
    const exists = folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new Error("A folder with this name already exists.");
    const res = await axios.post(`${API}/folders`, { name });
    if (!res.data?.id) throw new Error("The server did not return the new folder ID.");
    await load(false);
    setActiveFolder(name);
    setDialog(null);
    setStatus(`Created folder ${name}`);
  }, [folders, load]);

  const renameFolder = async (folder) => {
    const name = window.prompt("Folder name", folder.name)?.trim();
    if (!name) return;
    try {
      await axios.put(`${API}/folders/${folder.id}`, { new_name: name });
      await load(false);
      if (activeFolder === folder.name) setActiveFolder(name);
      setStatus(`Renamed folder to ${name}`);
    } catch (error) {
      setStatus(error?.response?.data?.detail || "Could not rename folder.");
    }
  };

  const deleteFolder = async (folder) => {
    if (folder.name === "General") return;
    if (!window.confirm(`Delete '${folder.name}'? Notes will move to General.`)) return;
    try {
      await axios.delete(`${API}/folders/${folder.id}`);
      await load(false);
      setActiveFolder("All");
      setStatus(`Deleted folder ${folder.name}`);
    } catch (error) {
      setStatus(error?.response?.data?.detail || "Could not delete folder.");
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await axios.delete(`${API}/notes/${id}`);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      setActiveNoteId(remaining[0]?.id ?? null);
      setContextNote(null);
      setDirtyNotes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setStatus("Note deleted");
    } catch (error) {
      setStatus(error?.response?.data?.detail || "Could not delete note.");
    }
  };

  const moveSelection = useCallback((direction) => {
    if (!visibleNotes.length) return;
    const index = visibleNotes.findIndex((n) => n.id === activeNoteId);
    const next = Math.max(0, Math.min(visibleNotes.length - 1, index < 0 ? 0 : index + direction));
    setActiveNoteId(visibleNotes[next].id);
  }, [visibleNotes, activeNoteId]);

  useEffect(() => {
    const handler = (e) => {
      const key = e.key.toLowerCase();
      const target = e.target;
      const typing = ["INPUT", "TEXTAREA"].includes(target?.tagName) || target?.isContentEditable;

      // Browser-reserved shortcuts are also supported with Alt fallbacks.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === "n") {
        e.preventDefault();
        e.stopPropagation();
        openDialog("note");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        e.stopPropagation();
        openDialog("folder");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && key === "n") {
        e.preventDefault();
        openDialog("note");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && key === "n") {
        e.preventDefault();
        openDialog("folder");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        // NotesEditor owns the actual save. This only prevents the browser Save Page dialog.
        e.preventDefault();
        return;
      }
      if (e.shiftKey && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (dialog) setDialog(null);
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.querySelector(".notes-sidebar-search")?.focus();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === "ArrowDown" && target?.closest(".notes-list") && !typing) {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === "ArrowUp" && target?.closest(".notes-list") && !typing) {
        e.preventDefault();
        moveSelection(-1);
      }
    };

    // Capture phase makes the shortcuts work even when a child editor has focus.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [dialog, shortcutsOpen, moveSelection, openDialog]);

  return (
    <div className="notes-page">
      <aside className="notes-sidebar" aria-label="Notebook files">
        <div className="notes-sidebar-header">
          <div className="notes-sidebar-title-row">
            <strong>Explorer</strong>
            <div className="notes-sidebar-actions">
              <button type="button" title="New file (Ctrl+N or Ctrl+Alt+N)" aria-label="New file" onClick={() => openDialog("note")}><FilePlus size={15} /></button>
              <button type="button" title="New folder (Ctrl+Shift+N or Ctrl+Alt+Shift+N)" aria-label="New folder" onClick={() => openDialog("folder")}><FolderPlus size={15} /></button>
            </div>
          </div>
          <input className="notes-sidebar-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files..." aria-label="Search files" />
        </div>

        <div className="notes-folder-list">
          <button type="button" className={`folder-row ${activeFolder === "All" ? "active" : ""}`} onClick={() => setActiveFolder("All")}><span aria-hidden="true">⌄</span><span>Backpack</span></button>
          {folders.map((folder) => (
            <div key={folder.id} className={`folder-row-wrap ${activeFolder === folder.name ? "active" : ""}`}>
              <button type="button" className="folder-row" onClick={() => setActiveFolder(folder.name)}><span aria-hidden="true">▸</span><span>{folder.name}</span></button>
              {folder.name !== "General" && (
                <>
                  <button type="button" className="folder-menu" title="Rename folder" aria-label={`Rename ${folder.name}`} onClick={() => renameFolder(folder)}><MoreHorizontal size={14} /></button>
                  <button type="button" className="folder-menu" title="Delete folder" aria-label={`Delete ${folder.name}`} onClick={() => deleteFolder(folder)}><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="notes-list" tabIndex={0} aria-label="Notes">
          {visibleNotes.length === 0 && <div className="notes-empty-list">No files here.<br />Use + to create one.</div>}
          {visibleNotes.map((note) => (
            <div key={note.id} className={`note-item ${activeNoteId === note.id ? "active" : ""}`}>
              <button type="button" className="note-item-main" onClick={() => { setActiveNoteId(note.id); setContextNote(null); }}>
                <span className="note-file-icon">N</span>
                <span className="note-item-title">{note.title || "Untitled Note"}</span>
                {dirtyNotes.has(note.id) && <span className="note-unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
              </button>
              {contextNote === note.id ? (
                <button type="button" className="note-delete" title="Delete note" onClick={() => deleteNote(note.id)}><Trash2 size={13} /></button>
              ) : (
                <button type="button" className="note-more" title="File options" onClick={() => setContextNote(note.id)}><MoreHorizontal size={14} /></button>
              )}
            </div>
          ))}
        </div>

        <div className="notes-sidebar-guide">
          <span>{status || "Tip"}</span><br />
          <kbd>Ctrl+N</kbd> file · <kbd>Ctrl+Shift+N</kbd> folder · <kbd>Ctrl+S</kbd> save · <kbd>Shift+?</kbd> help
        </div>
      </aside>

      {activeNote ? (
        <NotesEditor
          note={activeNote}
          reloadNotes={load}
          onDirtyChange={(id, isDirty) => setDirtyNotes((prev) => {
            const next = new Set(prev);
            if (isDirty) next.add(id); else next.delete(id);
            return next;
          })}
        />
      ) : (
        <div className="notes-editor-empty">
          <FilePlus size={22} />
          <p>Create a file to start writing.</p>
          <small>Use the + file button or Ctrl+Alt+N if your browser captures Ctrl+N.</small>
        </div>
      )}

      {shortcutsOpen && (
        <div className="shortcuts-backdrop" onMouseDown={() => setShortcutsOpen(false)}>
          <div className="shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="shortcuts-close" onClick={() => setShortcutsOpen(false)} aria-label="Close"><X size={16} /></button>
            <h3>Keyboard Shortcuts</h3>
            <p>Use the keyboard to navigate Backpack. Some browsers reserve Ctrl+N and Ctrl+Shift+N, so Alt fallbacks are included.</p>
            <div className="shortcut-grid">
              {[
                ["Ctrl + N", "New file"], ["Ctrl + Shift + N", "New subject folder"],
                ["Ctrl + Alt + N", "New file (browser-safe fallback)"], ["Ctrl + Alt + Shift + N", "New folder (browser-safe fallback)"],
                ["Ctrl + S", "Save current note"], ["/", "Focus search"],
                ["Alt + ← / →", "Previous / next notebook file"], ["↑ / ↓", "Move through file list"],
                ["Tab", "Next control"], ["Shift + Tab", "Previous control"],
                ["Enter / Space", "Activate focused control"], ["Home / End", "First / last control"],
                ["Shift + ?", "Open shortcuts"], ["Esc", "Close popup / dialog"],
              ].map(([key, label]) => <div className="shortcut-row" key={key}><kbd>{key}</kbd><span>{label}</span></div>)}
            </div>
          </div>
        </div>
      )}

      <NameDialog open={dialog === "note"} title="New file" placeholder="e.g. Machine Learning Notes" onClose={() => setDialog(null)} onSubmit={createNote} />
      <NameDialog open={dialog === "folder"} title="New subject folder" placeholder="e.g. Computer Networks" onClose={() => setDialog(null)} onSubmit={createFolder} />
    </div>
  );
}

export default Notes;
