from __future__ import annotations

import argparse
from pathlib import Path

import uvicorn
from PIL import Image

from ..core.config import settings
from ..services.recognition import FoodRecognitionPredictor


def main() -> None:
    parser = argparse.ArgumentParser(description="Foody Food-101 recognition and recipe RAG assistant")
    subparsers = parser.add_subparsers(dest="command", required=True)

    predict = subparsers.add_parser("predict", help="Recognize a Food-101 dish from one image")
    predict.add_argument("image", type=Path)
    predict.add_argument("--vision-model", default="auto", choices=["auto", "efficientnetb3", "customcnn", "customresnet10", "resnet18", "resnet50"])

    serve = subparsers.add_parser("serve", help="Start the FastAPI server")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()
    if args.command == "predict":
        image = Image.open(args.image).convert("RGB")
        result = FoodRecognitionPredictor(settings).predict(image, model=args.vision_model)
        print(f"{result.dish_name} ({result.confidence:.1%}) via {result.model}")
    elif args.command == "serve":
        uvicorn.run("foody.routes.main:app", host=args.host, port=args.port, reload=True)


if __name__ == "__main__":
    main()
