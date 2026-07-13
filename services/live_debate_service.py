from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.product import LiveDebateRoom, LiveDebateStatement
from models.user import User
from services.argument_analysis import analyze_argument
from services.chat_service import process_debate_message
from services.product_service import record_debate_session

ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_ROOM_CODE_ATTEMPTS = 16

_memory_live_rooms: dict[str, dict[str, Any]] = {}
_memory_live_statements: dict[str, list[dict[str, Any]]] = {}


def _value(item: Any, key: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _display_name(user: User | dict[str, Any]) -> str:
    return str(_value(user, "full_name") or _value(user, "email") or "Debater")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _room_code() -> str:
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(6))


def _participant_role(room: LiveDebateRoom | dict[str, Any], user_id: str) -> str:
    if str(_value(room, "host_user_id")) == user_id:
        return "host"
    if str(_value(room, "opponent_user_id", "")) == user_id:
        return "opponent"
    return "viewer"


def _speaker_name(room: LiveDebateRoom | dict[str, Any], role: str) -> str:
    if role == "host":
        return str(_value(room, "host_name") or "Host")
    if role == "opponent":
        return str(_value(room, "opponent_name") or "Opponent")
    return "Viewer"


def _statement_value(statement: LiveDebateStatement | dict[str, Any], key: str, default: Any = None) -> Any:
    if isinstance(statement, dict):
        return statement.get(key, default)
    return getattr(statement, key, default)


def _serialize_statement(statement: LiveDebateStatement | dict[str, Any]) -> dict[str, Any]:
    analysis = _statement_value(statement, "analysis", {}) or {}
    return {
        "id": str(_statement_value(statement, "id")),
        "speakerKey": str(_statement_value(statement, "speaker_key")),
        "speakerName": str(_statement_value(statement, "speaker_name")),
        "text": str(_statement_value(statement, "body")),
        "reply": str(_statement_value(statement, "reply", "") or ""),
        "analysis": analysis if isinstance(analysis, dict) else {},
        "score": int(_statement_value(statement, "score", 0) or 0),
        "status": "Analyzed",
        "createdAt": str(_iso(_statement_value(statement, "created_at")) or ""),
    }


def _compute_scores(statements: list[dict[str, Any]]) -> dict[str, int]:
    totals: dict[str, list[int]] = {"host": [], "opponent": []}
    for statement in statements:
        key = str(statement.get("speakerKey") or "")
        if key in totals and isinstance(statement.get("score"), int):
            totals[key].append(int(statement["score"]))
    return {
        key: round(sum(values) / len(values)) if values else 0
        for key, values in totals.items()
    }


def _latest_counterargument(statement: dict[str, Any] | None) -> str:
    if not statement:
        return ""
    analysis = statement.get("analysis") if isinstance(statement.get("analysis"), dict) else {}
    if analysis.get("counterargument"):
        return str(analysis["counterargument"])
    counters = analysis.get("counterarguments")
    if isinstance(counters, list) and counters:
        return "\n\n".join(str(item) for item in counters if item)
    return ""


def serialize_live_room(
    room: LiveDebateRoom | dict[str, Any],
    statements: list[LiveDebateStatement | dict[str, Any]],
    current_user: User | dict[str, Any],
) -> dict[str, Any]:
    user_id = str(_value(current_user, "id"))
    role = _participant_role(room, user_id)
    serialized_statements = [_serialize_statement(statement) for statement in statements]
    latest = serialized_statements[-1] if serialized_statements else None
    status = str(_value(room, "status", "waiting"))
    started_at = _value(room, "started_at")
    elapsed = 0
    if status == "running" and isinstance(started_at, datetime):
        started = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
        elapsed = max(0, round((_now() - started.astimezone(timezone.utc)).total_seconds()))

    opponent_name = _value(room, "opponent_name")
    participant_count = 1 + (1 if opponent_name else 0)
    return {
        "roomCode": str(_value(room, "code")),
        "topic": str(_value(room, "topic", "Live Debate") or "Live Debate"),
        "status": status,
        "userRole": role,
        "hostName": str(_value(room, "host_name") or "Host"),
        "opponentName": str(opponent_name) if opponent_name else None,
        "participantCount": participant_count,
        "canStart": role == "host" and bool(opponent_name) and status in {"waiting", "ready", "paused"},
        "canSubmit": role in {"host", "opponent"} and status == "running",
        "startedAt": _iso(started_at) if isinstance(started_at, datetime) else None,
        "elapsedSeconds": elapsed,
        "statements": serialized_statements,
        "scores": _compute_scores(serialized_statements),
        "latestReply": str(latest.get("reply") if latest else "") if latest else "",
        "latestCounterargument": _latest_counterargument(latest),
        "latestAnalysis": latest.get("analysis") if latest else None,
    }


async def create_live_room(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    topic: str | None = None,
) -> dict[str, Any]:
    user_id = str(_value(current_user, "id"))
    now = _now()

    if db is None:
        code = _room_code()
        while code in _memory_live_rooms:
            code = _room_code()
        room = {
            "code": code,
            "host_user_id": user_id,
            "host_name": _display_name(current_user),
            "opponent_user_id": None,
            "opponent_name": None,
            "topic": topic or "Live Debate",
            "status": "waiting",
            "started_at": None,
            "created_at": now,
            "updated_at": now,
        }
        _memory_live_rooms[code] = room
        _memory_live_statements[code] = []
        return serialize_live_room(room, [], current_user)

    for _ in range(MAX_ROOM_CODE_ATTEMPTS):
        code = _room_code()
        existing = await db.get(LiveDebateRoom, code)
        if existing is None:
            room = LiveDebateRoom(
                code=code,
                host_user_id=user_id,
                host_name=_display_name(current_user),
                topic=topic or "Live Debate",
                status="waiting",
            )
            db.add(room)
            await db.commit()
            await db.refresh(room)
            return serialize_live_room(room, [], current_user)

    raise ValueError("Could not create a unique debate room. Try again.")


async def get_live_room(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    room_code: str,
) -> dict[str, Any] | None:
    code = room_code.upper()
    user_id = str(_value(current_user, "id"))

    if db is None:
        room = _memory_live_rooms.get(code)
        if room is None or _participant_role(room, user_id) == "viewer":
            return None
        return serialize_live_room(room, _memory_live_statements.get(code, []), current_user)

    room = await db.get(LiveDebateRoom, code)
    if room is None or _participant_role(room, user_id) == "viewer":
        return None
    result = await db.execute(
        select(LiveDebateStatement)
        .where(LiveDebateStatement.room_code == code)
        .order_by(LiveDebateStatement.created_at.asc())
    )
    return serialize_live_room(room, list(result.scalars().all()), current_user)


async def join_live_room(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    room_code: str,
) -> dict[str, Any]:
    code = room_code.upper()
    user_id = str(_value(current_user, "id"))

    if db is None:
        room = _memory_live_rooms.get(code)
        if room is None:
            raise ValueError("Live debate room was not found.")
        role = _participant_role(room, user_id)
        if role == "viewer":
            if room.get("opponent_user_id"):
                raise PermissionError("This debate room already has two debaters.")
            room["opponent_user_id"] = user_id
            room["opponent_name"] = _display_name(current_user)
            room["status"] = "ready" if room.get("status") == "waiting" else room.get("status")
            room["updated_at"] = _now()
        return serialize_live_room(room, _memory_live_statements.get(code, []), current_user)

    room = await db.get(LiveDebateRoom, code)
    if room is None:
        raise ValueError("Live debate room was not found.")
    role = _participant_role(room, user_id)
    if role == "viewer":
        if room.opponent_user_id:
            raise PermissionError("This debate room already has two debaters.")
        room.opponent_user_id = user_id
        room.opponent_name = _display_name(current_user)
        if room.status == "waiting":
            room.status = "ready"
        room.updated_at = _now()
        await db.commit()
        await db.refresh(room)

    result = await db.execute(
        select(LiveDebateStatement)
        .where(LiveDebateStatement.room_code == code)
        .order_by(LiveDebateStatement.created_at.asc())
    )
    return serialize_live_room(room, list(result.scalars().all()), current_user)


async def start_live_room(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    room_code: str,
) -> dict[str, Any]:
    code = room_code.upper()
    user_id = str(_value(current_user, "id"))
    now = _now()

    if db is None:
        room = _memory_live_rooms.get(code)
        if room is None:
            raise ValueError("Live debate room was not found.")
        if _participant_role(room, user_id) != "host":
            raise PermissionError("Only the host can start this live debate.")
        if not room.get("opponent_user_id"):
            raise ValueError("Invite an opponent from another device before starting.")
        room["status"] = "running"
        room["started_at"] = now
        room["updated_at"] = now
        return serialize_live_room(room, _memory_live_statements.get(code, []), current_user)

    room = await db.get(LiveDebateRoom, code)
    if room is None:
        raise ValueError("Live debate room was not found.")
    if _participant_role(room, user_id) != "host":
        raise PermissionError("Only the host can start this live debate.")
    if not room.opponent_user_id:
        raise ValueError("Invite an opponent from another device before starting.")
    room.status = "running"
    room.started_at = now
    room.updated_at = now
    await db.commit()
    await db.refresh(room)
    result = await db.execute(
        select(LiveDebateStatement)
        .where(LiveDebateStatement.room_code == code)
        .order_by(LiveDebateStatement.created_at.asc())
    )
    return serialize_live_room(room, list(result.scalars().all()), current_user)


async def submit_live_statement(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    room_code: str,
    text: str,
) -> dict[str, Any]:
    code = room_code.upper()
    user_id = str(_value(current_user, "id"))

    if db is None:
        room = _memory_live_rooms.get(code)
        if room is None:
            raise ValueError("Live debate room was not found.")
        role = _participant_role(room, user_id)
        if role not in {"host", "opponent"}:
            raise PermissionError("Join the debate room before submitting.")
        if room.get("status") != "running":
            raise ValueError("Start the live debate before submitting statements.")
        existing_statements = _memory_live_statements.get(code, [])
        if _is_duplicate_statement(existing_statements, role, text):
            raise ValueError("This statement was already submitted. Edit it before sending again.")
        statement = await _analyze_and_build_statement(
            db,
            current_user,
            room,
            role,
            text,
        )
        _memory_live_statements.setdefault(code, []).append(statement)
        room["updated_at"] = _now()
        return serialize_live_room(room, _memory_live_statements.get(code, []), current_user)

    room = await db.get(LiveDebateRoom, code)
    if room is None:
        raise ValueError("Live debate room was not found.")
    role = _participant_role(room, user_id)
    if role not in {"host", "opponent"}:
        raise PermissionError("Join the debate room before submitting.")
    if room.status != "running":
        raise ValueError("Start the live debate before submitting statements.")

    duplicate_result = await db.execute(
        select(LiveDebateStatement)
        .where(
            LiveDebateStatement.room_code == code,
            LiveDebateStatement.user_id == user_id,
            LiveDebateStatement.speaker_key == role,
            LiveDebateStatement.body == text,
        )
        .order_by(LiveDebateStatement.created_at.desc())
        .limit(1)
    )
    duplicate = duplicate_result.scalar_one_or_none()
    if duplicate is not None:
        duplicate_created_at = duplicate.created_at
        if duplicate_created_at.tzinfo is None:
            duplicate_created_at = duplicate_created_at.replace(tzinfo=timezone.utc)
        if (_now() - duplicate_created_at.astimezone(timezone.utc)).total_seconds() < 10:
            raise ValueError("This statement was already submitted. Edit it before sending again.")

    statement_data = await _analyze_and_build_statement(db, current_user, room, role, text)
    statement = LiveDebateStatement(
        id=statement_data["id"],
        room_code=code,
        user_id=user_id,
        speaker_key=role,
        speaker_name=statement_data["speaker_name"],
        body=text,
        reply=statement_data["reply"],
        analysis=statement_data["analysis"],
        score=int(statement_data["score"]),
    )
    db.add(statement)
    room.updated_at = _now()
    await db.commit()

    result = await db.execute(
        select(LiveDebateStatement)
        .where(LiveDebateStatement.room_code == code)
        .order_by(LiveDebateStatement.created_at.asc())
    )
    return serialize_live_room(room, list(result.scalars().all()), current_user)


def _is_duplicate_statement(statements: list[dict[str, Any]], role: str, text: str) -> bool:
    if not statements:
        return False
    latest = statements[-1]
    created_at = _statement_value(latest, "created_at")
    if not isinstance(created_at, datetime):
        return False
    return (
        _statement_value(latest, "speaker_key") == role
        and str(_statement_value(latest, "body", "")).strip() == text.strip()
        and (_now() - created_at).total_seconds() < 10
    )


async def _analyze_and_build_statement(
    db: AsyncSession | None,
    current_user: User | dict[str, Any],
    room: LiveDebateRoom | dict[str, Any],
    role: str,
    text: str,
) -> dict[str, Any]:
    user_id = str(_value(current_user, "id"))
    code = str(_value(room, "code"))
    speaker_name = _speaker_name(room, role)
    topic = str(_value(room, "topic", "Live Debate") or "Live Debate")
    message = " ".join(
        [
            "Live debate room.",
            f"Topic: {topic}.",
            f"Speaker side: {role}.",
            f"Speaker: {speaker_name}.",
            f"Statement: {text}",
        ]
    )
    storage_session_id = f"{user_id}:live-room-{code}"
    reply = await process_debate_message(
        db=db,
        message=message,
        session_id=storage_session_id,
        difficulty="hard",
    )
    analysis = analyze_argument(text, reply)
    await record_debate_session(
        db=db,
        user_id=user_id,
        session_id=storage_session_id,
        message=text,
        reply=reply,
        analysis=analysis,
    )
    return {
        "id": str(uuid.uuid4()),
        "room_code": code,
        "user_id": user_id,
        "speaker_key": role,
        "speaker_name": speaker_name,
        "body": text,
        "reply": reply,
        "analysis": analysis,
        "score": int(analysis.get("scores", {}).get("strength", 0) or 0),
        "created_at": _now(),
    }
