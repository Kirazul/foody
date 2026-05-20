from __future__ import annotations

import base64
from collections.abc import Iterator
from dataclasses import dataclass
from io import BytesIO

from openai import OpenAI
from PIL import Image

from ..core.config import Settings, settings


@dataclass(frozen=True)
class LLMMessage:
    role: str
    content: str


class OpenAICompatibleChat:
    """Strict OpenAI-compatible chat client used by Foody RAG."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.cfg = cfg

    def _client(self, api_key: str | None = None, base_url: str | None = None) -> OpenAI:
        selected_base_url = (base_url or self.cfg.llm_base_url).rstrip("/")
        selected_api_key = (api_key or self.cfg.llm_api_key).strip()
        if not selected_api_key:
            if "api.openai.com" in selected_base_url:
                raise RuntimeError("OpenAI requires an API key. Save a provider with an API key or use a local OpenAI-compatible endpoint.")
            selected_api_key = "foody-local"
        return OpenAI(api_key=selected_api_key, base_url=selected_base_url)

    def list_models(self, api_key: str | None = None, base_url: str | None = None) -> list[str]:
        models = self._client(api_key=api_key, base_url=base_url).models.list()
        return sorted(model.id for model in models.data)

    @staticmethod
    def image_to_data_url(image: Image.Image) -> str:
        buffer = BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=86)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    def _user_content(self, user_prompt: str, image: Image.Image | None = None) -> str | list[dict[str, object]]:
        if image is not None and self.cfg.send_image_to_llm:
            return [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {"url": self.image_to_data_url(image)}},
            ]
        return user_prompt

    def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        image: Image.Image | None = None,
        temperature: float = 0.25,
    ) -> str:
        selected_model = model or self.cfg.llm_default_model
        response = self._client(api_key=api_key, base_url=base_url).chat.completions.create(
            model=selected_model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._user_content(user_prompt, image)},
            ],
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("The OpenAI-compatible model returned an empty response.")
        return content

    def stream_complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        image: Image.Image | None = None,
        temperature: float = 0.25,
    ) -> Iterator[str]:
        selected_model = model or self.cfg.llm_default_model
        stream = self._client(api_key=api_key, base_url=base_url).chat.completions.create(
            model=selected_model,
            temperature=temperature,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": self._user_content(user_prompt, image)},
            ],
        )
        yielded = False
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yielded = True
                yield delta
        if not yielded:
            raise RuntimeError("The OpenAI-compatible model returned an empty streamed response.")
