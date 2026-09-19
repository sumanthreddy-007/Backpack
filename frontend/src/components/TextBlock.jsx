import { useEffect, useRef } from "react";
import { EditorContent } from "@tiptap/react";

function TextBlock({ editor }) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !wrapperRef.current) return;

    const applyAttributes = () => {
      if (editor.isDestroyed) return;

      const editorDOM =
        wrapperRef.current?.querySelector(".ProseMirror");

      if (!editorDOM) return;

      editorDOM.setAttribute("spellcheck", "true");
      editorDOM.setAttribute("autocomplete", "off");
      editorDOM.setAttribute("autocorrect", "on");
      editorDOM.setAttribute("autocapitalize", "sentences");
    };

    applyAttributes();

    editor.on("transaction", applyAttributes);

    return () => {
      if (!editor.isDestroyed) {
        editor.off("transaction", applyAttributes);
      }
    };
  }, [editor]);

  if (!editor || editor.isDestroyed) return null;

  const handleWrapperClick = (e) => {
    if (e.target !== wrapperRef.current) return;

    if (!editor.isDestroyed) {
      editor.commands.focus();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="text-block"
      onClick={handleWrapperClick}
      style={{
        cursor: "text",
        height: "100%",
      }}
    >
      <EditorContent
        editor={editor}
        className="editor-content"
      />
    </div>
  );
}

export default TextBlock;