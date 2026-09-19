import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Download, Save } from "lucide-react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import CharacterCount from "@tiptap/extension-character-count";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import NotesToolbar from "./NotesToolbar";
import Slide from "./Slide";

const API = "http://127.0.0.1:8000";
const extensions = [
  StarterKit, Underline, Highlight.configure({ multicolor: true }), Image.configure({ allowBase64: true }),
  Link.configure({ openOnClick: false }), Placeholder.configure({ placeholder: "Start writing..." }), Typography,
  TextStyle, Color, TextAlign.configure({ types: ["heading", "paragraph"] }), CharacterCount, Dropcursor, Gapcursor,
  Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, TaskList, TaskItem.configure({ nested: true }),
];

function NotesEditor({ note, reloadNotes, onDirtyChange }) {
  const saveTimer = useRef(null);
  const slidesRef = useRef([]);
  const titleRef = useRef("");
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState("pencil");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState("");

  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => { titleRef.current = title; }, [title]);

  useEffect(() => {
    if (!note) return;
    setTitle(note.title || "Untitled Note");
    const stored = note.content?.slides;
    setSlides(Array.isArray(stored) && stored.length ? stored : [{ id: Date.now(), content: note.content || { type: "doc", content: [{ type: "paragraph" }] }, drawings: [] }]);
    setActiveSlide(0);
    setDirty(false);
    setLastSaved(note.updated_at ? new Date(note.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
  }, [note]);

  const editor = useEditor({ extensions, autofocus: false, content: {}, editorProps: { attributes: { class: "ProseMirror" } } });

  useEffect(() => {
    if (!editor || !slides.length || editor.isDestroyed) return;
    const current = slides[activeSlide];
    if (!current) return;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(current.content || {})) editor.commands.setContent(current.content || {}, false);
  }, [editor, activeSlide, slides]);

  const markDirty = () => { setDirty(true); onDirtyChange?.(note?.id, true); };

  const queueSave = () => {
    markDirty();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(), 900);
  };

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      if (editor.isDestroyed) return;
      const json = editor.getJSON();
      setSlides((prev) => {
        if (!prev[activeSlide] || JSON.stringify(prev[activeSlide].content) === JSON.stringify(json)) return prev;
        const copy = [...prev];
        copy[activeSlide] = { ...copy[activeSlide], content: json };
        return copy;
      });
      queueSave();
    };
    editor.on("update", handleUpdate);
    return () => editor.off("update", handleUpdate);
  }, [editor, activeSlide, note]);

  const updateCurrentSlide = (updates) => {
    setSlides((prev) => {
      if (!prev[activeSlide]) return prev;
      const copy = [...prev];
      copy[activeSlide] = { ...copy[activeSlide], ...updates };
      return copy;
    });
    queueSave();
  };

  const createSlide = () => {
    setSlides((prev) => [...prev, { id: Date.now(), content: { type: "doc", content: [{ type: "paragraph" }] }, drawings: [] }]);
    setActiveSlide(slides.length);
    markDirty();
  };

  const saveNote = async () => {
    if (!note || saving) return;
    setSaving(true);
    try {
      await axios.put(`${API}/api/notes/${note.id}`, {
        title: titleRef.current.trim() || "Untitled Note",
        folder: note.folder || "General",
        content: { slides: slidesRef.current },
      });
      setDirty(false);
      onDirtyChange?.(note.id, false);
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      reloadNotes?.();
    } catch (error) {
      console.error("Failed to save note", error);
      setDirty(true);
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (dirty) await saveNote();
    try {
      const res = await axios.post(`${API}/pdf/note-to-pdf`, { title: titleRef.current, content: { slides: slidesRef.current } }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(titleRef.current || "note").replace(/[^a-z0-9._ -]/gi, "") || "note"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Note PDF export failed", error);
      alert("Could not create the PDF. Make sure the Backpack backend is running.");
    }
  };

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const handlePaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((entry) => entry.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { if (!editor.isDestroyed) editor.chain().focus().setImage({ src: reader.result }).run(); };
      reader.readAsDataURL(file);
      e.preventDefault();
    };
    dom.addEventListener("paste", handlePaste);
    return () => dom.removeEventListener("paste", handlePaste);
  }, [editor]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNote(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [note, saving]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!editor) return <div className="notes-editor-empty">Loading editor…</div>;
  const words = editor.storage.characterCount?.words?.() || 0;
  const characters = editor.storage.characterCount?.characters?.() || 0;

  return (
    <section className="notes-editor" aria-label="Note editor">
      <NotesToolbar editor={editor} drawingMode={drawingMode} setDrawingMode={setDrawingMode} drawingTool={drawingTool} setDrawingTool={setDrawingTool} updateSlide={updateCurrentSlide} />

      <div className="editor-header">
        <div className="note-title-wrap">
          <input className="note-title-input" value={title} placeholder="Untitled" aria-label="File name" onChange={(e) => { setTitle(e.target.value); queueSave(); }} />
          {dirty && <span className="unsaved-dot" title="Unsaved changes" aria-label="Unsaved changes" />}
        </div>
        <div className="editor-actions">
          <span className="editor-guide">{saving ? "Saving…" : dirty ? "Unsaved changes" : lastSaved ? `Saved ${lastSaved}` : "Saved"}</span>
          <button className="editor-action-btn" onClick={saveNote} disabled={saving} title="Save (Ctrl+S)"><Save size={15} /> Save</button>
          <button className="editor-action-btn" onClick={exportPdf} title="Export note to PDF"><Download size={15} /> PDF</button>
        </div>
      </div>

      <div className="editor-subbar">
        <span>Page {slides.length ? activeSlide + 1 : 0} / {slides.length}</span>
        <span>{words} words</span><span>{characters} characters</span>
        <span className="editor-tip">Tip: press <kbd>Ctrl+S</kbd> anytime to save.</span>
      </div>

      <div className="slide-controls">
        <button onClick={() => setActiveSlide((i) => Math.max(0, i - 1))} disabled={activeSlide === 0}>◀ Previous</button>
        <button onClick={createSlide}>+ New Page</button>
        <button onClick={() => setActiveSlide((i) => Math.min(slides.length - 1, i + 1))} disabled={activeSlide >= slides.length - 1}>Next ▶</button>
      </div>

      {slides[activeSlide] && <Slide editor={editor} drawingMode={drawingMode} drawingTool={drawingTool} slide={slides[activeSlide]} updateSlide={updateCurrentSlide} />}
    </section>
  );
}

export default NotesEditor;
