from fastapi import APIRouter

from backend.src.api.alerts import router as alerts_router
from backend.src.api.campaigns import router as campaigns_router
from backend.src.api.db import router as db_router
from backend.src.api.discovery import router as discovery_router
from backend.src.api.export import router as export_router
from backend.src.api.graph import router as graph_router
from backend.src.api.hunt import router as hunt_router
from backend.src.api.jobs import router as jobs_router
from backend.src.api.lab import router as lab_router
from backend.src.api.logs import router as logs_router
from backend.src.api.scan import router as scan_router
from backend.src.api.settings import router as settings_router
from backend.src.api.signatures import router as signatures_router
from backend.src.api.pivot import router as pivot_router
from backend.src.api.urlscan_local import router as urlscan_router
from backend.src.api.ai import router as ai_router
from backend.src.api.iocs import router as iocs_router
from backend.src.api.targets import router as targets_router
from backend.src.api.yara import router as yara_router
from backend.src.api.update import router as update_router

api_router = APIRouter()
api_router.include_router(scan_router)
api_router.include_router(jobs_router)
api_router.include_router(hunt_router)
api_router.include_router(lab_router)
api_router.include_router(graph_router)
api_router.include_router(export_router)
api_router.include_router(settings_router)
api_router.include_router(discovery_router)
api_router.include_router(logs_router)
api_router.include_router(db_router)
api_router.include_router(signatures_router)
api_router.include_router(alerts_router)
api_router.include_router(campaigns_router)
api_router.include_router(pivot_router)
api_router.include_router(urlscan_router)
api_router.include_router(ai_router)
api_router.include_router(iocs_router)
api_router.include_router(targets_router)
api_router.include_router(yara_router)
api_router.include_router(update_router)
