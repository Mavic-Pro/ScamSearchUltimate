from typing import List

import requests
from bs4 import BeautifulSoup

from backend.src.utils.logging import log_error


def ddg_search(query: str) -> List[str]:
    try:
        resp = requests.post(
            "https://duckduckgo.com/html/",
            data={"q": query},
            timeout=8,
            headers={"User-Agent": "ScamHunter/1.0"},
        )
        soup = BeautifulSoup(resp.text, "html.parser")
        links = []
        for a in soup.select("a.result__a"):
            href = a.get("href")
            if href:
                links.append(href)
        return links
    except Exception as exc:
        log_error("DDG search failed", str(exc))
        return []
