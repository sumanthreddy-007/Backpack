from database import (
    create_note,
    get_all_notes,
    get_note,
    update_note,
    delete_note,
    search_notes,
    get_folders,
    create_folder,
    rename_folder,
    delete_folder,
    move_note
)


# ==========================================================
# NOTES
# ==========================================================

def create_new_note(title, content, folder):
    return create_note(title, content, folder)


def fetch_all_notes():
    return get_all_notes()


def fetch_note(note_id):
    return get_note(note_id)


def edit_note(note_id, title, content, folder):
    update_note(note_id, title, content, folder)


def remove_note(note_id):
    delete_note(note_id)


def find_notes(keyword):
    return search_notes(keyword)


def move_note_to_folder(note_id, folder):
    move_note(note_id, folder)


# ==========================================================
# FOLDERS
# ==========================================================

def fetch_folders():
    return get_folders()


def add_folder(name):
    create_folder(name)


def edit_folder(folder_id, new_name):
    rename_folder(folder_id, new_name)


def remove_folder(folder_id):
    delete_folder(folder_id)