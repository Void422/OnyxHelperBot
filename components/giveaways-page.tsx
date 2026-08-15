"use client";

import { Check, Clock3, Crown, Gift, ShieldCheck, Sparkles, Ticket, Trophy, Users } from "lucide-react";
import type { GiveawayRequirements, GiveawaySettings } from "@/packages/core/src/domain";
import { DashboardShell } from "./dashboard-shell";
import { formatApiDate, useApi } from "./use-api";
import { useGuildSettings } from "./use-guild-settings";

interface Giveaway {
  id: string;
  prize: string;
  description: string | null;
  status: string;
  channelId: string;
  hostUserId: string;
  winnerCount: number;
  endsAt: string;
  eligibleEntryCount: number | null;
  winnerUserIds: string[];
  requirements: GiveawayRequirements;
}

const defaults: GiveawaySettings = {
  minimumLevel: 0,
  minimumAccountAgeDays: 0,
  minimumMembershipAgeDays: 0,
  bonusEntries: 2,
  winnerRoleDurationHours: 168,
  accentColor: "#e0aa4f",
  entryButtonLabel: "Claim your ticket",
};

export function GiveawaysPage({ guildId }: { guildId: string }) {
  const guild = useGuildSettings(guildId);
  const result = useApi<{ giveaways: Giveaway[] }>(`/api/guilds/${guildId}/giveaways`);
  const settings = { ...defaults, ...guild.draft?.settings.giveaways };
  const roles = guild.resources?.roles ?? [];
  const active = result.data?.giveaways.filter((giveaway) => ["active", "scheduled", "paused"].includes(giveaway.status)) ?? [];
  const completed = result.data?.giveaways.filter((giveaway) => giveaway.status === "ended") ?? [];
  const roleName = (id?: string) => id ? roles.find((role) => role.id === id)?.name ?? "Unknown role" : "None";
  const update = (patch: Partial<GiveawaySettings>) => guild.updateSettings((current) => ({ ...current, giveaways: { ...defaults, ...current.giveaways, ...patch } }));

  return <DashboardShell guildId={guildId} guildName={guild.guildName} active="giveaways">
    <div className="page-heading giveaway-heading"><div><div className="page-kicker"><Sparkles size={14} /> Giveaway events</div><h1>Make the drop feel like a drop.</h1><p>Gate entries, reward loyal ranks, boost supporter odds, and give winners something visible.</p></div><div className="giveaway-heading-stats"><span><strong>{active.length}</strong> live</span><span><strong>{completed.length}</strong> completed</span></div></div>
    {(result.error || guild.error || guild.resourcesError) && <div className="error-banner">{result.error ?? guild.error ?? guild.resourcesError}</div>}
    {guild.message && <div className={guild.message.kind === "success" ? "success-banner" : "error-banner"}>{guild.message.text}</div>}

    <div className="giveaway-workspace">
      <div className="giveaway-settings-stack">
        <section className="settings-card giveaway-defaults"><div className="section-title-row"><div><div className="page-kicker">Drop rules</div><h2>Who gets a ticket</h2><p>These defaults apply to new giveaways. Staff can override them in `/giveaway create`.</p></div><ShieldCheck size={22} /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="giveaway-required">Required role</label><select id="giveaway-required" className="select" value={settings.requiredRoleId ?? ""} onChange={(event) => update({ requiredRoleId: event.target.value || undefined })}><option value="">Everyone can enter</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
            <div className="field"><label htmlFor="giveaway-blocked">Blocked role</label><select id="giveaway-blocked" className="select" value={settings.blockedRoleId ?? ""} onChange={(event) => update({ blockedRoleId: event.target.value || undefined })}><option value="">No blocked role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
            <div className="field"><label htmlFor="giveaway-level">Minimum level</label><input id="giveaway-level" className="input" type="number" min={0} max={1000} value={settings.minimumLevel ?? 0} onChange={(event) => update({ minimumLevel: Number(event.target.value) })} /><small>Use ranks to reward members who actually participate.</small></div>
            <div className="field"><label htmlFor="giveaway-member-age">Days in server</label><input id="giveaway-member-age" className="input" type="number" min={0} max={3650} value={settings.minimumMembershipAgeDays ?? 0} onChange={(event) => update({ minimumMembershipAgeDays: Number(event.target.value) })} /></div>
            <div className="field"><label htmlFor="giveaway-account-age">Discord account age</label><input id="giveaway-account-age" className="input" type="number" min={0} max={3650} value={settings.minimumAccountAgeDays ?? 0} onChange={(event) => update({ minimumAccountAgeDays: Number(event.target.value) })} /><small>Discourages freshly created giveaway accounts.</small></div>
          </div>
        </section>

        <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Loyalty boost</div><h2>Bonus tickets</h2><p>Give supporters, subscribers, or high ranks extra chances without guaranteeing the result.</p></div><Ticket size={22} /></div>
          <div className="form-grid"><div className="field"><label htmlFor="giveaway-bonus-role">Boosted role</label><select id="giveaway-bonus-role" className="select" value={settings.bonusRoleId ?? ""} onChange={(event) => update({ bonusRoleId: event.target.value || undefined })}><option value="">No ticket boost</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div><div className="field"><label htmlFor="giveaway-bonus-count">Extra tickets</label><input id="giveaway-bonus-count" className="input" type="number" min={1} max={20} value={settings.bonusEntries ?? 2} onChange={(event) => update({ bonusEntries: Number(event.target.value) })} /><small>A boosted member gets {1 + (settings.bonusEntries ?? 2)} total tickets.</small></div></div>
        </section>

        <section className="settings-card winner-reward-card"><div className="section-title-row"><div><div className="page-kicker">Winner unlock</div><h2>Make the win visible</h2><p>Winners receive a role immediately after the reveal. Keep it permanent or let it expire.</p></div><Crown size={22} /></div>
          <div className="form-grid"><div className="field"><label htmlFor="giveaway-winner-role">Winner role</label><select id="giveaway-winner-role" className="select" value={settings.winnerRoleId ?? ""} onChange={(event) => update({ winnerRoleId: event.target.value || undefined })}><option value="">No winner role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><small>Onyx must sit above this role.</small></div><div className="field"><label htmlFor="giveaway-winner-hours">Keep role for</label><select id="giveaway-winner-hours" className="select" value={settings.winnerRoleDurationHours ?? 168} onChange={(event) => update({ winnerRoleDurationHours: Number(event.target.value) })}><option value={0}>Permanent</option><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option><option value={2160}>90 days</option></select></div></div>
        </section>

        <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Presentation</div><h2>Giveaway identity</h2><p>Set the accent and the action members see on every new drop.</p></div><Sparkles size={22} /></div><div className="form-grid"><div className="field"><label htmlFor="giveaway-accent">Accent</label><div className="color-input"><input id="giveaway-accent" type="color" value={settings.accentColor ?? "#e0aa4f"} onChange={(event) => update({ accentColor: event.target.value })} /><input className="input" value={settings.accentColor ?? "#e0aa4f"} maxLength={7} onChange={(event) => update({ accentColor: event.target.value })} /></div></div><div className="field"><label htmlFor="giveaway-button">Entry button</label><input id="giveaway-button" className="input" maxLength={80} value={settings.entryButtonLabel ?? "Claim your ticket"} onChange={(event) => update({ entryButtonLabel: event.target.value })} /></div></div></section>
      </div>

      <aside className="giveaway-side-stack">
        <section className="giveaway-preview"><div className="preview-label"><Gift size={14} /> Discord drop preview</div><div className="giveaway-preview-author">ONYX GIVEAWAY DROP</div><h3>🎁 Nitro + Champion Role</h3><p>One winner takes the prize and wears the champion role for a week.</p><div className="giveaway-preview-grid"><span><Clock3 size={13} /><small>Draws</small><strong>in 2 days</strong></span><span><Trophy size={13} /><small>Winners</small><strong>1</strong></span><span><Users size={13} /><small>Entrants</small><strong>284</strong></span></div><div className="giveaway-rule-preview"><span>ENTRY RULES</span><strong>{settings.requiredRoleId ? roleName(settings.requiredRoleId) : "Open to everyone"}{settings.minimumLevel ? ` · Level ${settings.minimumLevel}+` : ""}</strong></div><div className="giveaway-rule-preview"><span>TICKET BOOST</span><strong>{settings.bonusRoleId ? `${roleName(settings.bonusRoleId)} gets +${settings.bonusEntries ?? 2}` : "One ticket each"}</strong></div><div className="giveaway-rule-preview"><span>WINNER UNLOCK</span><strong>{settings.winnerRoleId ? `${roleName(settings.winnerRoleId)} · ${settings.winnerRoleDurationHours ? `${settings.winnerRoleDurationHours}h` : "permanent"}` : "Prize only"}</strong></div><button type="button" style={{ backgroundColor: settings.accentColor ?? "#e0aa4f" }}>🎟️ {settings.entryButtonLabel}</button></section>
        <section className="settings-card launch-card"><div className="page-kicker">Launch</div><h2>Create in Discord</h2><p>Use <code>/giveaway create</code>. The saved rules fill in automatically, and every field can still be overridden for one special drop.</p></section>
      </aside>
    </div>

    <div className="sticky-save-bar"><div><span className={`save-state-dot ${guild.dirty ? "changed" : "saved"}`} /><strong>{guild.dirty ? "Unsaved giveaway defaults" : "Giveaway defaults are current"}</strong><small>New drops use these choices.</small></div><button className="button primary" onClick={() => void guild.save()} disabled={!guild.dirty || guild.saving}>{guild.saving ? "Saving…" : <><Check size={15} /> Save giveaway defaults</>}</button></div>

    <section className="giveaway-history"><div className="section-title-row"><div><div className="page-kicker">Event history</div><h2>Recent drops</h2><p>Live draws stay up top. Winner reveals remain easy to find.</p></div><Gift size={22} /></div>{result.loading ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : result.data?.giveaways.length ? <div className="giveaway-card-list">{result.data.giveaways.map((item) => <article className={`giveaway-event-card ${item.status}`} key={item.id}><div className="giveaway-event-icon"><Gift size={18} /></div><div><div className="giveaway-event-title"><strong>{item.prize}</strong><span className={`badge ${item.status}`}>{item.status}</span></div><p>{item.description || "No extra description."}</p><div className="giveaway-event-meta"><span><Users size={12} /> {item.eligibleEntryCount ?? 0} entrants</span><span><Trophy size={12} /> {item.winnerCount} winner{item.winnerCount === 1 ? "" : "s"}</span><span><Clock3 size={12} /> {formatApiDate(item.endsAt)}</span></div></div><div className="giveaway-event-reward"><small>Winner unlock</small><strong>{item.requirements.winnerRoleId ? roleName(item.requirements.winnerRoleId) : "Prize only"}</strong>{item.winnerUserIds.length > 0 && <span>{item.winnerUserIds.length} revealed</span>}</div></article>)}</div> : <div className="empty-state"><Gift size={22} /><strong>No drops yet</strong><span>Save your defaults, then launch the first one with `/giveaway create`.</span></div>}</section>
  </DashboardShell>;
}
