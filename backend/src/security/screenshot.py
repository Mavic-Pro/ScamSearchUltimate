import os
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

from PIL import Image
import imagehash
from PIL import ImageDraw


@dataclass
class ScreenshotResult:
    status: str
    path: Optional[str]
    ahash: Optional[str]
    phash: Optional[str]
    dhash: Optional[str]
    reason: Optional[str]


def capture_screenshot(url: str, target_id: int, storage_dir: str = "storage/screenshots") -> ScreenshotResult:
    if os.getenv("PLAYWRIGHT_ENABLED", "1") != "1":
        return ScreenshotResult("SKIPPED", None, None, None, None, "playwright_disabled")

    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        return ScreenshotResult("SKIPPED", None, None, None, None, f"playwright_missing:{exc}")

    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, f"target_{target_id}.png")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.set_default_timeout(8000)
            page.goto(url, wait_until="domcontentloaded")
            image_bytes = page.screenshot(full_page=True)
            browser.close()
    except Exception as exc:
        return _placeholder(target_id, storage_dir, f"capture_failed: {exc}")

    try:
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        img = Image.open(BytesIO(image_bytes))
        ahash = str(imagehash.average_hash(img))
        phash = str(imagehash.phash(img))
        dhash = str(imagehash.dhash(img))
        return ScreenshotResult("DONE", file_path, ahash, phash, dhash, None)
    except Exception as exc:
        return _placeholder(target_id, storage_dir, f"hash_error:{exc}")


def _placeholder(target_id: int, storage_dir: str, reason: str) -> ScreenshotResult:
    os.makedirs(storage_dir, exist_ok=True)
    file_path = os.path.join(storage_dir, f"target_{target_id}.png")
    img = Image.new("RGB", (800, 450), color=(20, 22, 28))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Screenshot unavailable", fill=(220, 220, 220))
    draw.text((20, 60), reason[:200], fill=(180, 180, 180))
    buf = BytesIO()
    img.save(buf, format="PNG")
    image_bytes = buf.getvalue()
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    ahash = str(imagehash.average_hash(img))
    phash = str(imagehash.phash(img))
    dhash = str(imagehash.dhash(img))
    return ScreenshotResult("FAILED", file_path, ahash, phash, dhash, reason)
