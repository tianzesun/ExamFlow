import os
import shutil

import pytest
from sqlalchemy import text

from app.database import SessionLocal, engine

# Services write exam files relative to the working directory.
EXAM_STORAGE = os.path.join("storage", "exams")


@pytest.fixture(scope="session", autouse=True)
def one_test_run_at_a_time():
    """Two runs at once delete each other's paper files (see remove_stored_files), so refuse a second."""
    import fcntl

    os.makedirs("storage", exist_ok=True)
    with open(os.path.join("storage", ".test-run.lock"), "w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            pytest.exit("Another test run is in progress; wait for it to finish.", returncode=2)
        yield


@pytest.fixture(autouse=True)
def rollback_database():
    """Run each test inside one outer transaction that is rolled back afterwards.

    The tests talk to the same database as the running app, so without this
    every run leaves test courses, exams and students behind. Sessions join the
    outer transaction through savepoints, so the app's own commits still work.
    """
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal.configure(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield
    finally:
        SessionLocal.configure(bind=engine, join_transaction_mode="conservative_savepoint")
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def remove_stored_files():
    """Delete exam folders a test wrote; the rollback above can't undo files on disk."""
    before = set(os.listdir(EXAM_STORAGE)) if os.path.isdir(EXAM_STORAGE) else set()
    yield
    if not os.path.isdir(EXAM_STORAGE):
        return
    new = set(os.listdir(EXAM_STORAGE)) - before
    if not new:
        return
    # Keep folders of exams that really exist, e.g. created in the running app meanwhile.
    with engine.connect() as conn:
        kept = {str(row[0]) for row in conn.execute(text("SELECT id::text FROM exams WHERE id::text = ANY(:ids)"),
                                                   {"ids": list(new)})}
    for name in new - kept:
        shutil.rmtree(os.path.join(EXAM_STORAGE, name), ignore_errors=True)
