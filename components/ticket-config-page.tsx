"use client";

/* eslint-disable jsx-a11y/label-has-associated-control -- controls use explicit or generated htmlFor/id pairs. */

import { Check, Hash, ShieldCheck, TicketCheck } from "lucide-react";
import type { TicketSettings } from "@/packages/core/src/domain";
import { DashboardShell } from "./dashboard-shell";
import { useGuildSettings } from "./use-guild-settings";

const fallback: Required<Pick<TicketSettings, "panelTitle" | "panelDescription" | "buttonLabel" | "channelNamePattern" | "maxOpenPerUser" | "allowUserClose">> = {
  panelTitle: "Need a hand?",
  panelDescription: "Open a private ticket and the team will be with you shortly.",
  buttonLabel: "Open ticket",
  channelNamePattern: "ticket-{number}-{username}",
  maxOpenPerUser: 1,
  allowUserClose: true,
};

export function TicketConfigPage({ guildId }: { guildId: string }) {
  const state = useGuildSettings(guildId);
  const config = { ...fallback, ...(state.draft?.settings.tickets ?? {}) };
  const update = (patch: Partial<TicketSettings>) => state.updateSettings((settings) => ({ ...settings, tickets: { ...settings.tickets, ...patch } }));
  const textChannels = state.resources?.channels.filter((channel) => [0, 5].includes(channel.type)) ?? [];
  const categories = state.resources?.channels.filter((channel) => channel.type === 4) ?? [];

  return (
    <DashboardShell guildId={guildId} guildName={state.guildName} active="tickets">
      <div className="page-heading"><div><span className="page-kicker">Support desk</span><h1>Tickets</h1><p>Shape the panel members see, the private channel they enter, and the staff team that can respond.</p></div><div className="heading-stat"><TicketCheck size={18} /><span><strong>{config.maxOpenPerUser}</strong> open per member</span></div></div>
      {state.error && <div className="error-banner">{state.error}</div>}
      {state.loading || !state.draft ? <div className="loading-stack">{[0,1,2].map((item) => <div className="skeleton" key={item} />)}</div> : <>
        {state.message && <div className={state.message.kind === "success" ? "success-banner" : "error-banner"}>{state.message.text}</div>}
        <div className="config-grid config-grid-wide">
          <div className="config-stack">
            <section className="settings-card"><div className="section-title-row"><div><span className="section-index">01</span><h2>Panel identity</h2></div><span className="status-pill live">Live preview</span></div><p>This becomes the permanent doorway into support. Run <code>/ticket panel</code> in the destination channel after saving.</p><div className="form-grid"><div className="field"><label htmlFor="ticket-title">Panel title</label><input id="ticket-title" className="input" maxLength={100} value={config.panelTitle} onChange={(event) => update({ panelTitle: event.target.value })} /></div><div className="field"><label htmlFor="ticket-button">Button label</label><input id="ticket-button" className="input" maxLength={80} value={config.buttonLabel} onChange={(event) => update({ buttonLabel: event.target.value })} /></div></div><div className="field"><label htmlFor="ticket-description">Panel description</label><textarea id="ticket-description" className="textarea" maxLength={1_000} value={config.panelDescription} onChange={(event) => update({ panelDescription: event.target.value })} /></div></section>

            <section className="settings-card"><div className="section-title-row"><div><span className="section-index">02</span><h2>Channel routing</h2></div><Hash size={18} /></div><p>Every ticket is a private text channel. Onyx grants access to the opener, staff roles, and itself.</p><div className="form-grid"><div className="field"><label htmlFor="ticket-category">Ticket category</label><select id="ticket-category" className="select" value={config.categoryId ?? ""} onChange={(event) => update({ categoryId: event.target.value || undefined })}><option value="">No category selected</option>{categories.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></div><div className="field"><label htmlFor="ticket-log">Transcript / event log</label><select id="ticket-log" className="select" value={config.logChannelId ?? ""} onChange={(event) => update({ logChannelId: event.target.value || undefined })}><option value="">No log channel</option>{textChannels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div><div className="field"><label htmlFor="ticket-pattern">Channel naming</label><input id="ticket-pattern" className="input" maxLength={80} value={config.channelNamePattern} onChange={(event) => update({ channelNamePattern: event.target.value })} /><small>Use <code>{'{number}'}</code> and <code>{'{username}'}</code>. Onyx removes unsafe characters.</small></div><div className="field"><label htmlFor="ticket-limit">Open tickets per member</label><input id="ticket-limit" className="input" type="number" min={1} max={10} value={config.maxOpenPerUser} onChange={(event) => update({ maxOpenPerUser: Number(event.target.value) })} /></div></div><label className="switch-row" htmlFor="ticket-user-close"><span><strong>Member close button</strong><small>Allow the ticket opener to close their own channel.</small></span><input id="ticket-user-close" type="checkbox" checked={config.allowUserClose} onChange={(event) => update({ allowUserClose: event.target.checked })} /></label></section>

            <section className="settings-card"><div className="section-title-row"><div><span className="section-index">03</span><h2>Support team</h2></div><ShieldCheck size={18} /></div><p>Selected roles can see, claim, manage, and close ticket channels. Discord role hierarchy still applies.</p><div className="role-picker">{state.resources?.roles.slice(0, 40).map((role) => { const checked = (config.staffRoleIds ?? []).includes(role.id); return <label className={`role-choice${checked ? " selected" : ""}`} key={role.id} htmlFor={`ticket-role-${role.id}`}><input id={`ticket-role-${role.id}`} type="checkbox" checked={checked} onChange={() => update({ staffRoleIds: checked ? (config.staffRoleIds ?? []).filter((id) => id !== role.id) : [...(config.staffRoleIds ?? []), role.id].slice(0, 20) })} /><span className="role-dot" /><span>{role.name}</span>{checked && <Check size={14} />}</label>; })}</div></section>
          </div>
          <aside className="preview-rail"><div className="preview-label">Member view</div><div className="discord-preview"><div className="discord-author"><span className="discord-avatar onyx-avatar">O</span><strong>Onyx</strong><span className="bot-tag">APP</span><span>Today at 12:00</span></div><div className="discord-embed"><div className="discord-embed-title">{config.panelTitle || "Untitled panel"}</div><p>{config.panelDescription || "No description yet."}</p></div><button className="discord-button"><TicketCheck size={15} />{config.buttonLabel || "Open ticket"}</button></div><div className="preview-note"><strong>Created channel</strong><code>{config.channelNamePattern.replace("{number}", "0042").replace("{username}", "alex")}</code><span>Private · claimable · transcript ready</span></div></aside>
        </div>
        <div className="sticky-save-bar"><div><span className={`save-state-dot ${state.dirty ? "changed" : "saved"}`} /><strong>{state.dirty ? "Ticket setup has unsaved changes" : "Ticket setup is synced"}</strong></div><button className="button primary" onClick={() => void state.save()} disabled={!state.dirty || state.saving}>{state.saving ? "Saving…" : <><Check size={15} /> Save ticket setup</>}</button></div>
      </>}
    </DashboardShell>
  );
}
