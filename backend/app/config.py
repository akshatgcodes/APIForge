from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./apiforge.db"
    app_password: str = ""
    session_secret: str = "dev-insecure-secret"
    frontend_url: str = "http://localhost:5173"
    # True when frontend and API live on different domains: the session cookie then
    # needs SameSite=None; Secure
    cross_site_cookies: bool = False
    # Off by default: a deployed proxy that can reach localhost is an SSRF hole
    allow_private_targets: bool = False
    proxy_timeout: float = 30.0
    public_api_url: str = "http://localhost:8000"


settings = Settings()
