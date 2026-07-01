from pathlib import Path

from dotenv import load_dotenv


def load_backend_env() -> None:
    """Load backend environment files with local overrides."""
    root = Path(__file__).resolve().parent
    load_dotenv(root / ".env")
    load_dotenv(root / ".env.local", override=True)
