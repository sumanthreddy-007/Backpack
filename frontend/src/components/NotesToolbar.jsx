import { useState, useEffect, useRef } from "react";
import {
  Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Pilcrow, Highlighter, List, ListOrdered,
  ListTodo, Quote, Code2, Minus, Table2, ImagePlus, Link2, Printer, Plus,
  Trash2, Columns2, Rows2, Pencil, Type, Eraser, RotateCcw, X
} from "lucide-react";

function NotesToolbar({ editor, drawingMode, setDrawingMode, drawingTool, setDrawingTool, updateSlide }) {
  const [tableOpen, setTableOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const tableRef = useRef(null);
  const resetRef = useRef(null);

  useEffect(() => {
    const clickOut = (e) => {
      if (tableRef.current && !tableRef.current.contains(e.target)) setTableOpen(false);
      if (resetRef.current && !resetRef.current.contains(e.target)) setResetOpen(false);
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  if (!editor || editor.isDestroyed) return null;

  const Button = ({ icon: Icon, title, active = false, disabled = false, onClick }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`toolbar-btn ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={2.2} />
    </button>
  );

  const Divider = () => <div className="toolbar-divider" />;

  const insertImage = () => {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Enter URL");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const isInsideTable = editor.isActive("table");

  return (
    <div className="notes-toolbar">
      {/* Mode Selectors */}
      <div className="toolbar-group">
        <Button icon={Type} title="Text Mode" active={!drawingMode} onClick={() => setDrawingMode(false)} />
        <Button icon={Pencil} title="Pencil" active={drawingMode && drawingTool === "pencil"} onClick={() => { setDrawingMode(true); setDrawingTool("pencil"); }} />
        <Button icon={Eraser} title="Eraser" active={drawingMode && drawingTool === "eraser"} onClick={() => { setDrawingMode(true); setDrawingTool("eraser"); }} />
      </div>

      <Divider />

      {/* Reset Action (Horizontal Expand Inline Drawer) */}
      <div className="toolbar-group" ref={resetRef}>
        <button type="button" title="Reset Slide Options" className={`toolbar-btn ${resetOpen ? "active" : ""}`} onClick={() => setResetOpen(!resetOpen)}>
          {resetOpen ? <X size={16} /> : <RotateCcw size={16} />}
        </button>
        {resetOpen && (
          <div className="inline-drawer">
            <button type="button" className="inline-action-btn" onClick={() => { if (window.confirm("Clear drawings?")) updateSlide({ drawings: [] }); setResetOpen(false); }}>
              <Eraser size={13} /> Drawings
            </button>
            <button type="button" className="inline-action-btn" onClick={() => { if (window.confirm("Clear text?")) editor.chain().focus().clearContent().run(); setResetOpen(false); }}>
              <Pilcrow size={13} /> Text
            </button>
            <button type="button" className="inline-action-btn danger" onClick={() => { if (window.confirm("Clear all?")) { editor.chain().focus().clearContent().run(); updateSlide({ drawings: [] }); } setResetOpen(false); }}>
              <Trash2 size={13} /> All
            </button>
          </div>
        )}
      </div>

      <Divider />

      {/* History */}
      <div className="toolbar-group">
        <Button icon={Undo2} title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <Button icon={Redo2} title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </div>

      <Divider />

      {/* Headers */}
      <div className="toolbar-group">
        <Button icon={Heading1} title="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <Button icon={Heading2} title="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Button icon={Heading3} title="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Button icon={Pilcrow} title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} />
      </div>

      <Divider />

      {/* Marks */}
      <div className="toolbar-group">
        <Button icon={Bold} title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Button icon={Italic} title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Button icon={UnderlineIcon} title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Button icon={Strikethrough} title="Strike" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <Button icon={Highlighter} title="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} />
      </div>

      <Divider />

      {/* Lists */}
      <div className="toolbar-group">
        <Button icon={List} title="Bullet List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Button icon={ListOrdered} title="Numbered List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Button icon={ListTodo} title="Task List" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      </div>

      <Divider />

      {/* Containers */}
      <div className="toolbar-group">
        <Button icon={Quote} title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Button icon={Code2} title="Code Block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <Button icon={Minus} title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </div>

      <Divider />

      {/* Tables Drawer */}
      <div className="toolbar-group" ref={tableRef}>
        <button type="button" title="Table" className={`toolbar-btn ${tableOpen ? "active" : ""}`} onClick={() => setTableOpen(!tableOpen)}>
          {tableOpen ? <X size={16} /> : <Table2 size={16} />}
        </button>
        {tableOpen && (
          <div className="inline-drawer">
            <button type="button" className="inline-action-btn" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setTableOpen(false); }}>
              <Plus size={13} /> Create
            </button>
            {isInsideTable && (
              <>
                <button type="button" className="inline-action-btn" onClick={() => editor.chain().focus().addColumnBefore().run()}>+Col</button>
                <button type="button" className="inline-action-btn" onClick={() => editor.chain().focus().addRowAfter().run()}>+Row</button>
                <button type="button" className="inline-action-btn danger" onClick={() => editor.chain().focus().deleteColumn().run()}>-Col</button>
                <button type="button" className="inline-action-btn danger" onClick={() => editor.chain().focus().deleteRow().run()}>-Row</button>
              </>
            )}
          </div>
        )}
      </div>

      <Divider />

      {/* Media & Misc */}
      <div className="toolbar-group">
        <Button icon={ImagePlus} title="Image" onClick={insertImage} />
        <Button icon={Link2} title="Link" active={editor.isActive("link")} onClick={insertLink} />
        <Button icon={Printer} title="Print" onClick={() => window.print()} />
      </div>
    </div>
  );
}

export default NotesToolbar;