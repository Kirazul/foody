from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
FOODY_ROOT = BACKEND_ROOT.parent


def _path_from_env(name: str, default: Path) -> Path:
    value = os.getenv(name)
    return Path(value).expanduser().resolve() if value else default.resolve()


@dataclass(frozen=True)
class Settings:
    """Central paths and tunables for the Foody pipeline."""

    project_root: Path = field(default_factory=lambda: FOODY_ROOT.resolve())
    data_dir: Path = field(default_factory=lambda: _path_from_env("FOODY_DATA_DIR", FOODY_ROOT / "data"))
    model_dir: Path = field(default_factory=lambda: _path_from_env("FOODY_MODEL_DIR", FOODY_ROOT / "models"))
    results_dir: Path = field(default_factory=lambda: _path_from_env("FOODY_RESULTS_DIR", FOODY_ROOT / "results"))
    knowledge_dir: Path = field(default_factory=lambda: _path_from_env("FOODY_KNOWLEDGE_DIR", FOODY_ROOT / "knowledge"))
    notebook_dir: Path = field(default_factory=lambda: _path_from_env("FOODY_NOTEBOOK_DIR", FOODY_ROOT / "notebooks" / "main"))
    llm_base_url: str = os.getenv("FOODY_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    llm_api_key: str = os.getenv("FOODY_LLM_API_KEY", "")
    llm_default_model: str = os.getenv("FOODY_LLM_MODEL", "gpt-4o-mini")
    llm_models: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv("FOODY_LLM_MODELS", os.getenv("FOODY_LLM_MODEL", "gpt-4o-mini")).split(",")
        if item.strip()
    )
    send_image_to_llm: bool = os.getenv("FOODY_SEND_IMAGE_TO_LLM", "0") == "1"

    def ensure_runtime_dirs(self) -> None:
        for path in [self.data_dir, self.model_dir, self.results_dir, self.knowledge_dir]:
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()
