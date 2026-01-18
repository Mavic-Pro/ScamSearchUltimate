import { getLang, tr } from "../i18n";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safeGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, error: json.error?.message || tr("API error", "Errore API", getLang()) };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function safePost<T>(path: string, body: object): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, error: json.error?.message || tr("API error", "Errore API", getLang()) };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function safePut<T>(path: string, body: object): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, error: json.error?.message || tr("API error", "Errore API", getLang()) };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function safeDelete<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();
    if (!json.ok) {
      return { ok: false, error: json.error?.message || tr("API error", "Errore API", getLang()) };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
