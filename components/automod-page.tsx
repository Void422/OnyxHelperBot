"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronRight, ShieldCheck } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { useApi } from "./use-api";
import { useGuildSettings } from "./use-guild-settings";

type RuleKind = "spam" | "mentions" | "invites" | "links" | "caps" | "duplicate" | "blocked_words" | "blocked_domains" | "new_account";
interface Rule { id?: string; kind: RuleKind; enabled: boolean; conditions: { threshold?: number; intervalSeconds?: number; minimumAccountAgeDays?: number; percentage?: number; values?: string[]; timeoutSeconds?: number }; actions: string[]; exemptRoleIds: string[]; exemptChannelIds: string[] }
interface Response { rules: Rule[] }

const definitions: Array<{ kind: RuleKind; label: string; summary: string; defaults: Rule["conditions"] }> = [
  { kind: "spam", label: "Message flood", summary: "Catch bursts of messages inside a short window.", defaults: { threshold: 6, intervalSeconds: 8, timeoutSeconds: 600 } },
  { kind: "duplicate", label: "Repeated messages", summary: "Stop members from repeating the same text.", defaults: { threshold: 3, timeoutSeconds: 600 } },
  { kind: "mentions", label: "Mention spam", summary: "Limit user and role mentions in one message.", defaults: { threshold: 5, timeoutSeconds: 900 } },
  { kind: "invites", label: "Discord invites", summary: "Block unapproved Discord invite links.", defaults: {} },
  { kind: "links", label: "External links", summary: "Block messages containing web links.", defaults: {} },
  { kind: "caps", label: "Excessive caps", summary: "Act on long messages dominated by capital letters.", defaults: { percentage: 75 } },
  { kind: "blocked_words", label: "Blocked phrases", summary: "Match a curated list of words or phrases.", defaults: { values: [] } },
  { kind: "blocked_domains", label: "Blocked domains", summary: "Stop links to specific domains.", defaults: { values: [] } },
  { kind: "new_account", label: "New-account links", summary: "Stop very new accounts from posting links.", defaults: { minimumAccountAgeDays: 3, timeoutSeconds: 600 } },
];

function completeRules(saved: Rule[]): Rule[] {
  return definitions.map((definition) => saved.find((rule) => rule.kind === definition.kind) ?? { kind: definition.kind, enabled: false, conditions: definition.defaults, actions: ["delete", "notify"], exemptRoleIds: [], exemptChannelIds: [] });
}

export function AutomodPage({ guildId }: { guildId: string }) {
  const { session } = useSession();
  const guild = useGuildSettings(guildId);
  const api = useApi<Response>(`/api/guilds/${guildId}/automod`);
  const [rules, setRules] = useState<Rule[]>([]);
  const [snapshot, setSnapshot] = useState("");
  const [selected, setSelected] = useState<RuleKind>("spam");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  useEffect(() => {
    if (!api.data) return;
    const next = completeRules(api.data.rules);
    // Replace the editor with the authoritative server rules when they arrive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRules(next); setSnapshot(JSON.stringify(next));
  }, [api.data]);
  const dirty = JSON.stringify(rules) !== snapshot;
  const active = rules.find((rule) => rule.kind === selected);
  const definition = definitions.find((item) => item.kind === selected)!;
  const update = (patch: Partial<Rule>) => setRules((current) => current.map((rule) => rule.kind === selected ? { ...rule, ...patch } : rule));
  const updateConditions = (patch: Partial<Rule["conditions"]>) => active && update({ conditions: { ...active.conditions, ...patch } });
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const textChannels = guild.resources?.channels.filter((channel) => [0,5].includes(channel.type)) ?? [];
  const save = async () => {
    if (!session?.csrfToken || !dirty) return;
    setSaving(true); setMessage({});
    try {
      const response = await fetch(`/api/guilds/${guildId}/automod`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify({ rules }) });
      const body = await response.json() as Response & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not save the automod rules.");
      const next = completeRules(body.rules); setRules(next); setSnapshot(JSON.stringify(next)); setMessage({ success: "Automod rules saved. New messages will use them within 30 seconds." });
    } catch (error) { setMessage({ error: error instanceof Error ? error.message : "Onyx could not save the automod rules." }); }
    finally { setSaving(false); }
  };
  const toggleValue = (field: "exemptRoleIds" | "exemptChannelIds", value: string) => active && update({ [field]: active[field].includes(value) ? active[field].filter((item) => item !== value) : [...active[field], value] });
  const actionChoices = ["delete", "warn", "timeout", "kick", "ban", "notify"];

  return <DashboardShell guildId={guildId} guildName={guild.guildName} active="automod">
    <div className="page-heading"><div><div className="page-kicker"><ShieldCheck size={14} /> Safety controls</div><h1>Automod with a dimmer switch.</h1><p>Start measured, define exact thresholds and exemptions, then choose the least disruptive action that solves the problem.</p></div><div className="heading-stat"><strong>{enabledCount}</strong><span>rules enabled</span></div></div>
    {(api.error || guild.error || message.error) && <div className="error-banner">{message.error ?? api.error ?? guild.error}</div>}
    {message.success && <div className="success-banner">{message.success}</div>}
    {!active ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : <div className="automod-layout">
      <aside className="rule-rail">{definitions.map((item) => { const rule = rules.find((candidate) => candidate.kind === item.kind); return <button type="button" className={`rule-nav${selected === item.kind ? " active" : ""}`} onClick={() => setSelected(item.kind)} key={item.kind}><span className={`rule-status${rule?.enabled ? " enabled" : ""}`} /><span><strong>{item.label}</strong><small>{rule?.enabled ? "Enabled" : "Off"}</small></span><ChevronRight size={15} /></button>; })}</aside>
      <div className="rule-editor">
        <section className="settings-card rule-hero"><div><div className="page-kicker">{selected.replace(/_/g, " ")}</div><h2>{definition.label}</h2><p>{definition.summary}</p></div><label className="switch-control large"><input type="checkbox" checked={active.enabled} onChange={(event) => update({ enabled: event.target.checked })} /><span aria-hidden="true" /><b>{active.enabled ? "Enabled" : "Off"}</b></label></section>
        <section className="settings-card"><h2>Detection</h2><p>Only controls relevant to this rule are shown.</p><div className="form-grid">
          {["spam","duplicate","mentions"].includes(selected) && <div className="field"><label htmlFor="rule-threshold">Threshold</label><input id="rule-threshold" className="input" type="number" min={1} max={100} value={active.conditions.threshold ?? definition.defaults.threshold ?? 5} onChange={(event) => updateConditions({ threshold: Number(event.target.value) })} /><small>{selected === "spam" ? "Messages in the configured interval." : selected === "mentions" ? "Mentions allowed in one message." : "Matching messages before action."}</small></div>}
          {selected === "spam" && <div className="field"><label htmlFor="rule-interval">Window (seconds)</label><input id="rule-interval" className="input" type="number" min={1} max={300} value={active.conditions.intervalSeconds ?? 8} onChange={(event) => updateConditions({ intervalSeconds: Number(event.target.value) })} /></div>}
          {selected === "caps" && <div className="field"><label htmlFor="caps-percent">Capital letters (%)</label><input id="caps-percent" className="input" type="number" min={1} max={100} value={active.conditions.percentage ?? 75} onChange={(event) => updateConditions({ percentage: Number(event.target.value) })} /><small>Only messages with at least 12 letters are evaluated.</small></div>}
          {selected === "new_account" && <div className="field"><label htmlFor="account-age">Minimum account age (days)</label><input id="account-age" className="input" type="number" min={0} max={3650} value={active.conditions.minimumAccountAgeDays ?? 3} onChange={(event) => updateConditions({ minimumAccountAgeDays: Number(event.target.value) })} /></div>}
          {["blocked_words","blocked_domains"].includes(selected) && <div className="field full"><label htmlFor="rule-values">{selected === "blocked_words" ? "Blocked words and phrases" : "Blocked domains"}</label><textarea id="rule-values" className="textarea" value={(active.conditions.values ?? []).join("\n")} onChange={(event) => updateConditions({ values: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 100) })} placeholder={selected === "blocked_words" ? "one phrase per line" : "example.com\nanother.example"} /><small>One entry per line. Matching is case-insensitive.</small></div>}
          {active.actions.includes("timeout") && <div className="field"><label htmlFor="timeout-seconds">Timeout length (seconds)</label><input id="timeout-seconds" className="input" type="number" min={10} max={2419200} value={active.conditions.timeoutSeconds ?? 600} onChange={(event) => updateConditions({ timeoutSeconds: Number(event.target.value) })} /></div>}
        </div></section>
        <section className="settings-card"><h2>Response</h2><p>Actions run in this order: delete, record or warn, then member restriction and staff notification.</p><div className="action-grid">{actionChoices.map((action) => <label className={`action-choice${active.actions.includes(action) ? " selected" : ""}`} key={action}><input type="checkbox" checked={active.actions.includes(action)} onChange={(event) => update({ actions: event.target.checked ? [...active.actions, action] : active.actions.filter((item) => item !== action) })} /><strong>{action}</strong><small>{action === "delete" ? "Remove the triggering message" : action === "notify" ? "Post to the staff alert or automod log" : `${action[0].toUpperCase()}${action.slice(1)} the member`}</small></label>)}</div>{active.actions.includes("ban") && <div className="warning-callout"><AlertTriangle size={16} /><span>Ban is immediate. Test this rule with delete + notify first.</span></div>}</section>
        <section className="settings-card"><h2>Exemptions</h2><p>Automod checks everyone by default, including administrators and staff. Only roles and channels selected here are ignored; Discord may still prevent timeouts, kicks, or bans against protected members.</p><div className="split-pickers"><div><div className="field-label">Roles</div><div className="picker-list">{guild.resources?.roles.slice(0,30).map((role) => <label key={role.id}><input type="checkbox" checked={active.exemptRoleIds.includes(role.id)} onChange={() => toggleValue("exemptRoleIds", role.id)} /><span>{role.name}</span></label>)}</div></div><div><div className="field-label">Channels</div><div className="picker-list">{textChannels.map((channel) => <label key={channel.id}><input type="checkbox" checked={active.exemptChannelIds.includes(channel.id)} onChange={() => toggleValue("exemptChannelIds", channel.id)} /><span>#{channel.name}</span></label>)}</div></div></div></section>
      </div>
    </div>}
    <div className="sticky-save-bar"><div><span className={`save-state-dot ${dirty ? "changed" : "saved"}`} /><strong>{dirty ? "Unsaved automod changes" : "Automod rules are current"}</strong><small>Every action is still checked against Discord permissions.</small></div><button className="button primary" onClick={() => void save()} disabled={!dirty || saving || !active}>{saving ? "Saving…" : <><Check size={15} /> Save automod</>}</button></div>
  </DashboardShell>;
}
