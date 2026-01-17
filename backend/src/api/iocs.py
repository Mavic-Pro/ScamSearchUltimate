from fastapi import APIRouter, Query, Response
from pydantic import BaseModel

from backend.src.db.connection import connect, load_db_config
from backend.src.db.dao.iocs import create_ioc, list_iocs, list_iocs_filtered
from backend.src.core.settings import get_setting_value
from backend.src.utils.api import fail, ok
import csv
import io
import json
from datetime import datetime
import uuid
import requests

router = APIRouter(prefix="/api/iocs", tags=["iocs"])


class IocRequest(BaseModel):
    kind: str
    value: str
    target_id: int | None = None
    url: str | None = None
    domain: str | None = None
    source: str | None = None
    note: str | None = None


@router.post("")
def add_ioc(req: IocRequest):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        ioc_id = create_ioc(
            conn,
            req.kind,
            req.value,
            req.target_id,
            req.url,
            req.domain,
            req.source,
            req.note,
        )
        return ok({"id": ioc_id})
    finally:
        conn.close()


@router.get("")
def get_iocs(
    kind: str | None = None,
    value: str | None = None,
    domain: str | None = None,
    url: str | None = None,
    source: str | None = None,
    target_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 200,
):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        items = list_iocs_filtered(conn, kind, value, domain, url, source, target_id, date_from, date_to, limit)
        return ok(items)
    finally:
        conn.close()


def _stix_pattern(kind: str, value: str) -> str:
    k = kind.lower()
    if k in {"md5", "sha256"}:
        algo = "MD5" if k == "md5" else "SHA-256"
        return f"[file:hashes.'{algo}' = '{value}']"
    if k in {"url"}:
        return f"[url:value = '{value}']"
    if k in {"domain", "domain_name"}:
        return f"[domain-name:value = '{value}']"
    return f"[x-scamhunter:hash = '{value}']"


def _export_stix(items: list[dict]) -> dict:
    objects = []
    now = datetime.utcnow().isoformat() + "Z"
    for item in items:
        pattern = _stix_pattern(str(item.get("kind", "")), str(item.get("value", "")))
        objects.append(
            {
                "type": "indicator",
                "spec_version": "2.1",
                "id": f"indicator--{uuid.uuid4()}",
                "created": now,
                "modified": now,
                "name": f"IOC {item.get('kind')}",
                "pattern_type": "stix",
                "pattern": pattern,
                "valid_from": now,
            }
        )
    return {"type": "bundle", "id": f"bundle--{uuid.uuid4()}", "objects": objects}


def _export_openioc(items: list[dict]) -> str:
    lines = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<OpenIOC xmlns=\"http://schemas.mandiant.com/2010/ioc\" id=\"\" last-modified=\"\">",
        "  <definition>",
        "    <Indicator operator=\"OR\">",
    ]
    for item in items:
        kind = str(item.get("kind", ""))
        value = str(item.get("value", ""))
        lines.append(
            "      <IndicatorItem condition=\"is\">"
            f"<Context document=\"PortItem\" search=\"{kind}\"/>"
            f"<Content type=\"string\">{value}</Content>"
            "</IndicatorItem>"
        )
    lines.append("    </Indicator>")
    lines.append("  </definition>")
    lines.append("</OpenIOC>")
    return "\n".join(lines)


def _export_misp(items: list[dict]) -> dict:
    attrs = []
    for item in items:
        attrs.append(
            {
                "type": "other",
                "value": str(item.get("value", "")),
                "comment": f"kind={item.get('kind')} domain={item.get('domain')} url={item.get('url')}",
            }
        )
    return {
        "Event": {
            "info": "ScamHunter IOC Export",
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "Attribute": attrs,
        }
    }


@router.get("/export")
def export_iocs(
    format: str = Query("csv", pattern="^(csv|json|stix|openioc|misp)$"),
    kind: str | None = None,
    value: str | None = None,
    domain: str | None = None,
    url: str | None = None,
    source: str | None = None,
    target_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 1000,
):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        items = list_iocs_filtered(conn, kind, value, domain, url, source, target_id, date_from, date_to, limit)
        if format == "json":
            return Response(content=json.dumps(items), media_type="application/json")
        if format == "stix":
            return Response(content=json.dumps(_export_stix(items)), media_type="application/json")
        if format == "openioc":
            return Response(content=_export_openioc(items), media_type="application/xml")
        if format == "misp":
            return Response(content=json.dumps(_export_misp(items)), media_type="application/json")
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "kind", "value", "target_id", "domain", "url", "source", "note", "created_at"])
        for item in items:
            writer.writerow(
                [
                    item.get("id"),
                    item.get("kind"),
                    item.get("value"),
                    item.get("target_id"),
                    item.get("domain"),
                    item.get("url"),
                    item.get("source"),
                    item.get("note"),
                    item.get("created_at"),
                ]
            )
        return Response(content=output.getvalue(), media_type="text/csv")
    finally:
        conn.close()


@router.post("/taxii/push")
def taxii_push(
    kind: str | None = None,
    value: str | None = None,
    domain: str | None = None,
    url: str | None = None,
    source: str | None = None,
    target_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 1000,
):
    cfg = load_db_config()
    conn = connect(cfg)
    try:
        taxii_url = get_setting_value(conn, "TAXII_URL")
        taxii_collection = get_setting_value(conn, "TAXII_COLLECTION")
        taxii_key = get_setting_value(conn, "TAXII_API_KEY")
        if not taxii_url or not taxii_collection:
            return fail("TAXII_URL o TAXII_COLLECTION mancanti")
        items = list_iocs_filtered(conn, kind, value, domain, url, source, target_id, date_from, date_to, limit)
        bundle = _export_stix(items)
        headers = {"Content-Type": "application/taxii+json;version=2.1"}
        if taxii_key:
            headers["Authorization"] = f"Bearer {taxii_key}"
        endpoint = taxii_url.rstrip("/") + f"/collections/{taxii_collection}/objects/"
        try:
            resp = requests.post(endpoint, json=bundle, headers=headers, timeout=20)
            if resp.status_code >= 400:
                return fail("TAXII push failed", f"HTTP {resp.status_code}")
        except Exception as exc:
            return fail("TAXII push failed", str(exc))
        return ok({"pushed": len(items), "endpoint": endpoint})
    finally:
        conn.close()
