import sys
sys.path.insert(0, "backend")

from app.database import engine, SessionLocal
from app.models import User, Exam, Student, ExamStudent, Room, Seat, ExamAssignment, Document, AuditLog
from sqlalchemy import text

def test_connection():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            print("[OK] Connected to PostgreSQL:")
            print(f"     {result.scalar()}")
        return True
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        return False

def test_models():
    try:
        db = SessionLocal()
        
        # Test each model can be queried
        models = [
            ("users", User),
            ("exams", Exam),
            ("students", Student),
            ("exam_students", ExamStudent),
            ("rooms", Room),
            ("seats", Seat),
            ("exam_assignments", ExamAssignment),
            ("documents", Document),
            ("audit_logs", AuditLog),
        ]
        
        print("\n[OK] ORM models loaded successfully:")
        for name, model in models:
            count = db.query(model).count()
            print(f"     - {name}: {count} rows")
        
        db.close()
        return True
    except Exception as e:
        print(f"[ERROR] Model query failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing ORM setup...\n")
    
    if test_connection() and test_models():
        print("\n[OK] ORM is ready!")
    else:
        print("\n[ERROR] ORM setup failed")
        sys.exit(1)
