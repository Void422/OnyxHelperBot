"use client";

/* eslint-disable jsx-a11y/label-has-associated-control -- the switch uses an explicit htmlFor/id pair in a compound row. */

import { useEffect, useMemo, useState } from "react";
import { Check, FileClock, Radio, Route } from "lucide-react";
import type { LogCategory, LogChannelMap } from "@/packages/core/src/domain";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { useApi } from "./use-api";

interface LogRecord { guildId: string; channels: LogChannelMap; includeModerator: boolean; retentionDays: number }
interface SettingsResponse { guild: { id: string; name: string } }
interface ResourcesResponse { channels: Array<{ id: string; name: string; type: number }> }

const routes: Array<{ key: LogCategory; label: string; detail: string }> = [
  { key: "moderation", label: "Moderation", detail: "Bans, kicks, timeouts, warnings, and case changes" },
  { key: "automod", label: "Automod", detail: "Matched rules and the action Onyx applied" },
  { key: "messages", label: "Messages", detail: "Edits and deletions, with safe content snapshots" },
  { key: "members", label: "Members", detail: "Joins, departures, and member changes" },
  { key: "server", label: "Server", detail: "Channels and roles created, edited, or removed" },
  { key: "voice", label: "Voice", detail: "Voice channel moves, joins, and leaves" },
  { key: "tickets", label: "Tickets", detail: "Created, claimed, closed, and reopened tickets" },
  { key: "giveaways", label: "Giveaways", detail: "Starts, forced endings, and rerolls" },
];

export function LogsPage({ guildId }: { guildId: string }) {
  const { session } = useSession();
  const logsApi = useApi<{ logs: LogRecord }>(`/api/guilds/${guildId}/logs`);
  const settingsApi = useApi<SettingsResponse>(`/api/guilds/${guildId}/settings`);
  const resourcesApi = useApi<ResourcesResponse>(`/api/guilds/${guildId}/resources`);
  const [draft, setDraft] = useState<LogRecord | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Hydrate the editable copy when the authoritative API record arrives.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (logsApi.data) { const next = structuredClone(logsApi.data.logs); setDraft(next); setSnapshot(JSON.stringify(next)); } }, [logsApi.data]);
  const dirty = useMemo(() => Boolean(draft) && JSON.stringify(draft) !== snapshot, [draft, snapshot]);
  const channels = resourcesApi.data?.channels.filter((channel) => [0, 5].includes(channel.type)) ?? [];
  const routed = draft ? Object.values(draft.channels).filter(Boolean).length : 0;
  const updateRoute = (category: LogCategory, channelId: string) => setDraft((current) => current ? { ...current, channels: { ...current.channels, [category]: channelId || undefined } } : current);
  const save = async () => {
    if (!draft || !session?.csrfToken || !dirty) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/logs`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify({ channels: draft.channels, includeModerator: draft.includeModerator, retentionDays: draft.retentionDays }) });
      const body = await response.json() as { logs?: LogRecord; error?: { message?: string } };
      if (!response.ok || !body.logs) throw new Error(body.error?.message ?? "Onyx could not save the log routes.");
      const next = structuredClone(body.logs); setDraft(next); setSnapshot(JSON.stringify(next)); setMessage({ kind: "success", text: "Log routes saved and available to the bot." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Onyx could not save the log routes." }); }
    finally { setSaving(false); }
  };

  return <DashboardShell guildId={guildId} guildName={settingsApi.data?.guild.name} active="logs">
    <div className="page-heading"><div><span className="page-kicker">Event routing</span><h1>Discord logs</h1><p>Send each class of activity where the right staff can act on it. Leave a route blank to keep it out of Discord.</p></div><div className="heading-stat"><Route size={18} /><span><strong>{routed}</strong> routes active</span></div></div>
    {(logsApi.error || resourcesApi.error) && <div className="error-banner">{logsApi.error || resourcesApi.error}</div>}
    {!draft || logsApi.loading ? <div className="loading-stack">{[0,1,2].map((item) => <div className="skeleton" key={item} />)}</div> : <>
      {message && <div className={message.kind === "success" ? "success-banner" : "error-banner"}>{message.text}</div>}
      <div className="log-layout"><section className="settings-card"><div className="section-title-row"><div><span className="section-index">01</span><h2>Channel map</h2></div><Radio size={18} /></div><div className="log-route-list">{routes.map((route) => { const value = draft.channels[route.key] ?? ""; return <div className={`log-route${value ? " active" : ""}`} key={route.key}><span className="route-light" /><div className="route-copy"><strong>{route.label}</strong><span>{route.detail}</span></div><select aria-label={`${route.label} log channel`} className="select" value={value} onChange={(event) => updateRoute(route.key, event.target.value)}><option value="">Not routed</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div>; })}</div></section><aside className="config-stack"><section className="settings-card"><span className="section-index">02</span><h2>Record policy</h2><p>The private dashboard audit trail remains separate from Discord log messages.</p><label className="switch-row" htmlFor="include-mod"><span><strong>Include moderator identity</strong><small>Show the responsible staff member when Discord provides one.</small></span><input id="include-mod" type="checkbox" checked={draft.includeModerator} onChange={(event) => setDraft({ ...draft, includeModerator: event.target.checked })} /></label><div className="field"><label htmlFor="retention">Dashboard retention</label><select id="retention" className="select" value={draft.retentionDays} onChange={(event) => setDraft({ ...draft, retentionDays: Number(event.target.value) })}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option><option value={730}>2 years</option></select></div></section><div className="route-summary"><FileClock size={20} /><div><strong>One event, one route</strong><span>Onyx never sprays the same log into every channel. Categories stay deliberate.</span></div></div></aside></div>
      <div className="sticky-save-bar"><div><span className={`save-state-dot ${dirty ? "changed" : "saved"}`} /><strong>{dirty ? "Log routing has unsaved changes" : "Log routing is synced"}</strong></div><button className="button primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : <><Check size={15} /> Save log routing</>}</button></div>
    </>}
  </DashboardShell>;
}
