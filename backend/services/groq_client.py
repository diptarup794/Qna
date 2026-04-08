from groq import Groq

from backend.config import Settings


def answer_from_context(settings: Settings, context: str, question: str, *, multi_document: bool = False) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    client = Groq(api_key=settings.groq_api_key)
    scope = "the provided documents" if multi_document else "the provided document"
    cite = (
        " When multiple documents are provided, mention which document (by filename or id) supports key facts when helpful."
        if multi_document
        else ""
    )
    prompt = (
        f"You are a precise assistant. Answer only using {scope}. "
        f"If the answer is not in the context, say you cannot find it in the document(s).{cite}\n\n"
        f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
    )
    chat = client.chat.completions.create(
        model=settings.groq_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
    )
    content = chat.choices[0].message.content
    return (content or "").strip()
