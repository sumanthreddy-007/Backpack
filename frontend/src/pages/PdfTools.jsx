import { useState } from "react";
import axios from "axios";

function PdfTools() {
  const [activeTool, setActiveTool] = useState("word");

  const [wordFile, setWordFile] = useState(null);

  const [rotateFile, setRotateFile] = useState(null);
  const [angle, setAngle] = useState(90);

  const [splitFile, setSplitFile] = useState(null);
  const [pageNumber, setPageNumber] = useState("");

  const [deleteFile, setDeleteFile] = useState(null);
  const [pages, setPages] = useState("");

  const [mergeFiles, setMergeFiles] = useState([]);

  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);
  };

  const wordToPdf = async () => {
    if (!wordFile) return;

    const formData = new FormData();
    formData.append("file", wordFile);

    const res = await axios.post(
      "http://127.0.0.1:8000/pdf/word-to-pdf",
      formData,
      { responseType: "blob" }
    );

    downloadFile(res.data, "converted.pdf");
  };

  const rotatePdf = async () => {
    if (!rotateFile) return;

    const formData = new FormData();
    formData.append("file", rotateFile);
    formData.append("angle", angle);

    const res = await axios.post(
      "http://127.0.0.1:8000/pdf/rotate",
      formData,
      { responseType: "blob" }
    );

    downloadFile(res.data, "rotated.pdf");
  };

  const splitPdf = async () => {
    if (!splitFile || !pageNumber) return;

    const formData = new FormData();
    formData.append("file", splitFile);
    formData.append("page_number", pageNumber);

    const res = await axios.post(
      "http://127.0.0.1:8000/pdf/split",
      formData,
      { responseType: "blob" }
    );

    downloadFile(res.data, `page_${pageNumber}.pdf`);
  };

  const deletePages = async () => {
    if (!deleteFile || !pages) return;

    const formData = new FormData();
    formData.append("file", deleteFile);
    formData.append("pages", pages);

    const res = await axios.post(
      "http://127.0.0.1:8000/pdf/delete-pages",
      formData,
      { responseType: "blob" }
    );

    downloadFile(res.data, "pages_deleted.pdf");
  };

  const mergePdf = async () => {
    if (mergeFiles.length < 2) return;

    const formData = new FormData();

    for (let file of mergeFiles) {
      formData.append("files", file);
    }

    const res = await axios.post(
      "http://127.0.0.1:8000/pdf/merge",
      formData,
      { responseType: "blob" }
    );

    downloadFile(res.data, "merged.pdf");
  };

  return (
    <div className="pdf-page">
      <div className="pdf-header">
        <h1>PDF Workspace</h1>
        <p>Convert, rotate, split, delete, and merge your PDF files.</p>
        <div className="workspace-tip">Tip: files are processed by the Backpack backend. Notes can also be exported directly from the Notes editor.</div>
      </div>

      <div className="pdf-body">
        <div className="pdf-tabs">
          <div
            className={`pdf-tab ${activeTool === "word" ? "active" : ""}`}
            onClick={() => setActiveTool("word")}
          >
            Word → PDF
          </div>
          <div
            className={`pdf-tab ${activeTool === "rotate" ? "active" : ""}`}
            onClick={() => setActiveTool("rotate")}
          >
            Rotate
          </div>
          <div
            className={`pdf-tab ${activeTool === "split" ? "active" : ""}`}
            onClick={() => setActiveTool("split")}
          >
            Split
          </div>
          <div
            className={`pdf-tab ${activeTool === "delete" ? "active" : ""}`}
            onClick={() => setActiveTool("delete")}
          >
            Delete Pages
          </div>
          <div
            className={`pdf-tab ${activeTool === "merge" ? "active" : ""}`}
            onClick={() => setActiveTool("merge")}
          >
            Merge
          </div>
        </div>

        <div className="page-card">
          {activeTool === "word" && (
            <>
              <h2>Word to PDF</h2>

              <input
                type="file"
                accept=".docx"
                className="page-input"
                onChange={(e) => setWordFile(e.target.files[0])}
              />

              <br /><br />

              <button className="page-btn" onClick={wordToPdf}>
                Convert PDF
              </button>
            </>
          )}

          {activeTool === "rotate" && (
            <>
              <h2>Rotate PDF</h2>

              <input
                type="file"
                accept=".pdf"
                className="page-input"
                onChange={(e) => setRotateFile(e.target.files[0])}
              />

              <br /><br />

              <input
                type="number"
                className="page-input"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="90"
              />

              <br /><br />

              <button className="page-btn" onClick={rotatePdf}>
                Rotate PDF
              </button>
            </>
          )}

          {activeTool === "split" && (
            <>
              <h2>Split PDF</h2>

              <input
                type="file"
                accept=".pdf"
                className="page-input"
                onChange={(e) => setSplitFile(e.target.files[0])}
              />

              <br /><br />

              <input
                type="number"
                className="page-input"
                placeholder="Page Number"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
              />

              <br /><br />

              <button className="page-btn" onClick={splitPdf}>
                Split PDF
              </button>
            </>
          )}

          {activeTool === "delete" && (
            <>
              <h2>Delete Pages</h2>

              <input
                type="file"
                accept=".pdf"
                className="page-input"
                onChange={(e) => setDeleteFile(e.target.files[0])}
              />

              <br /><br />

              <input
                type="text"
                className="page-input"
                placeholder="1,3,5 or 1-5"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              />

              <br /><br />

              <button className="page-btn" onClick={deletePages}>
                Delete Pages
              </button>
            </>
          )}

          {activeTool === "merge" && (
            <>
              <h2>Merge PDFs</h2>

              <input
                type="file"
                accept=".pdf"
                multiple
                className="page-input"
                onChange={(e) => setMergeFiles(Array.from(e.target.files))}
              />

              <br /><br />

              <button className="page-btn" onClick={mergePdf}>
                Merge PDFs
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PdfTools;