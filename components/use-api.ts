"use client";

import { useCallback, useEffect, useState } from "react";

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const body = (await response.json()) as T & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not load this page.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Onyx could not load this page.");
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    if (!url) return;
    let active = true;
    void fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as T & { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not load this page.");
        return body;
      })
      .then((body) => { if (active) setData(body); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Onyx could not load this page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url]);
  return { data, loading, error, refresh, setData };
}

export function formatApiDate(value: string | Date | number) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
