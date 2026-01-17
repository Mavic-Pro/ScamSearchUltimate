from typing import List

from backend.src.core.providers.ddg import ddg_search
from backend.src.core.providers.fofa import fofa_search
from backend.src.core.providers.serpapi import serp_search
from backend.src.core.providers.urlscan import urlscan_search


def discover_targets(conn, keyword: str | None, fofa_query: str | None) -> List[str]:
    urls: List[str] = []
    if fofa_query:
        urls.extend(fofa_search(conn, fofa_query))
        urls.extend(urlscan_search(conn, fofa_query))
    if keyword:
        urls.extend(serp_search(conn, keyword, engine="google"))
        urls.extend(serp_search(conn, keyword, engine="bing"))
        urls.extend(serp_search(conn, keyword, engine="yandex"))
        urls.extend(ddg_search(keyword))
    deduped = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped[:200]
