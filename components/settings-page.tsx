"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { guildModules, type GuildSettingsData } from "@/packages/core/src/domain";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { useApi } from "./use-api";

interface SettingsRecord {
  guildId: string;
  enabledModules: (typeof guildModules)[number][];
  staffRoleIds: string[];
  locale: string;
  timezone: string;
  settings: GuildSettingsData;
  onboardingCompleted: boolean;
  version: number;
}

interface SettingsResponse { guild: { id: string; name: string }; settings: SettingsRecord }
interface ResourcesResponse { channels: Array<{ id: string; name: string; type: number }>; roles: Array<{ id: string; name: string; position: number }> }

const moduleCopy: Record<(typeof guildModules)[number], string> = {
  moderation: "Cases, warnings, timeouts, bans, and channel controls",
  logging: "Configurable Discord event and staff action logs",
  automod: "Spam, invite, mention, caps, and phrase protection",
  appeals: "Public submissions and staff review workflow",
  giveaways: "Durable entries and server-side winner selection",
  levels: "XP, ranks, leaderboards, and level rewards",
  tickets: "Private support channels and staff claims",
  welcome: "Join, leave, and direct welcome messages",
  autoroles: "Member and bot role assignment",
  role_menus: "Button, select, and reaction self-roles",
  suggestions: "Voting, staff responses, and statuses",
  starboard: "Community-highlighted messages",
};

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export function SettingsPage({ guildId }: { guildId: string }) {
  const { session } = useSession();
  const settingsApi = useApi<SettingsResponse>(`/api/guilds/${guildId}/settings`);
  const resourcesApi = useApi<ResourcesResponse>(`/api/guilds/${guildId}/resources`);
  const [draft, setDraft] = useState<SettingsRecord | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!settingsApi.data) return;
    const initial = clone(settingsApi.data.settings);
    // This effect intentionally starts a fresh editable draft when the server record arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setSavedSnapshot(JSON.stringify(initial));
  }, [settingsApi.data]);

  const dirty = useMemo(() => Boolean(draft) && JSON.stringify(draft) !== savedSnapshot, [draft, savedSnapshot]);
  const updateSettings = (patch: Partial<GuildSettingsData>) => setDraft((current) => current ? { ...current, settings: { ...current.settings, ...patch } } : current);

  const save = async () => {
    if (!draft || !session?.csrfToken || !dirty) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/settings`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken },
        body: JSON.stringify({ enabledModules: draft.enabledModules, staffRoleIds: draft.staffRoleIds, locale: draft.locale, timezone: draft.timezone, settings: draft.settings }),
      });
      const body = (await response.json()) as { settings?: SettingsRecord; error?: { message?: string } };
      if (!response.ok || !body.settings) throw new Error(body.error?.message ?? "Onyx could not save those settings.");
      const saved = clone(body.settings);
      setDraft(saved); setSavedSnapshot(JSON.stringify(saved)); setMessage({ kind: "success", text: "Settings saved. The bot will pick them up within 30 seconds." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Onyx could not save those settings." });
    } finally { setSaving(false); }
  };

  const toggleModule = (module: (typeof guildModules)[number]) => setDraft((current) => current ? { ...current, enabledModules: current.enabledModules.includes(module) ? current.enabledModules.filter((item) => item !== module) : [...current.enabledModules, module] } : current);
  const toggleRole = (roleId: string) => setDraft((current) => current ? { ...current, staffRoleIds: current.staffRoleIds.includes(roleId) ? current.staffRoleIds.filter((item) => item !== roleId) : [...current.staffRoleIds, roleId].slice(0, 25) } : current);
  const thresholds = draft?.settings.warningThresholds ?? [];
  const setThresholds = (next: GuildSettingsData["warningThresholds"]) => updateSettings({ warningThresholds: next });

  return (
    <DashboardShell guildId={guildId} guildName={settingsApi.data?.guild.name} active="settings">
      <div className="page-heading"><div><h1>Settings</h1><p>Choose what Onyx runs and how it should behave in this server.</p></div></div>
      {settingsApi.error && <div className="error-banner">{settingsApi.error}</div>}
      {settingsApi.loading || !draft ? <div className="loading-stack">{[0,1,2,3].map((item) => <div className="skeleton" key={item} />)}</div> : (
        <div className="settings-layout">
          <div>
            {message && <div className={message.kind === "success" ? "success-banner" : "error-banner"} style={{ marginBottom: 12 }}>{message.text}</div>}
            <section className="settings-card"><h2>Modules</h2><p>Disabled modules stop their related commands and event handlers cleanly.</p><div className="module-toggle-list">{guildModules.map((module) => <label className="module-toggle" aria-label={`Toggle ${module.replace(/_/g, " ")} module`} htmlFor={`module-${module}`} key={module}><input id={`module-${module}`} type="checkbox" checked={draft.enabledModules.includes(module)} onChange={() => toggleModule(module)} /><span><strong>{module.replace(/_/g, " ")}</strong><span>{moduleCopy[module]}</span></span></label>)}</div></section>

            <section className="settings-card"><h2>Server basics</h2><p>Timezone affects scheduled work. Locale is reserved for Discord-facing date and number formatting.</p><div className="form-grid"><div className="field"><label htmlFor="timezone">Timezone</label><input id="timezone" className="input" value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} placeholder="America/Toronto" /></div><div className="field"><label htmlFor="locale">Locale</label><input id="locale" className="input" value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value })} placeholder="en-US" /></div><div className="field"><label htmlFor="modlog">Moderation log channel</label><select id="modlog" className="select" value={draft.settings.moderationLogChannelId ?? ""} onChange={(event) => updateSettings({ moderationLogChannelId: event.target.value || undefined })}><option value="">Not configured</option>{resourcesApi.data?.channels.filter((channel) => [0,5].includes(channel.type)).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select><small>Moderation actions are still stored as cases if no Discord log channel is selected.</small></div><div className="field"><label htmlFor="alerts">Staff alert channel</label><select id="alerts" className="select" value={draft.settings.staffAlertChannelId ?? ""} onChange={(event) => updateSettings({ staffAlertChannelId: event.target.value || undefined })}><option value="">Not configured</option>{resourcesApi.data?.channels.filter((channel) => [0,5].includes(channel.type)).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div></div>{resourcesApi.error && <div className="error-banner" style={{ marginTop: 16 }}>{resourcesApi.error}</div>}</section>

            <section className="settings-card"><h2>Staff roles</h2><p>Members with these roles can be recognized by module workflows. Discord permissions are still checked for every sensitive command.</p>{resourcesApi.data?.roles.length ? <div className="module-toggle-list">{resourcesApi.data.roles.slice(0, 30).map((role) => <label className="module-toggle" aria-label={`Toggle ${role.name} staff role`} htmlFor={`staff-role-${role.id}`} key={role.id}><input id={`staff-role-${role.id}`} type="checkbox" checked={draft.staffRoleIds.includes(role.id)} onChange={() => toggleRole(role.id)} /><span><strong>{role.name}</strong><span>Position {role.position}</span></span></label>)}</div> : <div className="empty-state" style={{ minHeight: 110 }}><span>Role choices appear after the bot can read this server&apos;s roles.</span></div>}</section>

            <section className="settings-card"><h2>Warning escalation</h2><p>Thresholds are optional. Onyx records the warning first, then applies an exact matching threshold if role hierarchy permits it.</p>{thresholds.map((threshold, index) => <div className="form-grid" key={`${index}-${threshold.count}`} style={{ marginBottom: 12 }}><div className="field"><label htmlFor={`threshold-count-${index}`}>Active warnings</label><input id={`threshold-count-${index}`} className="input" type="number" min={1} max={100} value={threshold.count} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, count: Number(event.target.value) } : item))} /></div><div className="field"><label htmlFor={`threshold-action-${index}`}>Action</label><select id={`threshold-action-${index}`} className="select" value={threshold.action} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, action: event.target.value as "timeout" | "kick" | "ban" } : item))}><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option></select></div>{threshold.action === "timeout" && <div className="field"><label htmlFor={`threshold-duration-${index}`}>Timeout minutes</label><input id={`threshold-duration-${index}`} className="input" type="number" min={1} max={40320} value={Math.round((threshold.durationMs ?? 3_600_000) / 60_000)} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, durationMs: Number(event.target.value) * 60_000 } : item))} /></div>}<div className="field" style={{ alignSelf: "end" }}><button className="button danger" type="button" onClick={() => setThresholds(thresholds.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /> Remove threshold</button></div></div>)}<button className="button" type="button" disabled={thresholds.length >= 10} onClick={() => setThresholds([...thresholds, { count: (thresholds.at(-1)?.count ?? 0) + 1, action: "timeout", durationMs: 3_600_000 }])}><Plus size={14} /> Add threshold</button></section>

            <section className="settings-card"><h2>Leveling policy</h2><p>These values shape XP awards. Duplicate and low-signal messages remain excluded regardless of the award range.</p><div className="form-grid"><div className="field"><label htmlFor="cooldown">XP cooldown (seconds)</label><input id="cooldown" className="input" type="number" min={15} max={600} value={draft.settings.xp?.cooldownSeconds ?? 60} onChange={(event) => updateSettings({ xp: { ...draft.settings.xp, cooldownSeconds: Number(event.target.value) } })} /></div><div className="field"><label htmlFor="minimum">Minimum message length</label><input id="minimum" className="input" type="number" min={3} max={200} value={draft.settings.xp?.minimumMessageLength ?? 8} onChange={(event) => updateSettings({ xp: { ...draft.settings.xp, minimumMessageLength: Number(event.target.value) } })} /></div><div className="field"><label htmlFor="minxp">Minimum award</label><input id="minxp" className="input" type="number" min={1} max={100} value={draft.settings.xp?.minAward ?? 10} onChange={(event) => updateSettings({ xp: { ...draft.settings.xp, minAward: Number(event.target.value) } })} /></div><div className="field"><label htmlFor="maxxp">Maximum award</label><input id="maxxp" className="input" type="number" min={1} max={200} value={draft.settings.xp?.maxAward ?? 20} onChange={(event) => updateSettings({ xp: { ...draft.settings.xp, maxAward: Number(event.target.value) } })} /></div></div></section>

            <section className="settings-card"><h2>Welcome message</h2><p>Safe placeholders include {'{user}'}, {'{mention}'}, {'{username}'}, {'{server}'}, and {'{memberCount}'}.</p><div className="field"><label htmlFor="welcome-channel">Welcome channel</label><select id="welcome-channel" className="select" value={draft.settings.welcomeChannelId ?? ""} onChange={(event) => updateSettings({ welcomeChannelId: event.target.value || undefined })}><option value="">Not configured</option>{resourcesApi.data?.channels.filter((channel) => [0,5].includes(channel.type)).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div><div className="field" style={{ marginTop: 16 }}><label htmlFor="welcome-message">Message</label><textarea id="welcome-message" className="textarea" value={draft.settings.welcomeMessage ?? "Welcome {mention} to {server}."} maxLength={2000} onChange={(event) => updateSettings({ welcomeMessage: event.target.value })} /></div></section>
          </div>
          <aside className="save-card"><div className="save-state"><span className={`save-state-dot ${dirty ? "changed" : "saved"}`} />{dirty ? "Unsaved changes" : "Everything is saved"}</div><button className="button primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : <><Check size={15} /> Save settings</>}</button><p>Critical changes are only confirmed after the API accepts them and records an audit event.</p></aside>
        </div>
      )}
    </DashboardShell>
  );
}
