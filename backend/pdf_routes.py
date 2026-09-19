from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks

from pdf_service import (
    word_to_pdf,
    merge_pdfs,
    split_pdf,
    rotate_pdf,
    delete_pages
)

router = APIRouter(
    prefix="/pdf",
    tags=["PDF"]
)


@router.get("/")
def pdf_home():
    return {"message": "PDF Module Running"}


@router.post("/word-to-pdf")
async def convert_word_to_pdf(
    file: UploadFile = File(...)
):
    return await word_to_pdf(file)


@router.post("/merge")
async def merge_pdf_files(
    files: list[UploadFile] = File(...)
):
    return await merge_pdfs(files)


@router.post("/split")
async def split_pdf_file(
    file: UploadFile = File(...),
    page_number: int = Form(...)
):
    return await split_pdf(
        file,
        page_number
    )


@router.post("/rotate")
async def rotate_pdf_file(
    file: UploadFile = File(...),
    angle: int = Form(...)
):
    return await rotate_pdf(
        file,
        angle
    )


@router.post("/delete-pages")
async def delete_pdf_pages(
    file: UploadFile = File(...),
    pages: str = Form(...)
):
    return await delete_pages(
        file,
        pages
    )
@router.post("/note-to-pdf")
async def convert_note_to_pdf(payload: dict, background_tasks: BackgroundTasks):
    from pdf_service import note_to_pdf
    return await note_to_pdf(payload, background_tasks)
