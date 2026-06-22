import httpx
import os
import re
from dotenv import load_dotenv
from typing import List, Tuple, Optional
from datetime import datetime

load_dotenv()

API_KEY = os.getenv('OYLAN_API_KEY')
ASSISTANT_ID = os.getenv('OYLAN_ASSISTANT_ID')
BASE_URL = os.getenv('OYLAN_BASE_URL', 'https://oylan.nu.edu.kz/api/v1')
BRAVE_API_KEY = os.getenv('BRAVE_API_KEY', '')

HEADERS = {
    'Authorization': f'Api-Key {API_KEY}',
    'accept': 'application/json',
}

# Difficulty-based system prompts
DIFFICULTY_PROMPTS = {
    "Gentle": "You are a gentle debate coach. Offer constructive feedback and mild counterarguments. Be encouraging and supportive while still challenging the user's thinking.",
    "Normal": "You are a balanced debate coach. Provide solid counterarguments with evidence, question assumptions respectfully, and help the user strengthen their position.",
    "Aggressive": "You are an aggressive debate coach. Challenge arguments vigorously, point out logical fallacies directly, and demand strong evidence. Push the user to defend their position rigorously."
}

SYSTEM_PROMPT = """You are a Debate Coach AI agent. Your job is to challenge the user's arguments using real evidence and critical thinking.

You have access to three tools:
1. search_counterarguments(topic) - Find opposing viewpoints and counterarguments
2. check_facts(claim) - Verify factual claims and statistics
3. suggest_sources(topic) - Find credible sources and references

When you need to use a tool, respond EXACTLY with a line like:
TOOL: tool_name("argument")

After receiving tool results, analyze them and provide your final response in plain text.
Always cite your sources at the end using [Source: URL] format.

{difficulty_prompt}

Remember: Be evidence-based, cite sources, and help users improve their argumentation skills."""

async def send_message(messages: list) -> str:
    """Send a conversation history to Oylan and return its text reply."""
    url = f'{BASE_URL}/assistant/{ASSISTANT_ID}/interactions/'
    
    # Convert messages to Oylan's expected format
    # Oylan expects the latest message content, but we'll include context
    latest_message = messages[-1] if messages else {"role": "user", "content": ""}
    
    # Build a context string from previous messages
    context = ""
    for msg in messages[:-1]:
        role_label = "User" if msg["role"] == "user" else "Assistant"
        context += f"{role_label}: {msg['content']}\n"
    
    if context:
        full_content = f"Previous conversation:\n{context}\n\nLatest message: {latest_message['content']}"
    else:
        full_content = latest_message['content']
    
    data = {'content': full_content, 'stream': False}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=HEADERS, json=data)
        resp.raise_for_status()
        result = resp.json()
        return result['response']['content']


# Tool implementations
async def search_counterarguments(topic: str) -> str:
    """Search for counterarguments on a given topic using Brave Search."""
    if not BRAVE_API_KEY:
        return "[Brave API key not configured - simulating counterargument search]"
    
    query = f"counterarguments against {topic}"
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
    }
    params = {'q': query, 'count': 5}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get('web', {}).get('results', [])
            if results:
                snippets = [f"- {r.get('description', 'No description')}" for r in results[:3]]
                urls = [r.get('url', '') for r in results[:3]]
                return f"Counterarguments found:\n" + "\n".join(snippets) + f"\n\nSources: {', '.join(urls)}"
            return "No counterarguments found."
    except Exception as e:
        return f"Error searching counterarguments: {str(e)}"


async def check_facts(claim: str) -> str:
    """Fact-check a claim using Brave Search."""
    if not BRAVE_API_KEY:
        return "[Brave API key not configured - simulating fact check]"
    
    query = f"fact check {claim}"
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
    }
    params = {'q': query, 'count': 5}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get('web', {}).get('results', [])
            if results:
                snippets = [f"- {r.get('description', 'No description')}" for r in results[:3]]
                urls = [r.get('url', '') for r in results[:3]]
                return f"Fact-check results:\n" + "\n".join(snippets) + f"\n\nSources: {', '.join(urls)}"
            return "No fact-check results found."
    except Exception as e:
        return f"Error fact-checking: {str(e)}"


async def suggest_sources(topic: str) -> str:
    """Suggest credible sources on a topic using Brave Search."""
    if not BRAVE_API_KEY:
        return "[Brave API key not configured - simulating source suggestions]"
    
    query = f"credible sources academic research {topic}"
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
    }
    params = {'q': query, 'count': 5}
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get('web', {}).get('results', [])
            if results:
                sources = [f"- {r.get('title', 'Unknown')}: {r.get('url', '')}" for r in results[:5]]
                return "Suggested sources:\n" + "\n".join(sources)
            return "No sources found."
    except Exception as e:
        return f"Error finding sources: {str(e)}"


# Parse TOOL: calls from LLM response
TOOL_PATTERN = re.compile(r'TOOL:\s*(\w+)\("([^"]+)"\)')

async def execute_tool(tool_name: str, argument: str) -> Tuple[str, str]:
    """Execute a tool and return (tool_name, result)."""
    if tool_name == "search_counterarguments":
        result = await search_counterarguments(argument)
    elif tool_name == "check_facts":
        result = await check_facts(argument)
    elif tool_name == "suggest_sources":
        result = await suggest_sources(argument)
    else:
        result = f"Unknown tool: {tool_name}"
    return tool_name, result


async def run_agent_loop(messages: list, difficulty: str = "Normal") -> Tuple[str, List[str], List[str]]:
    """
    Run the ReAct agent loop:
    1. Send messages to Oylan
    2. If response contains TOOL: call, execute the tool and feed result back
    3. Repeat until Oylan returns plain text
    4. Return (final_response, tools_used, citations)
    """
    # Build the full prompt with difficulty setting
    difficulty_prompt = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["Normal"])
    full_system = SYSTEM_PROMPT.format(difficulty_prompt=difficulty_prompt)
    
    # Prepend system prompt to messages
    agent_messages = [{"role": "system", "content": full_system}] + messages
    
    tools_used = []
    citations = []
    max_iterations = 5
    iteration = 0
    
    while iteration < max_iterations:
        response = await send_message(agent_messages)
        
        # Check for TOOL: call
        match = TOOL_PATTERN.search(response)
        if match:
            tool_name = match.group(1)
            argument = match.group(2)
            tools_used.append(f"{tool_name}({argument})")
            
            # Execute the tool
            _, result = await execute_tool(tool_name, argument)
            
            # Feed the tool result back into the conversation
            agent_messages.append({"role": "assistant", "content": response})
            agent_messages.append({"role": "user", "content": f"Tool result: {result}"})
            
            iteration += 1
        else:
            # No tool call - extract citations and return final response
            citation_pattern = re.compile(r'\[Source:\s*([^\]]+)\]')
            found_citations = citation_pattern.findall(response)
            citations = found_citations
            
            # Clean up the response (remove any remaining TOOL: lines)
            clean_response = re.sub(r'TOOL:\s*\w+\("[^"]+"\)\s*', '', response).strip()
            
            return clean_response, tools_used, citations
    
    # Max iterations reached - return whatever we have
    return "I've researched this thoroughly. Here's my analysis: " + messages[-1]['content'], tools_used, citations