import httpx
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('OYLAN_API_KEY')
ASSISTANT_ID = os.getenv('OYLAN_ASSISTANT_ID')
BASE_URL = os.getenv('OYLAN_BASE_URL', 'https://oylan.nu.edu.kz/api/v1')

class OylanUnavailableError(RuntimeError):
    """Raised when the remote Oylan assistant cannot provide a response."""


def is_oylan_configured() -> bool:
    return bool(API_KEY and ASSISTANT_ID)


async def send_message(content: str) -> str:
    """Send a message to the Oylan assistant and return its text reply."""
    if not is_oylan_configured():
        raise OylanUnavailableError("Oylan credentials are not configured.")

    url = f'{BASE_URL}/assistant/{ASSISTANT_ID}/interactions/'
    data = {'content': content, 'stream': False}
    headers = {
        'Authorization': f'Api-Key {API_KEY}',
        'accept': 'application/json',
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, data=data)
            resp.raise_for_status()
            result = resp.json()
            content_value = result["response"]["content"]
            if not isinstance(content_value, str) or not content_value.strip():
                raise OylanUnavailableError("Oylan returned an empty response.")
            return content_value
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        raise OylanUnavailableError("Oylan is temporarily unavailable.") from exc
