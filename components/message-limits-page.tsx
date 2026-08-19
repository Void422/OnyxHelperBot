"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquareText, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { useApi } from "./use-api";
import { useGuildSettings } from "./use-guild-settings";

interface MessageLimit { id?: string; channelId: string; maxMessages: number; enabled: boolean }
interface Response { limits: MessageLimit[] }

export function MessageLimitsPage({ guildId }: { guildId: string }) {
  const { session } = useSession();
  const guild = useGuildSettings(guildId);
  const api = useApi<Response>(`/api/guilds/${guildId}/message-limits`);
  const [draft, setDraft] = useState<MessageLimit[]>([]);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!api.data) return;
    const next = api.data.limits.map((limit) => ({ ...limit }));
    // Replace the editor with the authoritative limits from the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next); setSnapshot(JSON.stringify(next));
  }, [api.data]);

  const channels = useMemo(() => guild.resources?.channels.filter((channel) => [0, 5].includes(channel.type)) ?? [], [guild.resources?.channels]);
  const availableChannels = channels.filter((channel) => !draft.some((limit) => limit.channelId === channel.id));
  const dirty = JSON.stringify(draft) !== snapshot;
  const update = (index: number, patch: Partial<MessageLimit>) => setDraft((current) => current.map((limit, itemIndex) => itemIndex === index ? { ...limit, ...patch } : limit));
  const add = () => {
    const channel = availableChannels[0];
    if (channel) setDraft((current) => [...current, { channelId: channel.id, maxMessages: 1, enabled: true }]);
  };
  const save = async () => {
    if (!session?.csrfToken || !dirty) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/message-limits`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify({ limits: draft.map(({ channelId, maxMessages, enabled }) => ({ channelId, maxMessages, enabled })) }) });
      const body = await response.json() as Response & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not save those message limits.");
      const next = body.limits.map((limit) => ({ ...limit }));
      setDraft(next); setSnapshot(JSON.stringify(next)); setMessage({ kind: "success", text: "Message limits saved. The bot will use them within 30 seconds." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Onyx could not save those message limits." });
    } finally {
      setSaving(false);
    }
  };

  return <DashboardShell guildId={guildId} guildName={guild.guildName} active="message-limits">
    <div className="page-heading"><div><div className="page-kicker"><MessageSquareText size={14} /> Per-member quotas</div><h1>Limit how many times someone can post.</h1><p>Choose a channel and set a lifetime message allowance for each human member.</p></div><div className="heading-stat"><strong>{draft.filter((limit) => limit.enabled).length}</strong><span>active channels</span></div></div>
    {(api.error || guild.error || guild.resourcesError) && <div className="error-banner">{api.error ?? guild.error ?? guild.resourcesError}</div>}
    {message && <div className={message.kind === "success" ? "success-banner" : "error-banner"}>{message.text}</div>}
    {(api.loading || guild.loading) ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : <div className="config-grid">
      <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Channel rules</div><h2>Message allowances</h2></div><MessageSquareText size={21} /></div><p>Onyx counts messages already in the channel the first time each member posts, then keeps the count across bot restarts.</p>
        {draft.length ? <div className="message-limit-list">{draft.map((limit, index) => <div className="message-limit-row" key={limit.id ?? `${limit.channelId}-${index}`}>
          <div className="field"><label htmlFor={`limit-channel-${index}`}>Channel</label><select id={`limit-channel-${index}`} className="select" value={limit.channelId} onChange={(event) => update(index, { channelId: event.target.value })}>{channels.filter((channel) => channel.id === limit.channelId || !draft.some((candidate) => candidate.channelId === channel.id)).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div>
          <div className="field"><label htmlFor={`limit-maximum-${index}`}>Messages per member</label><input id={`limit-maximum-${index}`} className="input" type="number" min={1} max={100000} value={limit.maxMessages} onChange={(event) => update(index, { maxMessages: Number(event.target.value) })} /><small>The first {limit.maxMessages.toLocaleString()} stay visible.</small></div>
          <label className="switch-control"><input type="checkbox" checked={limit.enabled} onChange={(event) => update(index, { enabled: event.target.checked })} /><span aria-hidden="true" /><b>{limit.enabled ? "On" : "Off"}</b></label>
          <button className="icon-button danger-icon" type="button" aria-label="Remove message limit" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
        </div>)}</div> : <div className="empty-state compact"><MessageSquareText size={22} /><strong>No limited channels</strong><span>Add a channel to give every human member a fixed message allowance.</span></div>}
        <button className="button" type="button" onClick={add} disabled={!availableChannels.length}><Plus size={15} /> Add channel limit</button>
      </section>
      <aside className="side-stack"><section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Exact behavior</div><h2>No permission tricks</h2></div><ShieldCheck size={20} /></div><div className="limit-behavior-list"><div><Check size={14} /><span>Members can still press Send normally.</span></div><div><Check size={14} /><span>Only a new message beyond the allowance is deleted.</span></div><div><Check size={14} /><span>Bot and webhook messages never count.</span></div><div><Check size={14} /><span>Editing an existing message is always allowed and never adds to the count.</span></div><div><Check size={14} /><span>Deleting old messages does not reset the lifetime allowance.</span></div></div></section><section className="settings-card"><h2>Required bot access</h2><p>Onyx needs View Channel, Read Message History, and Manage Messages in every limited channel so it can count existing posts and remove overflow.</p></section></aside>
    </div>}
    <div className="sticky-save-bar"><div><span className={`save-state-dot ${dirty ? "changed" : "saved"}`} /><strong>{dirty ? "Unsaved message limits" : "Message limits are current"}</strong><small>Existing member counts are preserved when rules are edited.</small></div><button className="button primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving…" : <><Check size={15} /> Save message limits</>}</button></div>
  </DashboardShell>;
}
