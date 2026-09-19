import os
import uuid
import shutil
import threading
import time


def create_sandbox():

    BASE_DIR = os.path.dirname(
        os.path.abspath(__file__)
    )

    sandbox_root = os.path.join(
        BASE_DIR,
        "sandbox"
    )

    os.makedirs(
        sandbox_root,
        exist_ok=True
    )

    session_id = str(
        uuid.uuid4()
    )

    session_folder = os.path.join(
        sandbox_root,
        session_id
    )

    os.makedirs(
        session_folder,
        exist_ok=True
    )

    return session_folder


def cleanup_sandbox(
    session_folder
):

    if os.path.exists(
        session_folder
    ):
        shutil.rmtree(
            session_folder,
            ignore_errors=True
        )


def cleanup_after_delay(
    session_folder,
    delay=60
):

    def delete():

        time.sleep(delay)

        cleanup_sandbox(
            session_folder
        )

    threading.Thread(
        target=delete,
        daemon=True
    ).start()