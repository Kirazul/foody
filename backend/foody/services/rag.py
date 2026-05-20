from __future__ import annotations

import csv
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from statistics import median

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..core.config import Settings, settings


@dataclass
class DocumentChunk:
    id: str
    title: str
    source: str
    text: str
    score: float = 0.0


def _split_markdown(path: Path) -> list[DocumentChunk]:
    text = path.read_text(encoding="utf-8")
    chunks: list[DocumentChunk] = []
    current_title = path.stem.replace("_", " ").title()
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_lines
        body = "\n".join(line.strip() for line in current_lines).strip()
        if body:
            chunks.append(
                DocumentChunk(
                    id=f"{path.stem}-{len(chunks) + 1}",
                    title=current_title,
                    source=path.name,
                    text=body,
                )
            )
        current_lines = []

    for line in text.splitlines():
        if line.startswith("#"):
            flush()
            current_title = line.lstrip("#").strip() or current_title
        elif line.strip():
            current_lines.append(line)
        elif len(" ".join(current_lines)) > 600:
            flush()
    flush()
    return chunks


def _safe_float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _nutrition5k_chunks(cfg: Settings) -> list[DocumentChunk]:
    paths = sorted(cfg.data_dir.glob("nutrition5k_dataset_metadata_dish_metadata_*.csv"))
    if not paths:
        return []

    calories: list[float] = []
    masses: list[float] = []
    fats: list[float] = []
    carbs: list[float] = []
    proteins: list[float] = []
    ingredients: Counter[str] = Counter()
    rows_seen = 0

    for path in paths:
        try:
            with path.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.reader(handle)
                for row in reader:
                    if len(row) < 6:
                        continue
                    rows_seen += 1
                    for target, index in [(calories, 1), (masses, 2), (fats, 3), (carbs, 4), (proteins, 5)]:
                        number = _safe_float(row[index])
                        if number is not None and number >= 0:
                            target.append(number)
                    for index in range(7, len(row), 7):
                        name = row[index].strip().lower()
                        if name and name != "deprecated":
                            ingredients[name] += 1
        except OSError:
            continue

    if rows_seen == 0 or not calories or not masses or not fats or not carbs or not proteins:
        return []

    def percentile(values: list[float], fraction: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))]

    chunks = [
        DocumentChunk(
            id="nutrition5k-reference-ranges",
            title="Nutrition5k Reference Ranges",
            source="nutrition5k_metadata",
            text=(
                f"Nutrition5k local metadata covers {rows_seen} measured cafe dishes. "
                f"Calories per dish: median {median(calories):.0f} kcal, middle range {percentile(calories, 0.25):.0f}-{percentile(calories, 0.75):.0f} kcal. "
                f"Mass: median {median(masses):.0f} g. "
                f"Macros median: fat {median(fats):.1f} g, carbs {median(carbs):.1f} g, protein {median(proteins):.1f} g. "
                "Use these as broad context only; Foody's Food-101 classifier predicts dish class, not precise calories or grams. "
                "Give ranges and explain uncertainty from portion size, oils, sauces, toppings, and hidden ingredients."
            ),
        )
    ]

    common = [f"{name} ({count} dishes)" for name, count in ingredients.most_common(80)]
    for group_index in range(0, len(common), 20):
        group = common[group_index : group_index + 20]
        chunks.append(
            DocumentChunk(
                id=f"nutrition5k-common-ingredients-{group_index // 20 + 1}",
                title="Nutrition5k Common Ingredients",
                source="nutrition5k_metadata",
                text=(
                    "Common measured ingredients in local Nutrition5k metadata: "
                    + ", ".join(group)
                    + ". Use these to ground ingredient and calorie caveats when visually similar foods are discussed."
                ),
            )
        )
    return chunks


class RAGIndex:
    """Small local RAG index for project and nutrition knowledge."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.cfg = cfg
        self.chunks: list[DocumentChunk] = []
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix = None
        self.reload()

    def reload(self) -> None:
        chunks: list[DocumentChunk] = []
        if self.cfg.knowledge_dir.exists():
            for path in sorted(self.cfg.knowledge_dir.glob("*.md")):
                chunks.extend(_split_markdown(path))
        chunks.extend(_nutrition5k_chunks(self.cfg))
        self.chunks = chunks
        if not chunks:
            self.vectorizer = None
            self.matrix = None
            return
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=12000)
        self.matrix = self.vectorizer.fit_transform([chunk.text for chunk in chunks])

    def search(self, query: str, dish_name: str | None = None, top_k: int = 4) -> list[DocumentChunk]:
        if not query.strip() and not dish_name:
            return []
        
        results: list[DocumentChunk] = []
        
        # 1. If dish_name is provided, find the exact matching profile chunk first
        target_chunk = None
        if dish_name:
            normalized_dish = dish_name.lower().replace("_", " ").strip()
            for chunk in self.chunks:
                chunk_title_norm = chunk.title.lower().replace("_", " ").strip()
                if chunk_title_norm == normalized_dish or normalized_dish in chunk_title_norm:
                    target_chunk = chunk
                    break
        
        # 2. Perform TF-IDF search for other relevant chunks
        search_k = top_k - 1 if target_chunk else top_k
        
        if query.strip() and self.vectorizer is not None and self.matrix is not None and search_k > 0:
            query_vector = self.vectorizer.transform([query])
            semantic_scores = cosine_similarity(query_vector, self.matrix).reshape(-1)
            query_norm = query.lower().replace("_", " ")
            query_terms = {term for term in query_norm.replace("-", " ").split() if len(term) > 2}
            scored: list[tuple[float, int]] = []
            for idx, chunk in enumerate(self.chunks):
                if target_chunk and chunk.id == target_chunk.id:
                    continue
                text_norm = f"{chunk.title} {chunk.text}".lower().replace("_", " ")
                lexical = 0.0
                if chunk.title.lower().replace("_", " ") in query_norm:
                    lexical += 0.2
                if query_terms:
                    overlap = sum(1 for term in query_terms if term in text_norm)
                    lexical += min(0.18, overlap * 0.025)
                scored.append((float(semantic_scores[idx]) + lexical, idx))
            
            scored = sorted(scored, key=lambda x: x[0], reverse=True)[:search_k]
            for score, idx in scored:
                # Filter out weak/unrelated matches to prevent showing irrelevant sources (e.g. Red Velvet Cake for unrelated questions)
                if score <= 0.08:
                    continue
                chunk = self.chunks[idx]
                results.append(DocumentChunk(**{**chunk.__dict__, "score": score}))
                
        # 3. Add target chunk at the front
        if target_chunk:
            if not any(c.id == target_chunk.id for c in results):
                results.insert(0, DocumentChunk(**{**target_chunk.__dict__, "score": 1.0}))
                
        return results[:top_k]


def format_citations(chunks: list[DocumentChunk]) -> list[dict[str, object]]:
    return [
        {
            "id": chunk.id,
            "title": chunk.title,
            "source": chunk.source,
            "score": round(chunk.score, 4),
            "text": chunk.text,
        }
        for chunk in chunks
    ]
