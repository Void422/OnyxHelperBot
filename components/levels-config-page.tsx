"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Gauge, Plus, ShieldCheck, Sparkles, Trash2, Trophy, WandSparkles } from "lucide-react";
import type { MessageTemplate } from "@/packages/core/src/domain";
import { xpForLevel } from "@/packages/core/src/leveling";
import { rankLadderPresets, type RankLadderPreset } from "@/packages/core/src/rank-ladders";
import { renderTemplate } from "@/packages/core/src/template";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { useApi } from "./use-api";
import { useGuildSettings } from "./use-guild-settings";

interface Reward { id?: string; level: number; roleId: string; stack: boolean }
interface LevelConfig { rewards: Reward[]; xp: { curve?: "standard" | "grind" | "legendary"; cooldownSeconds?: number; minimumMessageLength?: number; minAward?: number; maxAward?: number; excludedChannelIds?: string[]; excludedRoleIds?: string[] }; levelAnnouncementChannelId?: string; levelUpMessage?: MessageTemplate }

function normalized(value: LevelConfig): LevelConfig {
  return { ...value, xp: { curve: "standard", cooldownSeconds: 60, minimumMessageLength: 8, minAward: 10, maxAward: 20, excludedChannelIds: [], excludedRoleIds: [], ...value.xp }, rewards: [...value.rewards].sort((left, right) => left.level - right.level), levelUpMessage: value.levelUpMessage ?? { content: "◆ {mention} reached **level {level}** and moved up the ranks." } };
}

export function LevelsConfigPage({ guildId }: { guildId: string }) {
  const { session } = useSession();
  const guild = useGuildSettings(guildId);
  const api = useApi<LevelConfig>(`/api/guilds/${guildId}/levels`);
  const [draft, setDraft] = useState<LevelConfig | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingLadder, setCreatingLadder] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<RankLadderPreset["id"]>("grind");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (!api.data) return;
    const next = normalized(api.data);
    // Replace the editor with the authoritative level configuration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next); setSnapshot(JSON.stringify(next));
  }, [api.data]);
  const dirty = Boolean(draft) && JSON.stringify(draft) !== snapshot;
  const preview = useMemo(() => draft ? renderTemplate(draft.levelUpMessage?.content ?? draft.levelUpMessage?.description ?? "{mention} reached level {level}.", { mention: "@Alex", username: "Alex", server: guild.guildName ?? "Your server", memberCount: 1284, level: 12, xp: 5840 }) : "", [draft, guild.guildName]);
  const textChannels = guild.resources?.channels.filter((channel) => [0,5].includes(channel.type)) ?? [];
  const updateXp = (patch: Partial<LevelConfig["xp"]>) => setDraft((current) => current ? { ...current, xp: { ...current.xp, ...patch } } : current);
  const toggleExcluded = (field: "excludedChannelIds" | "excludedRoleIds", value: string) => draft && updateXp({ [field]: (draft.xp[field] ?? []).includes(value) ? (draft.xp[field] ?? []).filter((item) => item !== value) : [...(draft.xp[field] ?? []), value] });
  const save = async () => {
    if (!draft || !dirty || !session?.csrfToken) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/levels`, { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify(draft) });
      const body = await response.json() as LevelConfig & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not save the level configuration.");
      const next = normalized(body); setDraft(next); setSnapshot(JSON.stringify(next)); setMessage({ kind: "success", text: "Leveling configuration saved. New messages will use it within 30 seconds." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Onyx could not save the level configuration." }); }
    finally { setSaving(false); }
  };
  const createLadder = async () => {
    if (!session?.csrfToken || creatingLadder) return;
    if (draft?.rewards.length && !window.confirm("Replace the reward mapping with a new seven-rank ladder? Existing Discord roles will not be deleted.")) return;
    setCreatingLadder(true); setMessage(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/levels`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify({ preset: selectedPreset, replace: Boolean(draft?.rewards.length) }) });
      const body = await response.json() as { rewards?: Reward[]; curve?: LevelConfig["xp"]["curve"]; error?: { message?: string } };
      if (!response.ok || !body.rewards) throw new Error(body.error?.message ?? "Discord could not create the rank ladder.");
      setDraft((current) => current ? { ...current, rewards: body.rewards ?? [], xp: { ...current.xp, curve: body.curve ?? current.xp.curve } } : current);
      await api.refresh();
      setMessage({ kind: "success", text: "Seven rank roles created. Members will climb into them as they level." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Discord could not create the rank ladder." }); }
    finally { setCreatingLadder(false); }
  };

  return <DashboardShell guildId={guildId} guildName={guild.guildName} active="levels">
    <div className="page-heading"><div><div className="page-kicker"><Crown size={14} /> Rank progression</div><h1>Give members something worth chasing.</h1><p>Seven visible ranks, harder XP curves, and actual Discord perks at every stage.</p></div><div className="heading-stat"><strong>{draft?.rewards.length ?? 0}</strong><span>rank unlocks</span></div></div>
    {(api.error || guild.error) && <div className="error-banner">{api.error ?? guild.error}</div>}
    {message && <div className={message.kind === "success" ? "success-banner" : "error-banner"}>{message.text}</div>}
    {!draft ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : <div className="configuration-grid">
      <div>
        <section className="settings-card rank-forge"><div className="section-title-row"><div><div className="page-kicker">Rank forge</div><h2>Create the whole ladder</h2><p>Pick a pace. Onyx creates seven colored roles and unlocks progressively better chat perks.</p></div><WandSparkles size={22} /></div>
          <div className="rank-preset-grid">{rankLadderPresets.map((preset) => <button type="button" className={`rank-preset ${selectedPreset === preset.id ? "selected" : ""}`} key={preset.id} onClick={() => setSelectedPreset(preset.id)}><span>{preset.name}</span><strong>Level {preset.tiers.at(-1)?.level}</strong><small>{preset.summary}</small><div className="rank-color-run">{preset.tiers.map((tier) => <i key={tier.name} style={{ backgroundColor: `#${tier.color.toString(16).padStart(6, "0")}` }} />)}</div></button>)}</div>
          <div className="rank-forge-action"><div><ShieldCheck size={16} /><span>Rank roles unlock social perks, never staff or administrator access.</span></div><button className="button primary" type="button" disabled={creatingLadder} onClick={() => void createLadder()}>{creatingLadder ? "Creating seven roles…" : <><WandSparkles size={15} /> Create rank ladder</>}</button></div>
        </section>
        <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">XP pace</div><h2>Make the climb count</h2><p>Choose the curve, then tune how quickly good messages earn progress.</p></div><Gauge size={22} /></div><div className="form-grid">
          <div className="field"><label htmlFor="xp-curve">Progression curve</label><select id="xp-curve" className="select" value={draft.xp.curve} onChange={(event) => updateXp({ curve: event.target.value as LevelConfig["xp"]["curve"] })}><option value="standard">Momentum · quick season</option><option value="grind">The Grind · long-term</option><option value="legendary">Legend · brutal</option></select><small>Level 100 takes about {xpForLevel(100, draft.xp.curve).toLocaleString()} XP.</small></div>
          <div className="field"><label htmlFor="xp-cooldown">Cooldown (seconds)</label><input id="xp-cooldown" className="input" type="number" min={15} max={600} value={draft.xp.cooldownSeconds} onChange={(event) => updateXp({ cooldownSeconds: Number(event.target.value) })} /><small>How often one member can earn XP.</small></div>
          <div className="field"><label htmlFor="xp-length">Minimum message length</label><input id="xp-length" className="input" type="number" min={3} max={200} value={draft.xp.minimumMessageLength} onChange={(event) => updateXp({ minimumMessageLength: Number(event.target.value) })} /><small>Whitespace is normalized before checking.</small></div>
          <div className="field"><label htmlFor="xp-min">Minimum XP award</label><input id="xp-min" className="input" type="number" min={1} max={100} value={draft.xp.minAward} onChange={(event) => updateXp({ minAward: Number(event.target.value) })} /></div>
          <div className="field"><label htmlFor="xp-max">Maximum XP award</label><input id="xp-max" className="input" type="number" min={1} max={200} value={draft.xp.maxAward} onChange={(event) => updateXp({ maxAward: Number(event.target.value) })} /></div>
        </div></section>
        <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Ladder editor</div><h2>Rank unlocks</h2><p>Fine-tune the generated ladder or connect your own roles.</p></div><Trophy size={22} /></div>
          <div className="reward-list">{draft.rewards.map((reward, index) => <div className="reward-row" key={`${reward.level}-${index}`}><div className="field"><label htmlFor={`reward-level-${index}`}>Level</label><input id={`reward-level-${index}`} className="input" type="number" min={1} max={1000} value={reward.level} onChange={(event) => setDraft({ ...draft, rewards: draft.rewards.map((item, itemIndex) => itemIndex === index ? { ...item, level: Number(event.target.value) } : item) })} /></div><div className="field reward-role"><label htmlFor={`reward-role-${index}`}>Role</label><select id={`reward-role-${index}`} className="select" value={reward.roleId} onChange={(event) => setDraft({ ...draft, rewards: draft.rewards.map((item, itemIndex) => itemIndex === index ? { ...item, roleId: event.target.value } : item) })}><option value="">Choose a role</option>{guild.resources?.roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></div><label className="check-line"><input type="checkbox" checked={reward.stack} onChange={(event) => setDraft({ ...draft, rewards: draft.rewards.map((item, itemIndex) => itemIndex === index ? { ...item, stack: event.target.checked } : item) })} /><span>Keep earlier rewards</span></label><button className="icon-button danger-icon" type="button" aria-label="Remove reward" onClick={() => setDraft({ ...draft, rewards: draft.rewards.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></button></div>)}</div>
          <button className="button" type="button" disabled={draft.rewards.length >= 50 || !guild.resources?.roles.length} onClick={() => setDraft({ ...draft, rewards: [...draft.rewards, { level: (draft.rewards.at(-1)?.level ?? 0) + 5, roleId: guild.resources?.roles[0]?.id ?? "", stack: true }] })}><Plus size={15} /> Add role milestone</button>
        </section>
        <section className="settings-card"><h2>Excluded spaces</h2><p>Messages in these channels—or from members with these roles—never earn XP.</p><div className="split-pickers"><div><div className="field-label">Channels</div><div className="picker-list">{textChannels.map((channel) => <label key={channel.id}><input type="checkbox" checked={(draft.xp.excludedChannelIds ?? []).includes(channel.id)} onChange={() => toggleExcluded("excludedChannelIds", channel.id)} /><span>#{channel.name}</span></label>)}</div></div><div><div className="field-label">Roles</div><div className="picker-list">{guild.resources?.roles.slice(0,30).map((role) => <label key={role.id}><input type="checkbox" checked={(draft.xp.excludedRoleIds ?? []).includes(role.id)} onChange={() => toggleExcluded("excludedRoleIds", role.id)} /><span>{role.name}</span></label>)}</div></div></div></section>
      </div>
      <aside className="side-stack">
        <section className="settings-card"><div className="page-kicker">Announcement</div><h2>Level-up message</h2><p>Placeholders: {'{mention}'}, {'{username}'}, {'{server}'}, {'{level}'}, {'{xp}'}.</p><div className="field"><label htmlFor="level-channel">Channel</label><select id="level-channel" className="select" value={draft.levelAnnouncementChannelId ?? ""} onChange={(event) => setDraft({ ...draft, levelAnnouncementChannelId: event.target.value || undefined })}><option value="">Do not announce</option>{textChannels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div><div className="field" style={{ marginTop: 15 }}><label htmlFor="level-message">Message</label><textarea id="level-message" className="textarea" maxLength={2000} value={draft.levelUpMessage?.content ?? ""} onChange={(event) => setDraft({ ...draft, levelUpMessage: { ...draft.levelUpMessage, content: event.target.value } })} /></div></section>
        <section className="discord-preview"><div className="preview-label"><Sparkles size={14} /> Discord preview</div><div className="discord-message"><div className="preview-avatar">O</div><div><div><strong>Onyx</strong><span className="bot-tag">APP</span><time>Today at 12:42</time></div><p>{preview}</p></div></div></section>
      </aside>
    </div>}
    <div className="sticky-save-bar"><div><span className={`save-state-dot ${dirty ? "changed" : "saved"}`} /><strong>{dirty ? "Unsaved rank changes" : "Rank ladder is current"}</strong><small>New ranks apply as members level up.</small></div><button className="button primary" onClick={() => void save()} disabled={!dirty || saving || !draft}>{saving ? "Saving…" : <><Check size={15} /> Save ranks</>}</button></div>
  </DashboardShell>;
}
