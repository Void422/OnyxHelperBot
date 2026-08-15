"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuildSettingsData, GuildModule } from "@/packages/core/src/domain";
import { useSession } from "./session-context";
import { useApi } from "./use-api";

export interface GuildSettingsRecord {
  guildId: string;
  enabledModules: GuildModule[];
  staffRoleIds: string[];
  locale: string;
  timezone: string;
  settings: GuildSettingsData;
  onboardingCompleted: boolean;
  version: number;
}

interface SettingsResponse { guild: { id: string; name: string }; settings: GuildSettingsRecord }
export interface GuildResources { channels: Array<{ id: string; name: string; type: number; position?: number }>; roles: Array<{ id: string; name: string; position: number }> }

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function useGuildSettings(guildId: string) {
  const { session } = useSession();
  const settingsApi = useApi<SettingsResponse>(`/api/guilds/${guildId}/settings`);
  const resourcesApi = useApi<GuildResources>(`/api/guilds/${guildId}/resources`);
  const [draft, setDraft] = useState<GuildSettingsRecord | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!settingsApi.data) return;
    const initial = clone(settingsApi.data.settings);
    // A guild change replaces the editable working copy with the server record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setSavedSnapshot(JSON.stringify(initial));
  }, [settingsApi.data]);

  const dirty = useMemo(() => Boolean(draft) && JSON.stringify(draft) !== savedSnapshot, [draft, savedSnapshot]);
  const updateSettings = (updater: (settings: GuildSettingsData) => GuildSettingsData) => setDraft((current) => current ? { ...current, settings: updater(current.settings) } : current);

  const save = async () => {
    if (!draft || !session?.csrfToken || !dirty) return false;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/settings`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken },
        body: JSON.stringify({ enabledModules: draft.enabledModules, staffRoleIds: draft.staffRoleIds, locale: draft.locale, timezone: draft.timezone, settings: draft.settings }),
      });
      const body = await response.json() as { settings?: GuildSettingsRecord; error?: { message?: string } };
      if (!response.ok || !body.settings) throw new Error(body.error?.message ?? "Onyx could not save those settings.");
      const saved = clone(body.settings);
      setDraft(saved);
      setSavedSnapshot(JSON.stringify(saved));
      setMessage({ kind: "success", text: "Saved. The bot will use the new configuration within 30 seconds." });
      return true;
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Onyx could not save those settings." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    draft,
    setDraft,
    updateSettings,
    dirty,
    saving,
    save,
    message,
    guildName: settingsApi.data?.guild.name,
    loading: settingsApi.loading || !draft,
    error: settingsApi.error,
    resources: resourcesApi.data,
    resourcesError: resourcesApi.error,
  };
}
