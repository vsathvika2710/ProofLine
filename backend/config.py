import os
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    app_name: str = "Proofline"
    version: str = "2.0.0"
    app_env: str = os.getenv("APP_ENV", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    cors_allowed_origins: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
            if os.getenv("APP_ENV", "development").strip().lower() in {"development", "dev", "local"}
            else "",
        ).split(",")
        if origin.strip()
    ]
    
    # Supabase & DB
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    database_url: str = os.getenv("DATABASE_URL", "")
    enable_evaluation_access: bool = os.getenv("ENABLE_EVALUATION_ACCESS", "true").strip().lower() in {"1", "true", "yes", "on"}
    
    # Gemini AI
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    gemini_embedding_model: str = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
    
    # Confidentiality and Disclosure Notice
    ai_service_disclosure: str = (
        "CONFIDENTIALITY NOTICE: Pre-publication claims and evidence text are sent to "
        "an external AI service (Google Gemini). Confidential brand facts are verified "
        "via grounded exact citations; no data is retained for AI training."
    )
    
    @property
    def has_gemini_key(self) -> bool:
        return bool(self.gemini_api_key and len(self.gemini_api_key.strip()) > 5)

settings = Settings()
