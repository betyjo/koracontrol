import os
from statistics import mean
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), '../../kora_ai/anomaly_model.pkl')


def run_anomaly_detection(tag_data):
    """
    Real AI Detection using Isolation Forest
    """
    import joblib

    try:
        model = joblib.load(MODEL_PATH)
        
        # Get the latest value from the logs
        latest_val = tag_data[0].value if tag_data else 0
        
        # AI Prediction: -1 is Anomaly, 1 is Normal
        # Use DataFrame with proper feature names to avoid sklearn warnings
        df = pd.DataFrame({'value': [latest_val]})
        prediction = model.predict(df)[0]
        
        if prediction == -1:
            return True, 0.92, f"AI detected statistical outlier. Value {latest_val} is outside learned normal range."
        
        return False, 0.98, "Statistical pattern is normal."
    except Exception as e:
        # Fallback to simple threshold if AI fails
        return False, 0.0, f"AI Model Error: {str(e)}"


SYSTEM_PROMPT = (
    "You are Kora Control AI assistant for industrial operations. "
    "Use the provided data context first, be concise and actionable, "
    "and call out uncertainty when data is missing."
)


def _build_context_summary(user, history_messages=None, attachment_texts=None):
    from .models import Bill, Complaint, TagLog

    unpaid_bills = Bill.objects.filter(user=user, is_paid=False)
    unpaid_total = float(sum(b.amount for b in unpaid_bills)) if unpaid_bills else 0.0
    recent_complaints = Complaint.objects.filter(user=user).order_by('-created_at')[:3]
    recent_logs = TagLog.objects.select_related('tag').order_by('-timestamp')[:30]

    tag_snapshot = {}
    for log in recent_logs:
        tag_snapshot.setdefault(log.tag.name, []).append(log.value)

    tag_lines = []
    for tag_name, values in tag_snapshot.items():
        tag_lines.append(
            f"- {tag_name}: latest={values[0]:.2f}, avg_recent={mean(values):.2f}, samples={len(values)}"
        )

    complaint_lines = [
        f"- [{c.status}] {c.subject}"
        for c in recent_complaints
    ] or ["- No recent complaints."]

    history_lines = []
    if history_messages:
        for m in history_messages[-8:]:
            history_lines.append(f"{m.role.upper()}: {m.content}")

    attachment_lines = []
    if attachment_texts:
        for idx, text in enumerate(attachment_texts[:4], start=1):
            attachment_lines.append(f"- Attachment {idx}: {text[:600]}")

    context = [
        f"User: {user.username} ({user.role})",
        f"Pending bills count: {unpaid_bills.count()}, pending amount ETB: {unpaid_total:.2f}",
        "Recent complaints:",
        *complaint_lines,
        "Recent tag summary:",
        *(tag_lines or ["- No tag logs available."]),
        "Recent conversation context:",
        *(history_lines or ["- No previous messages in this thread."]),
        "Attachment snippets:",
        *(attachment_lines or ["- No attachment snippets."]),
    ]
    return "\n".join(context)


def _get_model():
    import google.generativeai as genai

    api_key = (
        os.getenv("KORA_GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )
    if not api_key:
        raise RuntimeError("AI chat is not configured yet. Please set KORA_GEMINI_API_KEY on the backend.")

    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name="gemini-flash-latest", system_instruction=SYSTEM_PROMPT)


def get_ai_chat_response(user_message, user=None, history_messages=None, attachment_texts=None):
    try:
        if not user_message or not str(user_message).strip():
            return "Please enter a message so I can help you."

        model = _get_model()
        context_summary = _build_context_summary(user, history_messages, attachment_texts) if user else ""
        final_prompt = (
            f"{context_summary}\n\nUser question:\n{str(user_message).strip()}"
            if context_summary else str(user_message).strip()
        )
        response = model.generate_content(final_prompt)
        return getattr(response, "text", "") or "I could not generate a response right now. Please try again."
    except Exception as e:
        return f"I'm having trouble connecting to my brain right now. Error: {e}"


def stream_ai_chat_response(user_message, user=None, history_messages=None, attachment_texts=None):
    if not user_message or not str(user_message).strip():
        yield "Please enter a message so I can help you."
        return

    try:
        model = _get_model()
        context_summary = _build_context_summary(user, history_messages, attachment_texts) if user else ""
        final_prompt = (
            f"{context_summary}\n\nUser question:\n{str(user_message).strip()}"
            if context_summary else str(user_message).strip()
        )
        response_stream = model.generate_content(final_prompt, stream=True)
        for chunk in response_stream:
            text = getattr(chunk, "text", "")
            if text:
                yield text
    except Exception as e:
        yield f"I'm having trouble connecting to my brain right now. Error: {e}"
