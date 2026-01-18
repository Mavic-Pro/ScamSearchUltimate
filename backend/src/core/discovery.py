from typing import List, Tuple

from backend.src.core.providers.ddg import ddg_search
from backend.src.core.providers.fofa import fofa_search, fofa_search_verbose
from backend.src.core.providers.serpapi import serp_search, serp_search_verbose
from backend.src.core.providers.urlscan import urlscan_search


def discover_targets(conn, keyword: str | None, fofa_query: str | None) -> List[str]:
    urls: List[str] = []
    if fofa_query:
        urls.extend(fofa_search(conn, fofa_query))
    if keyword:
        urls.extend(serp_search(conn, keyword, engine="google"))
        urls.extend(serp_search(conn, keyword, engine="bing"))
        urls.extend(serp_search(conn, keyword, engine="yandex"))
        urls.extend(urlscan_search(conn, keyword))
        urls.extend(ddg_search(keyword))
    deduped = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped[:200]


def discover_targets_verbose(conn, keyword: str | None, fofa_query: str | None) -> Tuple[List[str], List[str]]:
    urls: List[str] = []
    warnings: List[str] = []
    if fofa_query:
        fofa_urls, fofa_err = fofa_search_verbose(conn, fofa_query)
        if fofa_err:
            warnings.append(fofa_err)
        urls.extend(fofa_urls)
    if keyword:
        serp_google, err_g = serp_search_verbose(conn, keyword, engine="google")
        serp_bing, err_b = serp_search_verbose(conn, keyword, engine="bing")
        serp_yandex, err_y = serp_search_verbose(conn, keyword, engine="yandex")
        urls.extend(serp_google)
        urls.extend(serp_bing)
        urls.extend(serp_yandex)
        urls.extend(urlscan_search(conn, keyword))
        urls.extend(ddg_search(keyword))
        for err in (err_g, err_b, err_y):
            if err and err not in warnings:
                warnings.append(err)
    deduped = []
    seen = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped[:200], warnings
