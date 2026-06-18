from services.oylan import send_message

async def process_debate_message(message: str) -> str:
    """Send the user's argument to Oylan and return the reply."""
    reply = await send_message(message)
    return reply
