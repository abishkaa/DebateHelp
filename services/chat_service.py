from services.oylan import run_agent_loop
from typing import List, Tuple

async def process_debate_message(messages: list, difficulty: str = "Normal") -> Tuple[str, List[str], List[str]]:
    """
    Process a debate message using the ReAct agent loop.
    
    Args:
        messages: List of message dicts with 'role' and 'content' keys
        difficulty: Difficulty level ("Gentle", "Normal", or "Aggressive")
    
    Returns:
        Tuple of (reply_text, tools_used, citations)
    """
    reply, tools_used, citations = await run_agent_loop(messages, difficulty)
    return reply, tools_used, citations
