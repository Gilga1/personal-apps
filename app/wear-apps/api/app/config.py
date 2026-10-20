from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parents[1]
_APP_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(_APP_DIR / ".env"),
            str(_API_DIR / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    device_api_token: str = Field(default="", validation_alias="DEVICE_API_TOKEN")

    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    )
    gemini_model: str = Field(default="gemini-2.5-flash", validation_alias="GEMINI_MODEL")

    notion_api_key: str = Field(default="", validation_alias="NOTION_API_KEY")
    notion_habit_tracker_database_id: str = Field(
        default="d5ed17f21d704755b028066c8e8d93e2",
        validation_alias="NOTION_HABIT_TRACKER_DATABASE_ID",
    )
    notion_habit_tracker_data_source_id: str = Field(
        default="bd13c6c6-ca63-4ac6-8d55-75ac013b278b",
        validation_alias="NOTION_HABIT_TRACKER_DATA_SOURCE_ID",
    )

    database_url: str = Field(default="", validation_alias="DATABASE_URL")
    timezone: str = Field(default="Asia/Kolkata", validation_alias="TIMEZONE")
    cors_origins: str = "*"
    host: str = "0.0.0.0"
    port: int = 8001

    default_glass_ml: int = Field(default=250, validation_alias="DEFAULT_GLASS_ML")
    auto_create_daily_row: bool = Field(default=True, validation_alias="AUTO_CREATE_DAILY_ROW")
    confirmation_threshold: float = Field(default=0.75, validation_alias="CONFIRMATION_THRESHOLD")
    auto_accept_threshold: float = Field(default=0.95, validation_alias="AUTO_ACCEPT_THRESHOLD")

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def notion_configured(self) -> bool:
        return bool(
            self.notion_api_key.strip() and self.notion_habit_tracker_database_id.strip()
        )

    @property
    def auth_configured(self) -> bool:
        return bool(self.device_api_token.strip())

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url.strip():
            return self.database_url.strip()
        db_path = _API_DIR / "data" / "events.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{db_path.as_posix()}"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
