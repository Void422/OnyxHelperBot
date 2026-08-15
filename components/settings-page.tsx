"use client";

import { Check, CircleGauge, Globe2, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { availableGuildModules, type GuildModule, type GuildSettingsData } from "@/packages/core/src/domain";
import { DashboardShell } from "./dashboard-shell";
import { useGuildSettings } from "./use-guild-settings";

const moduleCopy: Record<GuildModule, string> = {
  moderation: "Cases, warnings, timeouts, bans, notes, and history",
  logging: "Routed Discord events and durable dashboard history",
  automod: "Nine configurable filters with escalating actions",
  appeals: "Public submissions and staff decisions",
  giveaways: "Weighted entries, rerolls, pause, and scheduled endings",
  levels: "XP policy, rewards, ranks, and leaderboards",
  tickets: "Private channels, claims, participants, and transcripts",
  welcome: "Channel, goodbye, and direct welcome messages",
  autoroles: "Delayed human and bot role assignment",
  role_menus: "Self-assignable roles",
  suggestions: "Voting, discussion threads, and staff statuses",
  starboard: "Reaction-based community highlights",
};

export function SettingsPage({ guildId }: { guildId: string }) {
  const state = useGuildSettings(guildId);
  const draft = state.draft;
  const updateSettings = (patch: Partial<GuildSettingsData>) => state.updateSettings((settings) => ({ ...settings, ...patch }));
  const toggleModule = (module: GuildModule) => state.setDraft((current) => current ? { ...current, enabledModules: current.enabledModules.includes(module) ? current.enabledModules.filter((item) => item !== module) : [...current.enabledModules, module] } : current);
  const toggleRole = (roleId: string) => state.setDraft((current) => current ? { ...current, staffRoleIds: current.staffRoleIds.includes(roleId) ? current.staffRoleIds.filter((item) => item !== roleId) : [...current.staffRoleIds, roleId].slice(0, 25) } : current);
  const thresholds = draft?.settings.warningThresholds ?? [];
  const setThresholds = (next: GuildSettingsData["warningThresholds"]) => updateSettings({ warningThresholds: next });

  return <DashboardShell guildId={guildId} guildName={state.guildName} active="settings">
    <div className="page-heading"><div><span className="page-kicker">Server foundation</span><h1>Server settings</h1><p>Control Onyx at the workspace level. Feature-specific tuning now lives in its own section.</p></div><div className="heading-stat"><SlidersHorizontal size={18} /><span><strong>{draft?.enabledModules.length ?? 0}</strong> modules active</span></div></div>
    {state.error && <div className="error-banner">{state.error}</div>}
    {state.loading || !draft ? <div className="loading-stack">{[0,1,2].map((item) => <div className="skeleton" key={item} />)}</div> : <>
      {state.message && <div className={state.message.kind === "success" ? "success-banner" : "error-banner"}>{state.message.text}</div>}
      <div className="settings-columns">
        <div className="config-stack">
          <section className="settings-card"><div className="section-title-row"><div><span className="section-index">01</span><h2>Installed modules</h2></div><CircleGauge size={18} /></div><p>Every module shown here has a runtime path. Turning one off blocks its commands and event handlers.</p><div className="module-grid">{availableGuildModules.map((module) => { const enabled = draft.enabledModules.includes(module); return <button type="button" className={`module-card${enabled ? " enabled" : ""}`} key={module} onClick={() => toggleModule(module)}><span className="module-state">{enabled ? "ON" : "OFF"}</span><strong>{module.replace(/_/g, " ")}</strong><span>{moduleCopy[module]}</span><span className="module-check">{enabled && <Check size={13} />}</span></button>; })}</div></section>

          <section className="settings-card"><div className="section-title-row"><div><span className="section-index">02</span><h2>Staff authority</h2></div><ShieldCheck size={18} /></div><p>Workflow access uses these roles, while every sensitive action still checks Discord permissions and hierarchy.</p><div className="role-picker">{state.resources?.roles.slice(0, 40).map((role) => { const checked = draft.staffRoleIds.includes(role.id); return <label className={`role-choice${checked ? " selected" : ""}`} key={role.id} htmlFor={`staff-role-${role.id}`}><input id={`staff-role-${role.id}`} type="checkbox" checked={checked} onChange={() => toggleRole(role.id)} /><span className="role-dot" /><span>{role.name}</span>{checked && <Check size={14} />}</label>; })}</div></section>

          <section className="settings-card"><div className="section-title-row"><div><span className="section-index">03</span><h2>Warning escalation</h2></div><ShieldCheck size={18} /></div><p>Onyx records the warning first, then applies an exact matching threshold when hierarchy permits it.</p>{thresholds.map((threshold, index) => <div className="threshold-row" key={`${threshold.count}-${index}`}><div className="field"><label htmlFor={`threshold-count-${index}`}>Warnings</label><input id={`threshold-count-${index}`} className="input" type="number" min={1} max={100} value={threshold.count} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, count: Number(event.target.value) } : item))} /></div><div className="field"><label htmlFor={`threshold-action-${index}`}>Action</label><select id={`threshold-action-${index}`} className="select" value={threshold.action} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, action: event.target.value as "timeout" | "kick" | "ban" } : item))}><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Ban</option></select></div>{threshold.action === "timeout" && <div className="field"><label htmlFor={`threshold-duration-${index}`}>Minutes</label><input id={`threshold-duration-${index}`} className="input" type="number" min={1} max={40320} value={Math.round((threshold.durationMs ?? 3_600_000) / 60_000)} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? { ...item, durationMs: Number(event.target.value) * 60_000 } : item))} /></div>}<button className="icon-button danger-icon" type="button" aria-label="Remove threshold" onClick={() => setThresholds(thresholds.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>)}<button className="button" type="button" disabled={thresholds.length >= 10} onClick={() => setThresholds([...thresholds, { count: (thresholds.at(-1)?.count ?? 0) + 1, action: "timeout", durationMs: 3_600_000 }])}>Add escalation threshold</button></section>
        </div>

        <aside className="config-stack"><section className="settings-card"><div className="section-title-row"><div><span className="section-index">04</span><h2>Locale & time</h2></div><Globe2 size={18} /></div><p>Scheduled jobs use the server timezone. Dates and numbers use the locale.</p><div className="field"><label htmlFor="timezone">IANA timezone</label><input id="timezone" className="input" value={draft.timezone} onChange={(event) => state.setDraft({ ...draft, timezone: event.target.value })} placeholder="America/Toronto" /></div><div className="field"><label htmlFor="locale">Locale</label><input id="locale" className="input" value={draft.locale} onChange={(event) => state.setDraft({ ...draft, locale: event.target.value })} placeholder="en-CA" /></div><div className="field"><label htmlFor="staff-alerts">Staff alert channel</label><select id="staff-alerts" className="select" value={draft.settings.staffAlertChannelId ?? ""} onChange={(event) => updateSettings({ staffAlertChannelId: event.target.value || undefined })}><option value="">No alert channel</option>{state.resources?.channels.filter((channel) => [0,5].includes(channel.type)).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div></section>
        <section className="settings-card"><span className="section-index">05</span><h2>Discord presence</h2><p>Rotate short status messages so members can discover useful commands.</p><div className="form-grid"><div className="field"><label htmlFor="presence-status">Status</label><select id="presence-status" className="select" value={draft.settings.presence?.status ?? "online"} onChange={(event) => updateSettings({ presence: { ...draft.settings.presence, status: event.target.value as "online" | "idle" | "dnd" } })}><option value="online">Online</option><option value="idle">Idle</option><option value="dnd">Do not disturb</option></select></div><div className="field"><label htmlFor="activity-type">Activity</label><select id="activity-type" className="select" value={draft.settings.presence?.activityType ?? "Watching"} onChange={(event) => updateSettings({ presence: { ...draft.settings.presence, activityType: event.target.value as "Playing" | "Watching" | "Listening" | "Competing" } })}><option>Playing</option><option>Watching</option><option>Listening</option><option>Competing</option></select></div></div><div className="field"><label htmlFor="presence-messages">Rotating messages</label><textarea id="presence-messages" className="textarea compact" value={(draft.settings.presence?.messages ?? ["/help · built for your community"]).join("\n")} onChange={(event) => updateSettings({ presence: { ...draft.settings.presence, messages: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 10) } })} /><small>One message per line, up to ten.</small></div></section></aside>
      </div>
      <div className="sticky-save-bar"><div><span className={`save-state-dot ${state.dirty ? "changed" : "saved"}`} /><strong>{state.dirty ? "Server settings have unsaved changes" : "Server settings are synced"}</strong></div><button className="button primary" onClick={() => void state.save()} disabled={!state.dirty || state.saving}>{state.saving ? "Saving…" : <><Check size={15} /> Save server settings</>}</button></div>
    </>}
  </DashboardShell>;
}
