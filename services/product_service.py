from datetime import datetime, timedelta, timezone
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.product import DebateSession

_memory_sessions_by_user: dict[str, dict[str, dict[str, Any]]] = {}


def _value(session: DebateSession | dict[str, Any], key: str):
    if isinstance(session, dict):
        return session[key]
    return getattr(session, key)


def infer_topic(message: str) -> str:
    normalized = message.lower()
    topic_patterns = [
        (r"\b(?:healthcare|health care|medical|medicine|public health)\b", "Universal Healthcare"),
        (r"basic income|\bubi\b|income guarantee", "Universal Basic Income"),
        (r"artificial intelligence|ai regulation|high-risk systems", "AI Regulation"),
        (r"climate|carbon|emission", "Climate Policy"),
        (r"education|school|standardized test", "Education Reform"),
    ]
    for pattern, topic in topic_patterns:
        if re.search(pattern, normalized):
            return topic
    return "Argument Analysis"


def estimate_score(message: str, reply: str) -> int:
    text = f"{message} {reply}".lower()
    score = 64 + min(12, len(message) // 45)
    score += 5 if re.search(r"because|therefore|leads to|results in", text) else 0
    score += 5 if re.search(r"study|report|data|evidence|source|research", text) else 0
    score += 3 if re.search(r"however|counter|opposing|tradeoff", text) else 0
    score -= 4 if re.search(r"unsupported|weak assumption|uncertain", text) else 0
    return max(45, min(94, score))


def build_title(topic: str, message: str) -> str:
    if topic != "Argument Analysis":
        return topic if topic.endswith(("Policy", "Reform")) else f"{topic} Debate"
    words = re.findall(r"[A-Za-z0-9'-]+", message)
    short = " ".join(words[:5]).strip()
    return f"{short or 'New Argument'}..."


async def record_debate_session(
    db: AsyncSession | None,
    user_id: str,
    session_id: str,
    message: str,
    reply: str,
) -> DebateSession | dict[str, Any]:
    if db is None:
        user_sessions = _memory_sessions_by_user.setdefault(user_id, {})
        session = user_sessions.get(session_id)
        topic = infer_topic(message)
        score = estimate_score(message, reply)
        now = datetime.now(timezone.utc)

        if session is None:
            session = {
                "id": session_id,
                "user_id": user_id,
                "title": build_title(topic, message),
                "topic": topic,
                "score": score,
                "argument_count": 1,
                "created_at": now,
                "updated_at": now,
            }
            user_sessions[session_id] = session
        else:
            session["topic"] = topic if session["topic"] == "Argument Analysis" else session["topic"]
            session["title"] = build_title(str(session["topic"]), message)
            session["score"] = round((int(session["score"]) * int(session["argument_count"]) + score) / (int(session["argument_count"]) + 1))
            session["argument_count"] = int(session["argument_count"]) + 1
            session["updated_at"] = now
        return session

    result = await db.execute(
        select(DebateSession).where(
            DebateSession.id == session_id,
            DebateSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    topic = infer_topic(message)
    score = estimate_score(message, reply)

    if session is None:
        session = DebateSession(
            id=session_id,
            user_id=user_id,
            title=build_title(topic, message),
            topic=topic,
            score=score,
            argument_count=1,
        )
        db.add(session)
    else:
        session.topic = topic if session.topic == "Argument Analysis" else session.topic
        session.title = build_title(session.topic, message)
        session.score = round((session.score * session.argument_count + score) / (session.argument_count + 1))
        session.argument_count += 1
        session.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(session)
    return session


async def get_user_sessions(db: AsyncSession | None, user_id: str, limit: int = 30) -> list[DebateSession | dict[str, Any]]:
    if db is None:
        sessions = list(_memory_sessions_by_user.get(user_id, {}).values())
        return sorted(
            sessions,
            key=lambda session: _value(session, "updated_at"),
            reverse=True,
        )[:limit]

    result = await db.execute(
        select(DebateSession)
        .where(DebateSession.user_id == user_id)
        .order_by(DebateSession.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


def serialize_session(session: DebateSession | dict[str, Any], previous_score: int | None = None) -> dict[str, object]:
    score = int(_value(session, "score"))
    user_id = str(_value(session, "user_id"))
    trend_value = score - previous_score if previous_score is not None else 0
    updated_at = _value(session, "updated_at")
    storage_prefix = f"{user_id}:"
    public_id = str(_value(session, "id")).removeprefix(storage_prefix)
    return {
        "id": public_id,
        "title": str(_value(session, "title")),
        "topic": str(_value(session, "topic")),
        "score": score,
        "date": updated_at.strftime("%b %d, %Y - %I:%M %p"),
        "trend": f"{trend_value:+d}",
        "argument_count": int(_value(session, "argument_count")),
    }


def _plural(value: int, singular: str, plural: str | None = None) -> str:
    return f"{value} {singular if value == 1 else plural or f'{singular}s'}"


def _bounded_progress(current: int, target: int) -> int:
    if target <= 0:
        return 0
    return min(100, round(current / target * 100))


def _session_activity_date(session: DebateSession | dict[str, Any]):
    updated_at = _value(session, "updated_at")
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    else:
        updated_at = updated_at.astimezone(timezone.utc)
    return updated_at.date()


def _current_streak_days(sessions: list[DebateSession | dict[str, Any]]) -> int:
    if not sessions:
        return 0

    activity_dates = {_session_activity_date(session) for session in sessions}
    cursor = datetime.now(timezone.utc).date()
    if cursor not in activity_dates:
        return 0

    streak = 0
    while cursor in activity_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def build_dashboard(sessions: list[DebateSession | dict[str, Any]]) -> dict[str, object]:
    real_debates = len(sessions)
    real_arguments = sum(int(_value(session, "argument_count")) for session in sessions)
    score_total = sum(int(_value(session, "score")) for session in sessions)
    average = round(score_total / real_debates) if real_debates else 0
    streak = _current_streak_days(sessions)

    chronological = list(reversed(sessions))
    real_scores = [int(_value(session, "score")) for session in chronological]
    progress_series = real_scores[-26:]
    recent = []
    for index, session in enumerate(sessions[:10]):
        previous = int(_value(sessions[index + 1], "score")) if index + 1 < len(sessions) else None
        recent.append(serialize_session(session, previous))

    return {
        "metrics": [
            {
                "label": "Debates completed",
                "value": f"{real_debates:,}",
                "change": "All time" if real_debates else "No sessions yet",
                "tone": "blue",
            },
            {
                "label": "Arguments analyzed",
                "value": f"{real_arguments:,}",
                "change": "All time" if real_arguments else "No arguments yet",
                "tone": "green",
            },
            {
                "label": "Avg. persuasiveness",
                "value": f"{average}%",
                "change": f"Across {_plural(real_debates, 'session')}" if real_debates else "No score yet",
                "tone": "amber",
            },
            {
                "label": "Current streak",
                "value": _plural(streak, "day"),
                "change": "Active today" if streak else "No activity today",
                "tone": "red",
            },
        ],
        "progress_series": progress_series,
        "recent_sessions": recent,
        "achievements": [
            {
                "title": "Reasoning Scholar",
                "description": "Analyze 50 arguments",
                "progress": _bounded_progress(real_arguments, 50),
                "status": "Earned" if real_arguments >= 50 else "In progress",
                "tone": "blue",
            },
            {
                "title": "Debate Builder",
                "description": "Complete 10 debate sessions",
                "progress": _bounded_progress(real_debates, 10),
                "status": "Earned" if real_debates >= 10 else "In progress",
                "tone": "green",
            },
            {
                "title": "Persuasion Peak",
                "description": "Reach a 90% average score",
                "progress": average if real_debates else 0,
                "status": "Earned" if real_debates and average >= 90 else "In progress",
                "tone": "amber",
            },
        ],
    }
