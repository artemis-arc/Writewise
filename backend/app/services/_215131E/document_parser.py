from io import BytesIO

from docx import Document
from fastapi import UploadFile
from pypdf import PdfReader

SUPPORTED_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


class UnsupportedFileTypeError(ValueError):
    pass


def _kind_from_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx"):
        return "docx"
    return None


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx_text(data: bytes) -> str:
    document = Document(BytesIO(data))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


async def extract_text(file: UploadFile) -> str:
    """Extracts plain text from an uploaded .pdf or .docx manuscript for SRSD scoring."""
    kind = SUPPORTED_CONTENT_TYPES.get(file.content_type or "") or _kind_from_filename(
        file.filename
    )
    if kind is None:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{file.content_type}'. Only PDF and DOCX are supported."
        )

    data = await file.read()

    if kind == "pdf":
        return _extract_pdf_text(data)
    return _extract_docx_text(data)
