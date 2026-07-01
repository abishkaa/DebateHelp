from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any


WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?%?")
SENTENCE_RE = re.compile(r"[^.!?\n]+[.!?]?")

CLAIM_RE = re.compile(
    r"\b(?:should|must|need(?:s)? to|ought to|therefore|i (?:argue|believe)|this house|policy|ban|legalize|regulate)\b",
    re.IGNORECASE,
)
EVIDENCE_RE = re.compile(
    r"https?://\S+|\b\d{4}\b|\b\d+(?:\.\d+)?%|\b(?:study|report|research|source|data|survey|journal|experiment|according to|evidence|statistics?)\b",
    re.IGNORECASE,
)
REASONING_RE = re.compile(
    r"\b(?:because|therefore|since|as a result|leads? to|causes?|results? in|means that|so that|consequently|if .+ then)\b",
    re.IGNORECASE,
)
COUNTER_RE = re.compile(
    r"\b(?:however|although|even if|opponent|opposition|counter|rebut|trade-?off|on the other hand|critics|against|despite)\b",
    re.IGNORECASE,
)
IMPACT_RE = re.compile(
    r"\b(?:impact|harm|benefit|cost|risk|rights?|safety|equity|freedom|welfare|outcomes?|incentive|capacity|implementation)\b",
    re.IGNORECASE,
)
QUALIFIER_RE = re.compile(
    r"\b(?:often|usually|likely|may|might|can|in many cases|some|most|depends|unless|when|under)\b",
    re.IGNORECASE,
)

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "to", "of", "in", "on",
    "for", "with", "by", "as", "is", "are", "be", "this", "that", "it",
    "from", "at", "we", "they", "their", "our", "will", "would", "should",
}

TOPIC_PATTERNS = [
    (r"\b(?:healthcare|health care|medical|medicine|public health)\b", "Universal Healthcare"),
    (r"basic income|\bubi\b|income guarantee", "Universal Basic Income"),
    (r"artificial intelligence|ai regulation|high-risk systems|\bai\b", "AI Regulation"),
    (r"climate|carbon|emission|renewable|fossil", "Climate Policy"),
    (r"education|school|standardized test|university|student", "Education Reform"),
    (r"speech|censor|platform|misinformation|social media", "Speech and Platform Policy"),
    (r"tax|inflation|wage|jobs?|market|econom", "Economic Policy"),
]

FALLACY_RULES = [
    (
        "False dilemma",
        re.compile(r"\b(?:either|only two|no alternative|the only option|must choose)\b", re.IGNORECASE),
        "The wording may frame the debate as fewer options than actually exist.",
        10,
    ),
    (
        "Hasty generalization",
        re.compile(r"\b(?:all|everyone|nobody|always|never|every single|proves that all)\b", re.IGNORECASE),
        "Absolute language needs stronger evidence or narrower wording.",
        9,
    ),
    (
        "Causal overclaim",
        re.compile(r"\b(?:guarantees|will definitely|automatically|inevitably|single-handedly|proves that)\b", re.IGNORECASE),
        "The causal claim may be stronger than the evidence can support.",
        12,
    ),
    (
        "Ad hominem risk",
        re.compile(r"\b(?:idiot|stupid|corrupt people|evil people|brainwashed|morons?)\b", re.IGNORECASE),
        "Attacking people instead of the warrant weakens the argument.",
        14,
    ),
    (
        "Appeal to popularity",
        re.compile(r"\b(?:everyone knows|most people think|popular opinion|common sense proves)\b", re.IGNORECASE),
        "Popularity is not enough without a mechanism or source.",
        8,
    ),
    (
        "Slippery slope risk",
        re.compile(r"\b(?:slippery slope|will lead to everything|next thing you know|opens the door to)\b", re.IGNORECASE),
        "The chain of consequences needs intermediate proof.",
        9,
    ),
]


def clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, round(value)))


def words(text: str) -> list[str]:
    return [match.group(0).lower() for match in WORD_RE.finditer(text)]


def sentences(text: str) -> list[str]:
    return [
        match.group(0).strip()
        for match in SENTENCE_RE.finditer(text)
        if match.group(0).strip()
    ]


def short_excerpt(text: str, limit: int = 180) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def infer_topic(text: str) -> str:
    normalized = text.lower()
    for pattern, topic in TOPIC_PATTERNS:
        if re.search(pattern, normalized):
            return topic
    keywords = [
        token for token, _ in Counter(
            word for word in words(text) if word not in STOPWORDS and len(word) > 3
        ).most_common(3)
    ]
    return " ".join(keyword.capitalize() for keyword in keywords) or "Argument Analysis"


def count_syllables(word: str) -> int:
    cleaned = re.sub(r"[^a-z]", "", word.lower())
    if not cleaned:
        return 1
    groups = re.findall(r"[aeiouy]+", cleaned)
    count = len(groups)
    if cleaned.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def readability_grade(tokens: list[str], sentence_count: int) -> float:
    if not tokens or not sentence_count:
        return 0.0
    syllables = sum(count_syllables(token) for token in tokens)
    return max(0.0, 0.39 * (len(tokens) / sentence_count) + 11.8 * (syllables / len(tokens)) - 15.59)


def extract_sources(text: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    seen: set[str] = set()

    for match in EVIDENCE_RE.finditer(text):
        signal = match.group(0).rstrip(".,);]")
        key = signal.lower()
        if key in seen:
            continue
        seen.add(key)

        if signal.startswith(("http://", "https://")):
            signals.append(
                {
                    "source": signal,
                    "detail": "URL supplied by the user; verify author, date, and methodology before citing.",
                    "credibility": 78,
                    "tone": "green",
                }
            )
        elif re.fullmatch(r"\d+(?:\.\d+)?%", signal):
            signals.append(
                {
                    "source": signal,
                    "detail": "Statistic present, but it still needs a named source and context.",
                    "credibility": 56,
                    "tone": "amber",
                }
            )
        elif re.fullmatch(r"\d{4}", signal):
            signals.append(
                {
                    "source": signal,
                    "detail": "Year detected; connect it to a study, law, case, or event.",
                    "credibility": 48,
                    "tone": "amber",
                }
            )
        else:
            signals.append(
                {
                    "source": signal,
                    "detail": "Evidence keyword detected; name the exact source to raise credibility.",
                    "credibility": 52,
                    "tone": "amber",
                }
            )

    return signals[:8]


def detect_fallacies(text: str) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    for name, pattern, detail, penalty in FALLACY_RULES:
        match = pattern.search(text)
        if not match:
            continue
        flags.append(
            {
                "name": name,
                "detail": detail,
                "severity": "high" if penalty >= 12 else "medium",
                "excerpt": short_excerpt(match.group(0), 90),
                "penalty": penalty,
            }
        )
    return flags


def score_argument(text: str) -> dict[str, Any]:
    token_list = words(text)
    sentence_list = sentences(text)
    word_count = len(token_list)
    sentence_count = max(1, len(sentence_list))
    unique_words = {token for token in token_list if token not in STOPWORDS}
    lexical_diversity = len(unique_words) / max(1, word_count)
    avg_sentence_length = word_count / sentence_count
    grade = readability_grade(token_list, sentence_count)

    claim_hits = len(CLAIM_RE.findall(text))
    evidence_hits = len(EVIDENCE_RE.findall(text))
    reasoning_hits = len(REASONING_RE.findall(text))
    counter_hits = len(COUNTER_RE.findall(text))
    impact_hits = len(IMPACT_RE.findall(text))
    qualifier_hits = len(QUALIFIER_RE.findall(text))
    fallacies = detect_fallacies(text)
    fallacy_penalty = sum(int(item["penalty"]) for item in fallacies)

    length_score = clamp((word_count / 140) * 100)
    claim_clarity = clamp(35 + claim_hits * 20 + min(20, word_count / 8) - max(0, avg_sentence_length - 32))
    evidence_quality = clamp(24 + evidence_hits * 14 + min(16, word_count / 30) + (8 if any(source["tone"] == "green" for source in extract_sources(text)) else 0))
    reasoning_depth = clamp(30 + reasoning_hits * 14 + impact_hits * 6 + min(12, lexical_diversity * 18))
    counter_coverage = clamp(20 + counter_hits * 22 + qualifier_hits * 4)
    logical_consistency = clamp(82 + qualifier_hits * 2 - fallacy_penalty - max(0, avg_sentence_length - 38))
    readability = clamp(100 - abs(grade - 10) * 5 - max(0, avg_sentence_length - 34))
    strength = clamp(
        claim_clarity * 0.22
        + evidence_quality * 0.22
        + reasoning_depth * 0.24
        + counter_coverage * 0.14
        + logical_consistency * 0.14
        + length_score * 0.04
    )

    return {
        "strength": strength,
        "claim_clarity": claim_clarity,
        "evidence": evidence_quality,
        "reasoning": reasoning_depth,
        "coverage": counter_coverage,
        "logic": logical_consistency,
        "readability": readability,
        "word_count": word_count,
        "sentence_count": len(sentence_list),
        "avg_sentence_length": round(avg_sentence_length, 1),
        "readability_grade": round(grade, 1),
        "lexical_diversity": round(lexical_diversity, 2),
        "claim_hits": claim_hits,
        "evidence_hits": evidence_hits,
        "reasoning_hits": reasoning_hits,
        "counter_hits": counter_hits,
        "impact_hits": impact_hits,
        "qualifier_hits": qualifier_hits,
    }


def key_sentences(text: str, limit: int = 3) -> list[str]:
    ranked = []
    for sentence in sentences(text):
        signal_score = 0
        signal_score += 4 if CLAIM_RE.search(sentence) else 0
        signal_score += 4 if EVIDENCE_RE.search(sentence) else 0
        signal_score += 3 if REASONING_RE.search(sentence) else 0
        signal_score += 2 if IMPACT_RE.search(sentence) else 0
        signal_score += min(3, len(words(sentence)) / 12)
        ranked.append((signal_score, sentence))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [sentence for _, sentence in ranked[:limit] if sentence]


def recommendations(scores: dict[str, Any], fallacies: list[dict[str, Any]], sources: list[dict[str, Any]]) -> list[str]:
    tips: list[str] = []
    if scores["claim_clarity"] < 65:
        tips.append("State the main claim in one sentence using clear actor, action, and outcome.")
    if scores["evidence"] < 65:
        tips.append("Add at least one named source, statistic, case, or URL for the central factual premise.")
    if scores["reasoning"] < 65:
        tips.append("Explain the warrant: why the evidence proves the claim and what mechanism links cause to effect.")
    if scores["coverage"] < 60:
        tips.append("Add the strongest opposing argument, then answer it directly.")
    if fallacies:
        tips.append(f"Revise the flagged {fallacies[0]['name'].lower()} risk before using this in a debate.")
    if sources and all(source["tone"] != "green" for source in sources):
        tips.append("Turn evidence keywords into precise citations with author, organization, or link.")
    return tips[:5] or ["The structure is usable; improve by adding more precise evidence and a sharper rebuttal."]


def counter_guidance(text: str, topic: str, scores: dict[str, Any]) -> list[str]:
    normalized = text.lower()
    if "AI Regulation" in topic:
        base = "An opponent can argue broad regulation raises compliance costs, entrenches incumbents, and slows low-risk innovation."
    elif "Healthcare" in topic:
        base = "An opponent can accept the access goal while attacking funding, wait times, capacity, or transition costs."
    elif "Climate" in topic:
        base = "An opponent can challenge whether the policy changes incentives fast enough without unfairly raising household costs."
    elif "Education" in topic:
        base = "An opponent can argue implementation quality, teacher capacity, and unequal resources determine whether the reform works."
    elif "Speech" in topic:
        base = "An opponent can argue enforcement bias and chilling effects outweigh the proposed safety benefit."
    else:
        base = "An opponent will likely challenge whether the evidence proves this conclusion over a narrower alternative."

    second = (
        "Because counterargument coverage is currently low, explicitly concede the strongest tradeoff before rebutting it."
        if scores["coverage"] < 60
        else "Your argument already gestures at opposition; tighten it into a direct concession-plus-answer structure."
    )
    if "ban" in normalized:
        second = "If you defend a ban, explain why lighter regulation would be insufficient."
    return [base, second]


def analyze_argument(argument: str, reply: str = "") -> dict[str, Any]:
    clean_argument = argument.strip()
    topic = infer_topic(clean_argument)
    scores = score_argument(clean_argument)
    sources = extract_sources(clean_argument)
    fallacies = detect_fallacies(clean_argument)
    key_args = key_sentences(clean_argument)
    tips = recommendations(scores, fallacies, sources)
    counters = counter_guidance(clean_argument, topic, scores)

    evidence_note = (
        "No concrete citation signals were found. Add a named study, report, dataset, statistic, case, or URL."
        if not sources
        else f"{len(sources)} evidence signal{'s' if len(sources) != 1 else ''} found; strongest signal credibility is {max(source['credibility'] for source in sources)}%."
    )
    fallacy_note = (
        f"Flagged {len(fallacies)} reasoning risk{'s' if len(fallacies) != 1 else ''}: "
        + ", ".join(item["name"] for item in fallacies[:3])
        if fallacies
        else "No major fallacy pattern was detected by the local analyzer."
    )
    why = (
        f"Score is computed from {scores['word_count']} words, {scores['evidence_hits']} evidence signals, "
        f"{scores['reasoning_hits']} reasoning connectors, {scores['counter_hits']} counterargument markers, "
        f"and {len(fallacies)} fallacy flags."
    )
    change = (
        tips[0]
        if tips
        else "A stronger source or clearer counterargument could still change the score."
    )
    coach_summary = (
        short_excerpt(reply, 240)
        if reply
        else f"{topic}: current argument strength is {scores['strength']}% with evidence at {scores['evidence']}%."
    )

    return {
        "topic": topic,
        "scores": scores,
        "sources": sources,
        "fallacies": [
            {key: value for key, value in item.items() if key != "penalty"}
            for item in fallacies
        ],
        "recommendations": tips,
        "key_arguments": key_args or ([short_excerpt(clean_argument)] if clean_argument else []),
        "evidence": [
            f"{source['source']}: {source['detail']}"
            for source in sources
        ] or [evidence_note],
        "counterarguments": counters,
        "answer": reply or "Run analysis to generate coaching text.",
        "why": why,
        "evidenceNote": evidence_note,
        "counterargument": " ".join(counters),
        "change": change,
        "coachSummary": coach_summary,
        "fallacyNote": fallacy_note,
        "method": "local_nlp_weighted_scoring_v1",
    }
