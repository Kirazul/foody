from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from ..core.config import Settings, settings


MODEL_ALIASES = {
    "auto": "auto",
    "best": "auto",
    "efficientnet": "efficientnetb3",
    "efficientnetb3": "efficientnetb3",
    "efficientnet_b3": "efficientnetb3",
    "customcnn": "customcnn",
    "custom_cnn": "customcnn",
    "customresnet10": "customresnet10",
    "custom_resnet10": "customresnet10",
    "resnet18": "resnet18",
    "resnet_18": "resnet18",
    "resnet50": "resnet50",
    "resnet_50": "resnet50",
}

MODEL_FILES = {
    "efficientnetb3": "EfficientNetB3_best.pth",
    "customcnn": "CustomCNN_best.pth",
    "customresnet10": "CustomResNet10_best.pth",
    "resnet18": "ResNet18_best.pth",
    "resnet50": "ResNet50_best.pth",
}

MODEL_NAMES = {
    "efficientnetb3": "EfficientNetB3 Food-101",
    "customcnn": "Custom CNN Scratch Baseline",
    "customresnet10": "Custom ResNet10 Scratch Baseline",
    "resnet18": "ResNet18 ImageNet-Finetuned",
    "resnet50": "ResNet50 ImageNet-Finetuned",
}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


@dataclass
class RecognitionResult:
    dish_name: str
    class_name: str
    confidence: float
    model: str
    status: str
    top_predictions: list[dict[str, object]]
    task: str = "food101_classification"
    warning: str | None = None


def _load_json(path: Path) -> dict[str, object] | list[object] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


def _display_name(class_name: str) -> str:
    return class_name.replace("_", " ").title()


def _state_dict_without_module_prefix(state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    if not any(key.startswith("module.") for key in state_dict):
        return state_dict
    return {key.removeprefix("module."): value for key, value in state_dict.items()}


class ConvNormAct(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, stride: int = 1) -> None:
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class FoodyCustomCNN(nn.Module):
    def __init__(self, num_classes: int) -> None:
        super().__init__()
        self.features = nn.Sequential(
            ConvNormAct(3, 32, stride=2),
            ConvNormAct(32, 64),
            ConvNormAct(64, 64, stride=2),
            ConvNormAct(64, 128),
            ConvNormAct(128, 128, stride=2),
            ConvNormAct(128, 256),
            ConvNormAct(256, 256, stride=2),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(nn.Flatten(), nn.Dropout(0.35), nn.Linear(256, num_classes))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


class ResidualBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, stride: int = 1) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.act1 = nn.SiLU(inplace=True)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels)
            )
        self.act2 = nn.SiLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.act1(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += self.shortcut(x)
        return self.act2(out)


class CustomResNet10(nn.Module):
    def __init__(self, num_classes: int) -> None:
        super().__init__()
        self.in_conv = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.SiLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        self.layer1 = ResidualBlock(64, 64, stride=1)
        self.layer2 = ResidualBlock(64, 128, stride=2)
        self.layer3 = ResidualBlock(128, 256, stride=2)
        self.layer4 = ResidualBlock(256, 512, stride=2)
        self.avgpool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(512, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.in_conv(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        return self.fc(x)


class FoodRecognitionPredictor:
    """Lazy Food-101 classifier loader for the active Kaggle-exported EfficientNet artifact."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.cfg = cfg
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.class_names = self._load_class_names()
        self.registry = _load_json(self._model_path("model_registry.json")) or {}
        self.best_model = self._best_model_key()
        self._models: dict[str, nn.Module] = {}
        self._transforms = {
            "efficientnetb3": self._build_transform(300),
            "customcnn": self._build_transform(224),
            "customresnet10": self._build_transform(224),
            "resnet18": self._build_transform(224),
            "resnet50": self._build_transform(224),
        }

    def _model_path(self, filename: str) -> Path:
        return self.cfg.model_dir / filename

    def _load_class_names(self) -> list[str]:
        payload = _load_json(self._model_path("class_names.json"))
        if isinstance(payload, list) and all(isinstance(item, str) for item in payload):
            return list(payload)
        return []

    def _best_model_key(self) -> str:
        if isinstance(self.registry, dict):
            best = str(self.registry.get("best_model", "")).lower()
            mapped = MODEL_ALIASES.get(best)
            if mapped and mapped != "auto":
                return mapped
        for key in ["efficientnetb3"]:
            if self._model_path(MODEL_FILES[key]).exists():
                return key
        return "efficientnetb3"

    @staticmethod
    def _build_transform(image_size: int):
        if image_size > 224:
            return transforms.Compose(
                [
                    transforms.Resize(320),
                    transforms.CenterCrop(image_size),
                    transforms.ToTensor(),
                    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
                ]
            )
        return transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )

    def available_models(self) -> dict[str, bool]:
        has_classes = bool(self.class_names)
        availability = {key: has_classes and self._model_path(filename).exists() for key, filename in MODEL_FILES.items()}
        availability["auto"] = any(availability.values())
        return availability

    def model_options(self) -> list[dict[str, str]]:
        return [
            {"id": "none", "name": "None", "description": "Disables Foody image inference for uploaded images"},
            {"id": "auto", "name": "Best available", "description": "Uses model_registry.json or the strongest available Food-101 checkpoint"},
            {"id": "efficientnetb3", "name": "EfficientNetB3", "description": "Active Food-101 classifier trained for the Foody workflow (300px)"},
            {"id": "customcnn", "name": "Custom CNN", "description": "Scratch CNN baseline trained at 224px"},
            {"id": "customresnet10", "name": "Custom ResNet10", "description": "Scratch ResNet10 skip-connection baseline trained at 224px"},
            {"id": "resnet18", "name": "ResNet18", "description": "Frozen ImageNet ResNet18 backbone with Food-101 classifier head (224px)"},
            {"id": "resnet50", "name": "ResNet50", "description": "Frozen ImageNet ResNet50 backbone with Food-101 classifier head (224px)"},
        ]

    def _resolve_model_key(self, model: str) -> str:
        key = MODEL_ALIASES.get(model.lower(), "auto")
        return self.best_model if key == "auto" else key

    def _build_model(self, key: str) -> nn.Module:
        num_classes = len(self.class_names)
        if key == "efficientnetb3":
            model = models.efficientnet_b3(weights=None)
            model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
            return model
        elif key == "customcnn":
            return FoodyCustomCNN(num_classes)
        elif key == "customresnet10":
            return CustomResNet10(num_classes)
        elif key == "resnet18":
            model = models.resnet18(weights=None)
            model.fc = nn.Linear(model.fc.in_features, num_classes)
            return model
        elif key == "resnet50":
            model = models.resnet50(weights=None)
            model.fc = nn.Linear(model.fc.in_features, num_classes)
            return model
        else:
            raise ValueError(f"Unknown model key: {key}")

    def _load_model(self, key: str) -> nn.Module:
        if key in self._models:
            return self._models[key]
        if not self.class_names:
            raise FileNotFoundError("Food-101 class_names.json was not found. Copy Kaggle artifacts into foody/models first.")
        weights = self._model_path(MODEL_FILES[key])
        if not weights.exists():
            raise FileNotFoundError(f"{MODEL_FILES[key]} was not found. Copy Kaggle artifacts into foody/models first.")
        model = self._build_model(key)
        state_dict = torch.load(weights, map_location=self.device)
        if not isinstance(state_dict, dict):
            raise RuntimeError(f"Unsupported checkpoint format: {weights}")
        model.load_state_dict(_state_dict_without_module_prefix(state_dict), strict=True)
        model.eval()
        self._models[key] = model.to(self.device)
        return self._models[key]

    def predict(self, image: Image.Image, model: str = "auto", top_k: int = 5) -> RecognitionResult:
        key = self._resolve_model_key(model)
        classifier = self._load_model(key)
        tensor = self._transforms[key](image.convert("RGB")).unsqueeze(0).to(self.device)
        with torch.no_grad():
            probabilities = torch.softmax(classifier(tensor), dim=1)[0]
            top_probabilities, top_indices = torch.topk(probabilities, k=min(top_k, len(self.class_names)))
        top_predictions = []
        for probability, index in zip(top_probabilities.cpu().tolist(), top_indices.cpu().tolist(), strict=False):
            class_name = self.class_names[int(index)]
            top_predictions.append(
                {
                    "class_name": class_name,
                    "dish_name": _display_name(class_name),
                    "confidence": round(float(probability), 4),
                }
            )
        best = top_predictions[0]
        return RecognitionResult(
            dish_name=str(best["dish_name"]),
            class_name=str(best["class_name"]),
            confidence=float(best["confidence"]),
            model=MODEL_NAMES[key],
            status="ok",
            top_predictions=top_predictions,
        )


def confidence_label(confidence: float) -> str:
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.45:
        return "medium"
    return "low"
