"""Pure-Python text helpers with no third-party imports."""
import re

# Memory must never hold credentials or sensitive identifiers.
_SENSITIVE = [
    re.compile(
        r"\b(password|passwd|passcode|pin|otp|cvv|cvc|secret|api[ _-]?key|"
        r"access[ _-]?token|auth[ _-]?token|private[ _-]?key|seed phrase|"
        r"recovery phrase|credit card|debit card|card number)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:\d[ -]?){13,19}\b"),  # card-like digit runs
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # US SSN
    re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b"),  # 12-digit national IDs (e.g. Aadhaar style)
    re.compile(r"\b(?:account|routing|iban|swift)\b[^.\n]{0,20}\d{6,}", re.IGNORECASE),
    re.compile(r"\b(?:sk|pk|AIza|ghp|xox[bp])[-_A-Za-z0-9]{16,}"),  # API-key shapes
]


def is_sensitive(text: str) -> bool:
    return any(p.search(text) for p in _SENSITIVE)


def make_title(text: str, limit: int = 60) -> str:
    """First line of a message, whitespace-collapsed and truncated."""
    first = text.strip().splitlines()[0] if text.strip() else ""
    clean = re.sub(r"\s+", " ", first).strip()
    if not clean:
        return "New chat"
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rstrip() + "…"


def tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()
