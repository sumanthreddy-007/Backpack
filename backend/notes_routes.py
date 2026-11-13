from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import (
    create_note, get_all_notes, get_note, update_note, delete_note,
    search_notes, get_folders, create_folder, rename_folder,
    delete_folder, move_note,
)

router = APIRouter(prefix="/api", tags=["Notes"])

class NoteCreate(BaseModel):
    title: str = Field(default="Untitled Note", min_length=1, max_length=200)
    content: dict = Field(default_factory=dict)
    folder: str = Field(default="General", min_length=1, max_length=100)

class NoteUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: dict = Field(default_factory=dict)
    folder: str = Field(min_length=1, max_length=100)

class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class FolderRename(BaseModel):
    new_name: str = Field(min_length=1, max_length=100)

class MoveNote(BaseModel):
    folder: str = Field(min_length=1, max_length=100)


def clean_name(value: str) -> str:
    return " ".join(value.strip().split())

@router.post("/notes")
def api_create_note(note: NoteCreate):
    try:
        title = clean_name(note.title) or "Untitled Note"
        folder = clean_name(note.folder) or "General"
        note_id = create_note(title=title, content=note.content, folder=folder)
        return {"message": "Note created successfully", "id": note_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes")
def api_get_notes():
    try:
        return get_all_notes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{note_id}")
def api_get_single_note(note_id: int):
    try:
        note = get_note(note_id)
        if note is None:
            raise HTTPException(status_code=404, detail="Note not found")
        return note
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/notes/{note_id}")
def api_update_note(note_id: int, note: NoteUpdate):
    try:
        if get_note(note_id) is None:
            raise HTTPException(status_code=404, detail="Note not found")
        update_note(
            note_id=note_id,
            title=clean_name(note.title) or "Untitled Note",
            content=note.content,
            folder=clean_name(note.folder) or "General",
        )
        return {"message": "Note updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/notes/{note_id}")
def api_remove_note(note_id: int):
    try:
        if get_note(note_id) is None:
            raise HTTPException(status_code=404, detail="Note not found")
        delete_note(note_id)
        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/search")
def api_search_notes(keyword: str):
    try:
        return search_notes(keyword.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/notes/{note_id}/move")
def api_move_note(note_id: int, move: MoveNote):
    try:
        move_note(note_id, clean_name(move.folder) or "General")
        return {"message": "Note moved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/folders")
def api_get_folders():
    try:
        return get_folders()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/folders")
def api_add_folder(folder: FolderCreate):
    try:
        name = clean_name(folder.name)
        if not name:
            raise HTTPException(status_code=400, detail="Folder name cannot be empty")
        folder_id = create_folder(name)
        return {"message": "Folder created successfully", "id": folder_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/folders/{folder_id}")
def api_rename_folder(folder_id: int, folder: FolderRename):
    try:
        name = clean_name(folder.new_name)
        if not name:
            raise HTTPException(status_code=400, detail="Folder name cannot be empty")
        existing = next((item for item in get_folders() if item["id"] == folder_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail="Folder not found")
        if existing["name"] == "General":
            raise HTTPException(status_code=400, detail="The General folder cannot be renamed")
        if name.lower() == "general":
            raise HTTPException(status_code=400, detail="That name is reserved for the General folder")
        rename_folder(folder_id, name)
        return {"message": "Folder renamed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/folders/{folder_id}")
def api_remove_folder(folder_id: int):
    try:
        existing = next((item for item in get_folders() if item["id"] == folder_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail="Folder not found")
        if existing["name"] == "General":
            raise HTTPException(status_code=400, detail="The General folder cannot be deleted")
        delete_folder(folder_id)
        return {"message": "Folder deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
