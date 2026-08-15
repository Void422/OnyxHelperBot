"use client";

/* eslint-disable @next/next/no-img-element -- preview arbitrary HTTPS Discord embed media without proxying it. */

import { useMemo, useState } from "react";
import { Check, Image as ImageIcon, Mail, MessageSquareText, RotateCcw, Sparkles, Users } from "lucide-react";
import type { MessageTemplate } from "@/packages/core/src/domain";
import { renderTemplate, templatePlaceholders } from "@/packages/core/src/template";
import { DashboardShell } from "./dashboard-shell";
import { useGuildSettings } from "./use-guild-settings";

type TemplateKey = "welcome" | "goodbye" | "warningDm" | "ticketOpen" | "giveawayWinner";
const templateMeta: Array<{ key: TemplateKey; label: string; description: string }> = [
  { key: "welcome", label: "Welcome", description: "Posted when a member joins." },
  { key: "goodbye", label: "Goodbye", description: "Posted when a member leaves." },
  { key: "warningDm", label: "Warning DM", description: "Privately explains a new warning." },
  { key: "ticketOpen", label: "Ticket opening", description: "Greets members inside a new ticket." },
  { key: "giveawayWinner", label: "Giveaway winner", description: "Announces selected winners." },
];
const defaults: Record<TemplateKey, MessageTemplate> = {
  welcome: { content: "Welcome {mention} to **{server}** — you’re member **#{memberCount}**.", color: "#D7D2C7" },
  goodbye: { content: "**{username}** left **{server}**. We’re now at **{memberCount}** members.", color: "#8D5D5A" },
  warningDm: { title: "A note from {server}", description: "You received a warning from {moderator}.\n\n**Reason**\n{reason}", footer: "Replying here will not contact the moderation team.", color: "#C99B5E" },
  ticketOpen: { title: "Ticket #{ticket}", description: "Hi {mention} — describe what you need help with and a staff member will respond here.", footer: "Use the close button when your question is resolved.", color: "#D7D2C7" },
  giveawayWinner: { content: "Giveaway ended — {mention} won **{prize}**.", color: "#C4AA73" },
};

function preview(template: MessageTemplate, guildName: string) {
  const values = { user: "123", mention: "@Alex", username: "Alex", server: guildName, memberCount: 1284, level: 12, xp: 5840, moderator: "Sam", reason: "Repeated advertising after a staff reminder.", ticket: 42, prize: "Discord Nitro" };
  return {
    content: template.content ? renderTemplate(template.content, values) : "",
    title: template.title ? renderTemplate(template.title, values) : "",
    description: template.description ? renderTemplate(template.description, values) : "",
    footer: template.footer ? renderTemplate(template.footer, values) : "",
  };
}

export function MessageStudio({ guildId }: { guildId: string }) {
  const settings = useGuildSettings(guildId);
  const [selected, setSelected] = useState<TemplateKey>("welcome");
  const template = settings.draft?.settings.messages?.[selected] ?? defaults[selected];
  const rendered = useMemo(() => preview(template, settings.guildName ?? "Your server"), [template, settings.guildName]);
  const textChannels = settings.resources?.channels.filter((channel) => [0,5].includes(channel.type)) ?? [];
  const updateTemplate = (patch: Partial<MessageTemplate>) => settings.updateSettings((current) => ({ ...current, messages: { ...current.messages, [selected]: { ...(current.messages?.[selected] ?? defaults[selected]), ...patch } } }));
  const toggleRole = (field: "memberRoleIds" | "botRoleIds", roleId: string) => settings.updateSettings((current) => {
    const values = current.autoroles?.[field] ?? [];
    return { ...current, autoroles: { ...current.autoroles, [field]: values.includes(roleId) ? values.filter((item) => item !== roleId) : [...values, roleId] } };
  });

  return <DashboardShell guildId={guildId} guildName={settings.guildName} active="messages">
    <div className="page-heading"><div><div className="page-kicker"><MessageSquareText size={14} /> Message studio</div><h1>Make Onyx sound like your server.</h1><p>Compose real Discord messages, use safe placeholders, and preview the result before anyone sees it.</p></div><div className="heading-stat"><strong>{templatePlaceholders.length}</strong><span>safe placeholders</span></div></div>
    {settings.error && <div className="error-banner">{settings.error}</div>}
    {settings.message && <div className={settings.message.kind === "success" ? "success-banner" : "error-banner"}>{settings.message.text}</div>}
    {settings.loading || !settings.draft ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : <>
      <div className="studio-tabs" role="tablist">{templateMeta.map((item) => <button type="button" role="tab" aria-selected={selected === item.key} className={selected === item.key ? "active" : ""} onClick={() => setSelected(item.key)} key={item.key}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div>
      <div className="studio-layout">
        <div>
          <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">{templateMeta.find((item) => item.key === selected)?.label}</div><h2>Message content</h2><p>Use plain content, an embed, or both. Discord’s character limits are enforced when you save.</p></div><button className="button ghost" type="button" onClick={() => settings.updateSettings((current) => ({ ...current, messages: { ...current.messages, [selected]: defaults[selected] } }))}><RotateCcw size={14} /> Reset</button></div>
            <div className="field"><label htmlFor="message-content">Plain message</label><textarea id="message-content" className="textarea" maxLength={2000} value={template.content ?? ""} onChange={(event) => updateTemplate({ content: event.target.value || undefined })} placeholder="Optional text above the embed" /><small>{(template.content?.length ?? 0).toLocaleString()} / 2,000</small></div>
            <div className="form-grid" style={{ marginTop: 18 }}><div className="field"><label htmlFor="embed-title">Embed title</label><input id="embed-title" className="input" maxLength={256} value={template.title ?? ""} onChange={(event) => updateTemplate({ title: event.target.value || undefined })} /></div><div className="field"><label htmlFor="embed-color">Accent color</label><div className="color-input"><input type="color" value={template.color ?? "#D7D2C7"} onChange={(event) => updateTemplate({ color: event.target.value.toUpperCase() })} /><input id="embed-color" className="input" value={template.color ?? "#D7D2C7"} onChange={(event) => updateTemplate({ color: event.target.value })} /></div></div><div className="field full"><label htmlFor="embed-description">Embed description</label><textarea id="embed-description" className="textarea tall" maxLength={4096} value={template.description ?? ""} onChange={(event) => updateTemplate({ description: event.target.value || undefined })} /></div><div className="field full"><label htmlFor="embed-footer">Footer</label><input id="embed-footer" className="input" maxLength={2048} value={template.footer ?? ""} onChange={(event) => updateTemplate({ footer: event.target.value || undefined })} /></div></div>
          </section>
          <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Media</div><h2>Images</h2><p>Use direct HTTPS image URLs. Onyx never fetches or executes uploaded content.</p></div><ImageIcon size={21} /></div><div className="form-grid"><div className="field"><label htmlFor="image-url">Large image URL</label><input id="image-url" className="input" type="url" value={template.imageUrl ?? ""} onChange={(event) => updateTemplate({ imageUrl: event.target.value || undefined })} placeholder="https://…" /></div><div className="field"><label htmlFor="thumb-url">Thumbnail URL</label><input id="thumb-url" className="input" type="url" value={template.thumbnailUrl ?? ""} onChange={(event) => updateTemplate({ thumbnailUrl: event.target.value || undefined })} placeholder="https://…" /></div></div></section>
          {(selected === "welcome" || selected === "goodbye") && <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Delivery</div><h2>Join and leave routing</h2><p>Welcome and goodbye messages can use separate channels.</p></div><Mail size={21} /></div><div className="form-grid"><div className="field"><label htmlFor="welcome-channel">Welcome channel</label><select id="welcome-channel" className="select" value={settings.draft.settings.welcome?.channelId ?? settings.draft.settings.welcomeChannelId ?? ""} onChange={(event) => settings.updateSettings((current) => ({ ...current, welcome: { ...current.welcome, channelId: event.target.value || undefined } }))}><option value="">Do not post</option>{textChannels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div><div className="field"><label htmlFor="goodbye-channel">Goodbye channel</label><select id="goodbye-channel" className="select" value={settings.draft.settings.welcome?.goodbyeChannelId ?? ""} onChange={(event) => settings.updateSettings((current) => ({ ...current, welcome: { ...current.welcome, goodbyeChannelId: event.target.value || undefined } }))}><option value="">Do not post</option>{textChannels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></div></div><label className="check-line standalone"><input type="checkbox" checked={settings.draft.settings.welcome?.directMessage ?? false} onChange={(event) => settings.updateSettings((current) => ({ ...current, welcome: { ...current.welcome, directMessage: event.target.checked } }))} /><span>Also send the welcome message by direct message</span></label></section>}
          <section className="settings-card"><div className="section-title-row"><div><div className="page-kicker">Member arrival</div><h2>Autoroles</h2><p>Human and bot roles can be assigned immediately or through a durable delayed job.</p></div><Users size={21} /></div><div className="form-grid"><div className="field"><label htmlFor="role-delay">Delay (seconds)</label><input id="role-delay" className="input" type="number" min={0} max={86400} value={settings.draft.settings.autoroles?.delaySeconds ?? 0} onChange={(event) => settings.updateSettings((current) => ({ ...current, autoroles: { ...current.autoroles, delaySeconds: Number(event.target.value) } }))} /></div><div className="field"><label htmlFor="account-age">Minimum account age (days)</label><input id="account-age" className="input" type="number" min={0} max={3650} value={settings.draft.settings.autoroles?.minimumAccountAgeDays ?? 0} onChange={(event) => settings.updateSettings((current) => ({ ...current, autoroles: { ...current.autoroles, minimumAccountAgeDays: Number(event.target.value) } }))} /></div></div><div className="split-pickers" style={{ marginTop: 18 }}><div><div className="field-label">Member roles</div><div className="picker-list">{settings.resources?.roles.slice(0,30).map((role) => <label key={role.id}><input type="checkbox" checked={(settings.draft!.settings.autoroles?.memberRoleIds ?? []).includes(role.id)} onChange={() => toggleRole("memberRoleIds", role.id)} /><span>{role.name}</span></label>)}</div></div><div><div className="field-label">Bot roles</div><div className="picker-list">{settings.resources?.roles.slice(0,30).map((role) => <label key={role.id}><input type="checkbox" checked={(settings.draft!.settings.autoroles?.botRoleIds ?? []).includes(role.id)} onChange={() => toggleRole("botRoleIds", role.id)} /><span>{role.name}</span></label>)}</div></div></div></section>
        </div>
        <aside className="side-stack studio-preview-column"><section className="discord-preview large"><div className="preview-label"><Sparkles size={14} /> Live Discord preview</div><div className="discord-message"><div className="preview-avatar">O</div><div className="discord-message-body"><div><strong>Onyx</strong><span className="bot-tag">APP</span><time>Today at 12:42</time></div>{rendered.content && <p>{rendered.content}</p>}{(rendered.title || rendered.description || rendered.footer || template.imageUrl || template.thumbnailUrl) && <div className="embed-preview" style={{ borderLeftColor: template.color ?? "#D7D2C7" }}>{template.thumbnailUrl && <img className="embed-thumb" src={template.thumbnailUrl} alt="" />} {rendered.title && <strong>{rendered.title}</strong>}{rendered.description && <p>{rendered.description}</p>}{template.imageUrl && <img className="embed-image" src={template.imageUrl} alt="" />}{rendered.footer && <small>{rendered.footer}</small>}</div>}</div></div></section><section className="settings-card placeholder-card"><h2>Placeholders</h2><p>Onyx replaces these values safely. Unknown placeholders remain visible instead of executing code.</p><div className="placeholder-cloud">{templatePlaceholders.map((item) => <button type="button" key={item} onClick={() => updateTemplate({ content: `${template.content ?? ""}{${item}}` })}>{`{${item}}`}</button>)}</div></section></aside>
      </div>
      <div className="sticky-save-bar"><div><span className={`save-state-dot ${settings.dirty ? "changed" : "saved"}`} /><strong>{settings.dirty ? "Unsaved message changes" : "Message templates are current"}</strong><small>Previews use sample names; Discord receives live values.</small></div><button className="button primary" disabled={!settings.dirty || settings.saving} onClick={() => void settings.save()}>{settings.saving ? "Saving…" : <><Check size={15} /> Save message studio</>}</button></div>
    </>}
  </DashboardShell>;
}
