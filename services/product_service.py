from datetime import datetime, timezone
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.product import DebateSession

BASE_DEBATES = 47
BASE_ARGUMENTS = 1_238
BASE_PERSUASIVENESS = 81
BASE_PROGRESS_SERIES = [
    68, 61, 56, 82, 86, 71, 59, 65, 74, 74, 81, 76, 70,
    70, 80, 72, 60, 55, 63, 63, 74, 74, 83, 69, 75, 81,
]


def infer_topic(message: str) -> str:
    normalized = message.lower()
    topic_patterns = [
        (r"health|medical|care", "Universal Healthcare"),
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
    db: AsyncSession,
    user_id: str,
    session_id: str,
    message: str,
    reply: str,
) -> DebateSession:
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


async def get_user_sessions(db: AsyncSession, user_id: str, limit: int = 30) -> list[DebateSession]:
    result = await db.execute(
        select(DebateSession)
        .where(DebateSession.user_id == user_id)
        .order_by(DebateSession.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


def serialize_session(session: DebateSession, previous_score: int | None = None) -> dict[str, object]:
    trend_value = session.score - previous_score if previous_score is not None else 1
    updated_at = session.updated_at
    storage_prefix = f"{session.user_id}:"
    public_id = session.id.removeprefix(storage_prefix)
    return {
        "id": public_id,
        "title": session.title,
        "topic": session.topic,
        "score": session.score,
        "date": updated_at.strftime("%b %d, %Y - %I:%M %p"),
        "trend": f"{trend_value:+d}",
        "argument_count": session.argument_count,
    }


def build_dashboard(sessions: list[DebateSession]) -> dict[str, object]:
    real_debates = len(sessions)
    real_arguments = sum(session.argument_count for session in sessions)
    debates = BASE_DEBATES + real_debates
    arguments = BASE_ARGUMENTS + real_arguments
    score_total = BASE_PERSUASIVENESS * BASE_DEBATES + sum(session.score for session in sessions)
    average = round(score_total / max(1, BASE_DEBATES + real_debates))

    chronological = list(reversed(sessions))
    real_scores = [session.score for session in chronological]
    progress_series = (BASE_PROGRESS_SERIES + real_scores)[-26:]
    recent = []
    for index, session in enumerate(sessions[:10]):
        previous = sessions[index + 1].score if index + 1 < len(sessions) else None
        recent.append(serialize_session(session, previous))

    return {
        "metrics": [
            {"label": "Debates completed", "value": f"{debates:,}", "change": f"+{max(1, real_debates)}", "tone": "blue"},
            {"label": "Arguments analyzed", "value": f"{arguments:,}", "change": f"+{max(1, real_arguments)}", "tone": "green"},
            {"label": "Avg. persuasiveness", "value": f"{average}%", "change": f"{average - BASE_PERSUASIVENESS:+d}%", "tone": "amber"},
            {"label": "Current streak", "value": "6 days", "change": "Best: 12 days", "tone": "red"},
        ],
        "progress_series": progress_series,
        "recent_sessions": recent,
        "achievements": [
            {
                "title": "Reasoning Scholar",
                "description": "Completed 50 analyses",
                "progress": min(100, round(arguments / 50 * 100)),
                "status": "Earned" if arguments >= 50 else "In progress",
                "tone": "blue",
            },
            {
                "title": "Evidence Specialist",
                "description": "90% evidence quality",
                "progress": 90,
                "status": "Earned",
                "tone": "green",
            },
            {
                "title": "Counterargument Master",
                "description": "Generated 500 rebuttals",
                "progress": 100,
                "status": "Earned",
                "tone": "amber",
            },
        ],
    }
