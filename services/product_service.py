from datetime import datetime, timedelta, timezone
import re
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models.product import DebateSession, SharedArgument, TeamMemberInvite
from models.user import User

_memory_sessions_by_user: dict[str, dict[str, dict[str, Any]]] = {}
_memory_team_invites_by_owner: dict[str, dict[str, dict[str, Any]]] = {}
_memory_shared_arguments_by_user: dict[str, dict[str, dict[str, Any]]] = {}


def _value(item: Any, key: str):
    if isinstance(item, dict):
        return item[key]
    return getattr(item, key)


def _optional_value(item: Any, key: str, default: Any = None):
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


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


def _short_excerpt(text: str, limit: int = 180) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def _sentences(text: str, limit: int = 3) -> list[str]:
    parts = [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+", text)
        if part.strip()
    ]
    return parts[:limit]


def _citation_count(text: str) -> int:
    patterns = [
        r"https?://",
        r"\b(?:study|report|research|journal|source|survey|dataset|according to)\b",
        r"\b\d{4}\b",
        r"\b\d+(?:\.\d+)?%",
    ]
    return sum(len(re.findall(pattern, text, flags=re.IGNORECASE)) for pattern in patterns)


def _name_from_email(email: str) -> str:
    return (
        " ".join(
            part.capitalize()
            for part in email.split("@", 1)[0].replace("-", ".").replace("_", ".").split(".")
            if part
        )
        or "Invited Member"
    )


def _initials(name: str) -> str:
    return (
        "".join(part[0] for part in name.split()[:2] if part).upper()
        or "IM"
    )


def _serialize_current_member(user: User | dict[str, Any]) -> dict[str, object]:
    name = str(_value(user, "full_name") or _value(user, "email"))
    return {
        "id": str(_value(user, "id")),
        "email": str(_value(user, "email")),
        "name": name,
        "initials": _initials(name),
        "role": str(_optional_value(user, "role", "Workspace owner") or "Workspace owner"),
        "status": "Active",
        "tone": "green",
        "is_current": True,
    }


def _serialize_invited_member(
    invite: TeamMemberInvite | dict[str, Any],
    matched_user: User | dict[str, Any] | None = None,
) -> dict[str, object]:
    email = str(_value(invite, "email"))
    name = (
        str(_value(matched_user, "full_name"))
        if matched_user is not None
        else str(_optional_value(invite, "name", "") or _name_from_email(email))
    )
    is_active = matched_user is not None
    return {
        "id": str(_value(invite, "id")),
        "email": email,
        "name": name,
        "initials": _initials(name),
        "role": str(_optional_value(invite, "role", "Debater") or "Debater"),
        "status": "Active" if is_active else str(_optional_value(invite, "status", "Invited") or "Invited"),
        "tone": "green" if is_active else "amber",
        "is_current": False,
    }


async def get_team_members(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
) -> list[dict[str, object]]:
    owner_id = str(_value(current_user, "id"))
    current_email = str(_value(current_user, "email"))
    members = [_serialize_current_member(current_user)]

    if db is None:
        invites = list(_memory_team_invites_by_owner.get(owner_id, {}).values())
        if not invites:
            return members

        from services.auth_service import find_user_by_email

        for invite in sorted(invites, key=lambda item: _value(item, "updated_at"), reverse=True):
            email = str(_value(invite, "email"))
            if email == current_email:
                continue
            matched_user = await find_user_by_email(None, email)
            members.append(_serialize_invited_member(invite, matched_user))
        return members

    result = await db.execute(
        select(TeamMemberInvite)
        .where(TeamMemberInvite.workspace_owner_user_id == owner_id)
        .order_by(TeamMemberInvite.updated_at.desc())
    )
    invites = list(result.scalars().all())
    if not invites:
        return members

    emails = [invite.email for invite in invites if invite.email != current_email]
    users_by_email: dict[str, User] = {}
    if emails:
        user_result = await db.execute(select(User).where(User.email.in_(emails)))
        users_by_email = {user.email: user for user in user_result.scalars().all()}

    for invite in invites:
        if invite.email == current_email:
            continue
        members.append(_serialize_invited_member(invite, users_by_email.get(invite.email)))

    return members


async def save_team_invite(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    email: str,
    role: str,
) -> list[dict[str, object]]:
    owner_id = str(_value(current_user, "id"))
    now = datetime.now(timezone.utc)

    if db is None:
        owner_invites = _memory_team_invites_by_owner.setdefault(owner_id, {})
        invite = owner_invites.get(email)
        if invite is None:
            invite = {
                "id": str(uuid.uuid4()),
                "workspace_owner_user_id": owner_id,
                "email": email,
                "name": _name_from_email(email),
                "role": role,
                "status": "Invited",
                "created_at": now,
                "updated_at": now,
            }
            owner_invites[email] = invite
        else:
            invite["role"] = role
            invite["name"] = _name_from_email(email)
            invite["status"] = "Invited"
            invite["updated_at"] = now
        return await get_team_members(db, current_user)

    result = await db.execute(
        select(TeamMemberInvite).where(
            TeamMemberInvite.workspace_owner_user_id == owner_id,
            TeamMemberInvite.email == email,
        )
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        invite = TeamMemberInvite(
            id=str(uuid.uuid4()),
            workspace_owner_user_id=owner_id,
            email=email,
            name=_name_from_email(email),
            role=role,
            status="Invited",
        )
        db.add(invite)
    else:
        invite.name = _name_from_email(email)
        invite.role = role
        invite.status = "Invited"
        invite.updated_at = now

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(TeamMemberInvite).where(
                TeamMemberInvite.workspace_owner_user_id == owner_id,
                TeamMemberInvite.email == email,
            )
        )
        invite = result.scalar_one()
        invite.name = _name_from_email(email)
        invite.role = role
        invite.status = "Invited"
        invite.updated_at = now
        await db.commit()

    return await get_team_members(db, current_user)


def _serialize_shared_argument(argument: SharedArgument | dict[str, Any]) -> dict[str, object]:
    updated_at = _value(argument, "updated_at")
    if isinstance(updated_at, datetime):
        updated = updated_at.strftime("%b %d, %Y - %I:%M %p")
    else:
        updated = str(updated_at)
    body = str(_value(argument, "body"))
    return {
        "id": str(_value(argument, "id")),
        "title": str(_value(argument, "title")),
        "body": body,
        "owner": str(_value(argument, "owner")),
        "citations": _citation_count(body),
        "status": str(_optional_value(argument, "status", "Draft") or "Draft"),
        "updated_at": updated,
    }


async def get_shared_arguments(
    db: AsyncSession | None,
    user_id: str,
) -> list[dict[str, object]]:
    if db is None:
        arguments = list(_memory_shared_arguments_by_user.get(user_id, {}).values())
        return [
            _serialize_shared_argument(argument)
            for argument in sorted(
                arguments,
                key=lambda item: _value(item, "updated_at"),
                reverse=True,
            )
        ]

    result = await db.execute(
        select(SharedArgument)
        .where(SharedArgument.user_id == user_id)
        .order_by(SharedArgument.updated_at.desc())
    )
    return [_serialize_shared_argument(argument) for argument in result.scalars().all()]


async def save_shared_argument(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    title: str,
    body: str,
    argument_id: str | None = None,
) -> list[dict[str, object]]:
    user_id = str(_value(current_user, "id"))
    owner = str(_value(current_user, "full_name") or _value(current_user, "email"))
    now = datetime.now(timezone.utc)
    safe_id = argument_id or str(uuid.uuid4())

    if db is None:
        user_arguments = _memory_shared_arguments_by_user.setdefault(user_id, {})
        argument = user_arguments.get(safe_id)
        if argument is None:
            argument = {
                "id": safe_id,
                "user_id": user_id,
                "title": title,
                "body": body,
                "owner": owner,
                "status": "Draft",
                "created_at": now,
                "updated_at": now,
            }
            user_arguments[safe_id] = argument
        else:
            argument["title"] = title
            argument["body"] = body
            argument["owner"] = owner
            argument["status"] = "Draft"
            argument["updated_at"] = now
        return await get_shared_arguments(db, user_id)

    argument = await db.get(SharedArgument, safe_id)
    if argument is not None and argument.user_id != user_id:
        argument = None
    if argument is None:
        argument = SharedArgument(
            id=safe_id,
            user_id=user_id,
            title=title,
            body=body,
            owner=owner,
            status="Draft",
        )
        db.add(argument)
    else:
        argument.title = title
        argument.body = body
        argument.owner = owner
        argument.status = "Draft"
        argument.updated_at = now

    await db.commit()
    return await get_shared_arguments(db, user_id)


async def build_session_report(
    db: AsyncSession | None,
    user_id: str,
    public_session_id: str,
) -> dict[str, object]:
    storage_session_id = f"{user_id}:{public_session_id}"
    session: DebateSession | dict[str, Any] | None = None
    if db is None:
        session = _memory_sessions_by_user.get(user_id, {}).get(storage_session_id)
    else:
        result = await db.execute(
            select(DebateSession).where(
                DebateSession.id == storage_session_id,
                DebateSession.user_id == user_id,
            )
        )
        session = result.scalar_one_or_none()

    if session is None:
        raise ValueError("Session was not found.")

    from services.chat import get_history

    history = await get_history(db, storage_session_id, limit=40)
    user_messages = [item["content"] for item in history if item["role"] == "user"]
    assistant_messages = [item["content"] for item in history if item["role"] == "assistant"]
    latest_argument = user_messages[-1] if user_messages else ""
    latest_reply = assistant_messages[-1] if assistant_messages else ""
    topic = str(_value(session, "topic"))
    score = int(_value(session, "score"))
    argument_count = int(_value(session, "argument_count"))

    key_arguments = _sentences(latest_argument, limit=3) or [
        f"{_plural(argument_count, 'saved argument entry')} exists for this session."
    ]
    evidence_terms = re.findall(
        r"\b(?:study|report|research|source|data|survey|journal|according to|https?://\S+|\d{4}|\d+(?:\.\d+)?%)\b",
        latest_argument,
        flags=re.IGNORECASE,
    )
    evidence = (
        [f"Evidence signal found in your saved argument: {_short_excerpt(term, 80)}" for term in evidence_terms[:4]]
        if evidence_terms
        else ["No named source, statistic, or citation was present in the latest saved argument."]
    )
    reply_sentences = _sentences(latest_reply, limit=4)
    risks = [
        sentence for sentence in reply_sentences
        if re.search(r"\b(?:risk|weak|gap|assumption|fallac|unsupported|missing)\b", sentence, re.IGNORECASE)
    ][:3]
    if not risks and latest_reply:
        risks = [f"DebateHelp response note: {_short_excerpt(latest_reply)}"]
    if not risks:
        risks = ["No assistant risk review is saved for this session yet."]

    counters = [
        sentence for sentence in reply_sentences
        if re.search(r"\b(?:counter|opponent|rebut|however|against)\b", sentence, re.IGNORECASE)
    ][:3]
    if not counters and latest_reply:
        counters = [f"Use the saved assistant response to prepare rebuttals: {_short_excerpt(latest_reply)}"]
    if not counters:
        counters = ["No saved counterargument guidance is available yet."]

    recommendation = (
        f"Use the latest saved DebateHelp response to revise this {topic} session. "
        f"Current real score is {score}%, across {argument_count} saved argument "
        f"{'entry' if argument_count == 1 else 'entries'}."
    )
    if latest_reply:
        recommendation += f" Most recent coaching: {_short_excerpt(latest_reply, 220)}"

    return {
        "topic": topic,
        "score": score,
        "recommendation": recommendation,
        "keyArguments": key_arguments,
        "evidence": evidence,
        "fallacies": risks,
        "counterarguments": counters,
        "sourceSessionId": public_session_id,
    }


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
