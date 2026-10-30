import pytest

from app.database import SessionLocal, engine


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
