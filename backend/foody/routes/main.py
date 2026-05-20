from __future__ import annotations

import json
from io import BytesIO

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from PIL import Image
from pydantic import BaseModel

from ..services.assistant import assistant
from ..core.config import settings


app = FastAPI(title="Foody API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FetchModelsRequest(BaseModel):
    base_url: str
    api_key: str


async def _read_image(file: UploadFile | None) -> Image.Image | None:
    if file is None:
        return None
    content = await file.read()
    if not content:
        return None
    try:
        return Image.open(BytesIO(content)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image upload: {exc}") from exc


def _sse(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "service": "foody", "version": "0.1.0"}


@app.get("/notebook")
def notebook() -> dict[str, object]:
    notebook_path = settings.notebook_dir
    files = sorted(notebook_path.glob("*.ipynb")) if notebook_path.exists() else []
    if not files:
        raise HTTPException(status_code=404, detail="No training notebook found")
    content = json.loads(files[0].read_text(encoding="utf-8"))
    return content


@app.get("/notebook/raw", response_class=HTMLResponse)
def notebook_raw() -> HTMLResponse:
    notebook_path = settings.notebook_dir
    files = sorted(notebook_path.glob("*.html")) if notebook_path.exists() else []
    if not files:
        raise HTTPException(status_code=404, detail="No raw HTML notebook found")
    return HTMLResponse(content=files[0].read_text(encoding="utf-8"))


@app.get("/metadata")
def metadata() -> dict[str, object]:
    recognizer = assistant.recognizer
    comparison_path = settings.results_dir / "model_comparison.csv"
    return {
        "models": recognizer.available_models(),
        "vision_models": recognizer.model_options(),
        "llm": {
            "base_url": settings.llm_base_url,
            "default_model": settings.llm_default_model,
            "models": list(settings.llm_models),
            "api_key_configured": bool(settings.llm_api_key),
            "sends_image_to_llm": settings.send_image_to_llm,
        },
        "data_dir": str(settings.data_dir),
        "model_dir": str(settings.model_dir),
        "comparison_available": comparison_path.exists(),
        "rag_chunks": len(assistant.rag.chunks),
        "pipeline": [
            "metadata_load",
            "food101_image_preprocessing",
            "efficientnetb3_food101_inference",
            "dish_name_prediction",
            "recipe_rag_retrieval",
            "rag_augmented_chat",
        ],
    }


@app.post("/llm/models")
def llm_models(payload: FetchModelsRequest) -> dict[str, object]:
    try:
        models = assistant.llm.list_models(api_key=payload.api_key, base_url=payload.base_url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"models": models}


@app.post("/predict")
async def predict(file: UploadFile = File(...), vision_model: str = Form("auto")) -> dict[str, object]:
    image = await _read_image(file)
    if image is None:
        raise HTTPException(status_code=400, detail="An image file is required.")
    try:
        result = assistant.recognizer.predict(image, model=vision_model)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return assistant._prediction_payload(result)


@app.post("/chat")
async def chat(
    message: str = Form(""),
    llm_model: str = Form(""),
    llm_base_url: str = Form(""),
    llm_api_key: str = Form(""),
    vision_model: str = Form("auto"),
    file: UploadFile | None = File(None),
) -> dict[str, object]:
    image = await _read_image(file)
    try:
        response = assistant.chat(
            message=message,
            image=image,
            vision_model=vision_model,
            llm_model=llm_model or None,
            llm_base_url=llm_base_url or None,
            llm_api_key=llm_api_key or None,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "answer": response.answer,
        "prediction": response.prediction,
        "citations": response.citations,
        "stages": response.stages,
        "warnings": response.warnings,
    }


@app.post("/chat/stream")
async def chat_stream(
    message: str = Form(""),
    llm_model: str = Form(""),
    llm_base_url: str = Form(""),
    llm_api_key: str = Form(""),
    vision_model: str = Form("auto"),
    file: UploadFile | None = File(None),
) -> StreamingResponse:
    image = await _read_image(file)

    def generate():
        try:
            for event, payload in assistant.stream_chat_events(
                message=message,
                image=image,
                vision_model=vision_model,
                llm_model=llm_model or None,
                llm_base_url=llm_base_url or None,
                llm_api_key=llm_api_key or None,
            ):
                yield _sse(event, payload)
        except Exception as exc:
            yield _sse("error", {"detail": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
