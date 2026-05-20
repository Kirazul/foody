from __future__ import annotations

from collections.abc import Iterator
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image

from ..core.config import Settings, settings
from .llm import OpenAICompatibleChat
from .rag import RAGIndex, format_citations
from .recognition import FoodRecognitionPredictor, RecognitionResult, confidence_label


PROMPT_RULES_PATH = Path(__file__).with_name("foody_rules.md")


@dataclass
class AssistantResponse:
    answer: str
    prediction: dict[str, object] | None
    citations: list[dict[str, object]]
    stages: list[str]
    warnings: list[str]


@dataclass
class PreparedChat:
    message: str
    image: Image.Image | None
    prediction: RecognitionResult | None
    citations: list[dict[str, object]]
    stages: list[str]
    warnings: list[str]
    system_prompt: str
    user_prompt: str


class FoodyAssistant:
    """Food image recognizer and recipe assistant combining classifier output with local RAG."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.cfg = cfg
        self.recognizer = FoodRecognitionPredictor(cfg)
        self.rag = RAGIndex(cfg)
        self.llm = OpenAICompatibleChat(cfg)
        self.system_rules = PROMPT_RULES_PATH.read_text(encoding="utf-8").strip()

    def _prediction_payload(self, prediction: RecognitionResult) -> dict[str, object]:
        payload = asdict(prediction)
        payload["confidence"] = round(float(prediction.confidence), 4)
        payload["confidence_label"] = confidence_label(prediction.confidence)
        return payload

    def _build_llm_prompts(
        self,
        message: str,
        prediction: RecognitionResult | None,
        citations: list[dict[str, object]],
        warnings: list[str],
    ) -> tuple[str, str]:
        prompt_sections = [f"User request:\n{message}"]
        if prediction:
            prompt_sections.append(f"Image prediction context:\n{self._prediction_payload(prediction)}")
        if citations:
            context_text = "\n\n".join(
                f"[{idx + 1}] {item['title']} ({item['source']}, score={item['score']}):\n{item['text']}"
                for idx, item in enumerate(citations)
            )
            prompt_sections.append(f"Retrieved context for private grounding:\n{context_text}")
        if warnings:
            prompt_sections.append("Runtime notes for private handling:\n" + "\n".join(warnings))
        return self.system_rules, "\n\n".join(prompt_sections)

    def prepare_chat(self, message: str, image: Image.Image | None = None, vision_model: str = "auto") -> PreparedChat:
        warnings: list[str] = []
        stages = ["input_received", "rag_retrieval"]
        prediction: RecognitionResult | None = None

        vision_enabled = vision_model.strip().lower() not in {"none", "off", "disabled", "disable"}
        if image is not None and vision_enabled:
            stages.append("image_preprocessed")
            prediction = self.recognizer.predict(image, model=vision_model)
            stages.append("efficientnetb3_food101_inference")
        elif image is not None:
            stages.append("vision_disabled")
            warnings.append("vision_disabled")

        cleaned_message = message.strip()
        dish_name = prediction.dish_name if prediction else None
        query_parts = [cleaned_message]
        if prediction:
            query_parts.append(prediction.dish_name)
        query = " ".join(part for part in query_parts if part).strip()
        chunks = self.rag.search(query, dish_name=dish_name, top_k=6) if (query or dish_name) else []
        citations = format_citations(chunks)
        system_prompt, user_prompt = self._build_llm_prompts(cleaned_message, prediction, citations, warnings)
        return PreparedChat(
            message=cleaned_message,
            image=image if vision_enabled else None,
            prediction=prediction,
            citations=citations,
            stages=stages,
            warnings=warnings,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

    def chat(
        self,
        message: str,
        image: Image.Image | None = None,
        vision_model: str = "auto",
        llm_model: str | None = None,
        llm_base_url: str | None = None,
        llm_api_key: str | None = None,
    ) -> AssistantResponse:
        prepared = self.prepare_chat(message=message, image=image, vision_model=vision_model)
        try:
            answer = self.llm.complete(
                system_prompt=prepared.system_prompt,
                user_prompt=prepared.user_prompt,
                model=llm_model,
                base_url=llm_base_url,
                api_key=llm_api_key,
                image=prepared.image,
            )
            prepared.stages.append("openai_compatible_generation")
        except Exception as exc:
            prepared.warnings.append(str(exc))
            prepared.stages.append("openai_compatible_generation_error")
            raise RuntimeError(str(exc)) from exc
        prepared.stages.append("answer_composed")
        payload = self._prediction_payload(prepared.prediction) if prepared.prediction else None
        return AssistantResponse(answer=answer, prediction=payload, citations=prepared.citations, stages=prepared.stages, warnings=prepared.warnings)

    def stream_chat_events(
        self,
        message: str,
        image: Image.Image | None = None,
        vision_model: str = "auto",
        llm_model: str | None = None,
        llm_base_url: str | None = None,
        llm_api_key: str | None = None,
    ) -> Iterator[tuple[str, dict[str, object]]]:
        prepared = self.prepare_chat(message=message, image=image, vision_model=vision_model)
        prediction_payload = self._prediction_payload(prepared.prediction) if prepared.prediction else None
        yield "metadata", {
            "prediction": prediction_payload,
            "citations": prepared.citations,
            "stages": prepared.stages,
            "warnings": prepared.warnings,
        }

        answer_parts: list[str] = []
        try:
            for token in self.llm.stream_complete(
                system_prompt=prepared.system_prompt,
                user_prompt=prepared.user_prompt,
                model=llm_model,
                base_url=llm_base_url,
                api_key=llm_api_key,
                image=prepared.image,
            ):
                answer_parts.append(token)
                yield "token", {"text": token}
            prepared.stages.append("openai_compatible_streaming_generation")
        except Exception as exc:
            prepared.warnings.append(str(exc))
            prepared.stages.append("openai_compatible_generation_error")
            yield "error", {"detail": str(exc), "stages": prepared.stages, "warnings": prepared.warnings}
            return

        prepared.stages.append("answer_composed")
        yield "done", {
            "answer": "".join(answer_parts),
            "prediction": prediction_payload,
            "citations": prepared.citations,
            "stages": prepared.stages,
            "warnings": prepared.warnings,
        }


assistant = FoodyAssistant()
