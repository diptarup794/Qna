import io

import pdfplumber


def extract_text_from_pdf_bytes(data: bytes, max_chars: int) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    full = "\n\n".join(text_parts).strip()
    if len(full) > max_chars:
        full = full[:max_chars] + "\n\n[Truncated: document exceeded maximum extracted length.]"
    return full
