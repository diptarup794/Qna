from backend.models import Document


def build_combined_context(documents: list[Document], max_chars: int) -> str:
    """Concatenate document texts with headers until max_chars is reached."""
    parts: list[str] = []
    budget = max_chars
    for d in documents:
        header = f"\n\n=== Document: {d.filename} (id {d.id}) ===\n\n"
        need = len(header)
        if budget <= need + 80:
            parts.append(header + "[… truncated: shared context budget exhausted …]")
            break
        avail = budget - need
        body = d.extracted_text[:avail]
        parts.append(header + body)
        if len(d.extracted_text) > avail:
            parts.append("\n[… remainder of this document omitted …]")
        budget -= need + len(body)
        if budget <= 0:
            break
    return "".join(parts).strip()
