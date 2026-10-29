import re
import unicodedata
from datetime import UTC, datetime
from urllib.parse import quote


def utcnow() -> datetime:
    return datetime.now(UTC)


def attachment_headers(filename: str) -> dict[str, str]:
    """Content-Disposition for a download; ASCII fallback plus the UTF-8 name (RFC 6266)."""
    ascii_name = re.sub(r"[^\w\-. ]", "", unicodedata.normalize("NFKD", filename).encode("ascii", "ignore").decode())
    ascii_name = re.sub(r"\s+", " ", ascii_name.replace("..", "")).strip()[:200] or "download"
    return {"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename[:200])}"}
