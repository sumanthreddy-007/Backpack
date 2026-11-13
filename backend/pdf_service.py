import os
import re
import uuid
from fastapi import UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from docx import Document
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from pypdf import PdfReader, PdfWriter

# Assuming these are imported from your custom sandbox module
from sandbox import create_sandbox, cleanup_after_delay

def validate_pdf(file: UploadFile) -> bool:
    return bool(file.filename and file.filename.lower().endswith(".pdf"))


def read_valid_pdf(path: str):
    """Validate the PDF signature, parse strictly, and cap page count."""
    try:
        with open(path, "rb") as source:
            if source.read(5) != b"%PDF-":
                raise HTTPException(status_code=400, detail="The uploaded file is not a PDF.")
        reader = PdfReader(path, strict=True)
        if reader.is_encrypted:
            raise HTTPException(status_code=400, detail="Password-protected PDFs are not supported.")
        if len(reader.pages) > 500:
            raise HTTPException(status_code=413, detail="PDFs are limited to 500 pages.")
        return reader
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The PDF is damaged or could not be safely read.")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

async def save_upload_file(file: UploadFile, session_folder: str) -> str:
    raw_name = os.path.basename((file.filename or "upload").replace("\\", "/"))
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", raw_name) or "upload"
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 15 MB upload limit")
    # Unique names prevent duplicate uploads overwriting each other.
    file_path = os.path.join(session_folder, f"{uuid.uuid4().hex}_{safe_name}")
    with open(file_path, "wb") as output:
        output.write(content)
    return file_path

def create_response(session_folder: str, output_path: str, filename: str, background_tasks: BackgroundTasks):
    # Schedule the cleanup to run AFTER the file has been successfully sent
    background_tasks.add_task(cleanup_after_delay, session_folder)
    
    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename=filename
    )

def parse_pages(pages: str) -> set:
    page_set = set()
    try:
        for part in pages.split(","):
            part = part.strip()
            if "-" in part:
                start, end = map(int, part.split("-"))
                page_set.update(range(start, end + 1))
            elif part.isdigit():
                page_set.add(int(part))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page range format. Use e.g., '1-3, 5'")
    return page_set

async def word_to_pdf(file: UploadFile, background_tasks: BackgroundTasks):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are allowed")

    session_folder = create_sandbox()
    docx_path = await save_upload_file(file, session_folder)
    
    try:
        with open(docx_path, "rb") as source:
            if source.read(4) != b"PK\x03\x04":
                raise HTTPException(status_code=400, detail="The uploaded file is not a valid DOCX document.")
        document = Document(docx_path)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The DOCX file is damaged or could not be read.")
    safe_stem = os.path.splitext(os.path.basename((file.filename or "document").replace("\\", "/")))[0]
    safe_stem = re.sub(r"[^A-Za-z0-9._-]", "_", safe_stem) or "document"
    pdf_name = safe_stem + ".pdf"
    pdf_path = os.path.join(session_folder, pdf_name)
    
    pdf = SimpleDocTemplate(pdf_path)
    styles = getSampleStyleSheet()
    content = []
    
    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            continue
            
        style = styles["Heading1"] if "Heading" in para.style.name else styles["Normal"]
        content.append(Paragraph(text, style))
        content.append(Spacer(1, 10))
        
    if not content:
        content.append(Paragraph("Empty document", styles["Normal"]))
        
    pdf.build(content)
    
    return create_response(session_folder, pdf_path, pdf_name, background_tasks)

async def merge_pdfs(files: list[UploadFile], background_tasks: BackgroundTasks):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least 2 PDFs")
        
    session_folder = create_sandbox()
    writer = PdfWriter()
    
    for file in files:
        if not validate_pdf(file):
            raise HTTPException(status_code=400, detail=f"{file.filename} is not a valid PDF")
            
        pdf_path = await save_upload_file(file, session_folder)
        reader = read_valid_pdf(pdf_path)
        
        for page in reader.pages:
            writer.add_page(page)
            
    output_path = os.path.join(session_folder, "merged.pdf")
    with open(output_path, "wb") as f:
        writer.write(f)
        
    return create_response(session_folder, output_path, "merged.pdf", background_tasks)

async def split_pdf(file: UploadFile, page_number: int, background_tasks: BackgroundTasks):
    if not validate_pdf(file):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
    session_folder = create_sandbox()
    pdf_path = await save_upload_file(file, session_folder)
    
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    if page_number < 1 or page_number > total_pages:
        raise HTTPException(
            status_code=400, 
            detail=f"Page number must be between 1 and {total_pages}"
        )
        
    writer = PdfWriter()
    writer.add_page(reader.pages[page_number - 1])
    
    output_path = os.path.join(session_folder, f"page_{page_number}.pdf")
    with open(output_path, "wb") as f:
        writer.write(f)
        
    return create_response(session_folder, output_path, f"page_{page_number}.pdf", background_tasks)

async def rotate_pdf(file: UploadFile, angle: int, background_tasks: BackgroundTasks):
    if angle not in [90, 180, 270, 360]:
        raise HTTPException(status_code=400, detail="Angle must be 90, 180, 270, or 360 degrees")
        
    if not validate_pdf(file):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
    session_folder = create_sandbox()
    pdf_path = await save_upload_file(file, session_folder)
    
    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    
    for page in reader.pages:
        page.rotate(angle)
        writer.add_page(page)
        
    output_path = os.path.join(session_folder, "rotated.pdf")
    with open(output_path, "wb") as f:
        writer.write(f)
        
    return create_response(session_folder, output_path, "rotated.pdf", background_tasks)

async def delete_pages(file: UploadFile, pages: str, background_tasks: BackgroundTasks):
    if not validate_pdf(file):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
        
    session_folder = create_sandbox()
    pdf_path = await save_upload_file(file, session_folder)
    
    reader = PdfReader(pdf_path)
    remove_pages = parse_pages(pages)
    writer = PdfWriter()
    
    for index, page in enumerate(reader.pages, start=1):
        if index not in remove_pages:
            writer.add_page(page)
            
    if len(writer.pages) == 0:
        raise HTTPException(status_code=400, detail="Cannot delete all pages; PDF would be empty")
        
    output_path = os.path.join(session_folder, "pages_deleted.pdf")
    with open(output_path, "wb") as f:
        writer.write(f)
        
    return create_response(session_folder, output_path, "pages_deleted.pdf", background_tasks)
async def note_to_pdf(payload: dict, background_tasks: BackgroundTasks):
    """Render notebook pages using the same canonical 900x1200 coordinate space as Notes."""
    import re
    from io import BytesIO
    from html import escape

    from PIL import Image, ImageDraw
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph

    CANVAS_WIDTH = 900
    CANVAS_HEIGHT = 1200
    PAGE_WIDTH, PAGE_HEIGHT = A4

    title = str(payload.get("title") or "Untitled Note").strip() or "Untitled Note"
    content = payload.get("content") or {}
    slides = content.get("slides") if isinstance(content, dict) else None
    if not isinstance(slides, list) or not slides:
        slides = [{"content": content if isinstance(content, dict) else {}, "drawings": []}]

    session_folder = create_sandbox()
    safe_title = re.sub(r"[^A-Za-z0-9._ -]", "", title).strip() or "note"
    pdf_name = f"{safe_title}.pdf"
    pdf_path = os.path.join(session_folder, pdf_name)

    # Use one uniform scale so a point drawn at (x, y) remains at exactly the
    # same relative position on the exported page. No text-flow-dependent
    # drawing placement is used anymore.
    scale = min(PAGE_WIDTH / CANVAS_WIDTH, PAGE_HEIGHT / CANVAS_HEIGHT)
    render_width = CANVAS_WIDTH * scale
    render_height = CANVAS_HEIGHT * scale
    offset_x = (PAGE_WIDTH - render_width) / 2
    offset_y = (PAGE_HEIGHT - render_height) / 2

    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "BackpackBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        textColor="#111111",
        spaceAfter=9,
    )
    heading_styles = {
        "heading": ParagraphStyle("BackpackHeading", parent=body_style, fontSize=24, leading=29, spaceAfter=14),
        "heading2": ParagraphStyle("BackpackHeading2", parent=body_style, fontSize=19, leading=24, spaceAfter=11),
        "heading3": ParagraphStyle("BackpackHeading3", parent=body_style, fontSize=15, leading=20, spaceAfter=9),
    }

    pdf = canvas.Canvas(pdf_path, pagesize=A4)

    def collect_text_nodes(node, blocks=None):
        blocks = [] if blocks is None else blocks
        if not isinstance(node, dict):
            return blocks
        node_type = node.get("type", "")
        if node_type in {"paragraph", "heading", "blockquote", "codeBlock"}:
            text = ""
            for child in node.get("content", []) or []:
                if child.get("type") == "text":
                    text += child.get("text", "")
                elif child.get("type") == "hardBreak":
                    text += "\n"
                else:
                    text += collect_inline_text(child)
            blocks.append((node_type, text.strip()))
            return blocks
        for child in node.get("content", []) or []:
            collect_text_nodes(child, blocks)
        return blocks

    def collect_inline_text(node):
        if not isinstance(node, dict):
            return ""
        if node.get("type") == "text":
            return node.get("text", "")
        if node.get("type") == "hardBreak":
            return "\n"
        return "".join(collect_inline_text(child) for child in node.get("content", []) or [])

    def draw_text_blocks(slide_content):
        blocks = collect_text_nodes(slide_content)
        cursor_y = CANVAS_HEIGHT - 60
        for node_type, text in blocks:
            if not text:
                cursor_y -= 12
                continue
            style = body_style
            if node_type == "heading":
                style = heading_styles["heading"]
            elif node_type == "blockquote":
                style = ParagraphStyle("BackpackQuote", parent=body_style, leftIndent=18, borderPadding=8, borderWidth=1, borderColor="#d1d5db")
            elif node_type == "codeBlock":
                style = ParagraphStyle("BackpackCode", parent=body_style, fontName="Courier", fontSize=9, leading=12, backColor="#f3f4f6")

            safe = escape(text).replace("\n", "<br/>")
            paragraph = Paragraph(safe, style)
            available_width = (CANVAS_WIDTH - 120) * scale
            _, height = paragraph.wrap(available_width, (CANVAS_HEIGHT - 120) * scale)
            draw_x = offset_x + 60 * scale
            draw_y = offset_y + cursor_y * scale - height
            paragraph.drawOn(pdf, draw_x, draw_y)
            cursor_y -= (height + style.spaceAfter) / scale
            if cursor_y < 40:
                break

    def draw_strokes(strokes):
        if not strokes:
            return

        # Render the complete drawing layer to a transparent bitmap first.
        # This makes eraser strokes erase ink without erasing notebook text.
        image = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (255, 255, 255, 0))
        image_draw = ImageDraw.Draw(image)

        for stroke in strokes:
            points = stroke.get("points") or []
            if len(points) < 2:
                continue
            xy = []
            for point in points:
                x = max(0, min(CANVAS_WIDTH, float(point.get("x", 0))))
                y = max(0, min(CANVAS_HEIGHT, float(point.get("y", 0))))
                xy.append((x, y))

            if stroke.get("isEraser"):
                # Alpha-zero pixels erase only the drawing layer.
                eraser = Image.new("L", (CANVAS_WIDTH, CANVAS_HEIGHT), 0)
                ed = ImageDraw.Draw(eraser)
                ed.line(xy, fill=255, width=20, joint="curve")
                alpha = image.getchannel("A")
                alpha = Image.eval(alpha, lambda value: value)
                import PIL.ImageChops as ImageChops
                alpha = ImageChops.subtract(alpha, eraser)
                image.putalpha(alpha)
            else:
                image_draw.line(xy, fill=(29, 29, 31, 255), width=3, joint="curve")

        if image.getbbox():
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            buffer.seek(0)
            pdf.drawImage(
                ImageReader(buffer),
                offset_x,
                offset_y,
                width=render_width,
                height=render_height,
                mask="auto",
                preserveAspectRatio=True,
            )

    for slide_index, slide in enumerate(slides):
        # Draw text and drawing in their original shared coordinate system.
        # Keep the two editor layers separate: ink is painted first and text remains legible above it.
        draw_strokes(slide.get("drawings") or [])
        draw_text_blocks(slide.get("content", {}))
        pdf.showPage()

    pdf.save()
    background_tasks.add_task(cleanup_after_delay, session_folder)
    return FileResponse(path=pdf_path, media_type="application/pdf", filename=pdf_name)
