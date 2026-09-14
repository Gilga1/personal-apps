from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    vision_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("VISION_API_KEY", "NVIDIA_API_KEY", "OPENAI_API_KEY"),
    )

    vision_model: str = Field(
        default="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        validation_alias=AliasChoices("VISION_MODEL", "OPENAI_MODEL"),
    )
    vision_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        validation_alias=AliasChoices("VISION_BASE_URL", "OPENAI_BASE_URL"),
    )
    vision_enable_thinking: bool = Field(
        default=False,
        validation_alias="VISION_ENABLE_THINKING",
    )

    cors_origins: str = "*"
    host: str = "0.0.0.0"
    port: int = 8000
    max_upload_mb: int = 10

    notion_api_key: str = Field(default="", validation_alias="NOTION_API_KEY")
    notion_meals_database_id: str = Field(
        default="45a56aaa1c6a441ab6f82b01ac9ca2b7",
        validation_alias="NOTION_MEALS_DATABASE_ID",
    )

    @property
    def vision_configured(self) -> bool:
        return bool(self.vision_api_key.strip())

    @property
    def notion_configured(self) -> bool:
        return bool(self.notion_api_key.strip() and self.notion_meals_database_id.strip())

    @property
    def is_nemotron(self) -> bool:
        return "nemotron" in self.vision_model.lower()

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
