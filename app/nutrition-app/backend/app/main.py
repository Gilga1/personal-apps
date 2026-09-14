from __future__ import annotations

import io
import json
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from .config import get_settings
from .notion_client import NotionMealLogger
from .food_lookup import FoodLookupService
from .schemas import (
    FoodLookupRequest,
    FoodLookupResponse,
    HealthResponse,
    MealDecomposeRequest,
    MealDecomposeResponse,
    MealEstimate,
    MealType,
    NotionLogRequest,
    UserProfile,
)
from .vision import VisionEstimator

_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
MEAL_TYPES: set[str] = {"Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.estimator = None
    app.state.notion = None
    app.state.food_lookup = FoodLookupService(settings)
    if settings.vision_configured:
        app.state.estimator = VisionEstimator(settings)
    if settings.notion_configured:
        app.state.notion = NotionMealLogger(settings)
    yield


app = FastAPI(
    title="North Indian Meal Calorie Estimator",
    version="0.2.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    s = app.state.settings
    return HealthResponse(
        status="ok",
        model=s.vision_model,
        vision_configured=s.vision_configured,
        notion_configured=s.notion_configured,
    )


@app.post("/api/estimate", response_model=MealEstimate)
async def estimate_meal(
    file: UploadFile = File(...),
    meal_type: str = Form(default="Lunch"),
    profile_json: str = Form(default=""),
    save_to_notion: bool = Form(default=True),
    meal_correction: str = Form(default=""),
) -> MealEstimate:
    settings = app.state.settings
    estimator: VisionEstimator | None = app.state.estimator
    notion: NotionMealLogger | None = app.state.notion

    if estimator is None:
        raise HTTPException(
            status_code=503,
            detail="Vision API not configured. Set NVIDIA_API_KEY in .env and restart.",
        )

    if meal_type not in MEAL_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid meal_type. Use one of: {', '.join(sorted(MEAL_TYPES))}",
        )

    profile: UserProfile | None = None
    if profile_json.strip():
        try:
            profile = UserProfile.model_validate(json.loads(profile_json))
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid profile_json: {exc}") from exc

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Use JPG, PNG, or WEBP.",
        )

    raw = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(raw) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large. Max {settings.max_upload_mb} MB.",
        )
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload.")

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.verify()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file.") from exc

    mime = content_type if content_type != "image/jpg" else "image/jpeg"

    try:
        result = estimator.estimate(
            raw,
            mime,
            profile=profile,
            meal_type=meal_type,  # type: ignore[arg-type]
            meal_correction=meal_correction.strip() or None,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Vision estimation failed: {exc}",
        ) from exc

    if save_to_notion and notion is not None:
        try:
            result.notion_page_url = notion.log_meal(result, meal_type=meal_type)  # type: ignore[arg-type]
        except Exception as exc:  # noqa: BLE001 — don't fail estimate if Notion fails
            result.assumptions = [
                *result.assumptions,
                f"Notion save failed: {exc}",
            ]

    return result


@app.post("/api/notion/log")
def log_meal_to_notion(body: NotionLogRequest) -> dict[str, str]:
    notion: NotionMealLogger | None = app.state.notion
    if notion is None:
        raise HTTPException(
            status_code=503,
            detail="Notion not configured. Set NOTION_API_KEY in .env.",
        )
    try:
        url = notion.log_meal(body.estimate, meal_type=body.meal_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Notion save failed: {exc}") from exc
    return {"notion_page_url": url}


@app.post("/api/food/lookup", response_model=FoodLookupResponse)
def lookup_food(body: FoodLookupRequest) -> FoodLookupResponse:
    service: FoodLookupService = app.state.food_lookup
    try:
        return service.lookup(body)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Food lookup failed: {exc}") from exc


@app.post("/api/meal/decompose", response_model=MealDecomposeResponse)
def decompose_meal(body: MealDecomposeRequest) -> MealDecomposeResponse:
    service: FoodLookupService = app.state.food_lookup
    try:
        return service.decompose_meal(body)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Meal decomposition failed: {exc}") from exc
