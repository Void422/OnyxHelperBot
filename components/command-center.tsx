"use client";

import { useMemo, useState } from "react";
import { Check, Command, RotateCcw, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { commandCatalogEntries } from "@/packages/core/src/command-catalog";
import { DashboardShell } from "./dashboard-shell";
import { useGuildSettings } from "./use-guild-settings";

const categories = ["All", ...new Set(commandCatalogEntries.map((entry) => entry.category))];

export function CommandCenter({ guildId }: { guildId: string }) {
  const settings = useGuildSettings(guildId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const overrides = settings.draft?.settings.commandOverrides ?? {};
  const visible = useMemo(() => commandCatalogEntries.filter((entry) => {
    const search = `${entry.command} ${entry.description} ${entry.category} ${entry.permission}`.toLocaleLowerCase();
    return (category === "All" || entry.category === category) && search.includes(query.trim().toLocaleLowerCase());
  }), [category, query]);
  const disabledCount = commandCatalogEntries.filter((entry) => overrides[entry.key]?.enabled === false).length;

  const updateOverride = (key: string, patch: { enabled?: boolean; cooldownSeconds?: number }) => settings.updateSettings((current) => ({
    ...current,
    commandOverrides: { ...current.commandOverrides, [key]: { ...current.commandOverrides?.[key], ...patch } },
  }));
  const resetOverride = (key: string) => settings.updateSettings((current) => {
    const next = { ...current.commandOverrides };
    delete next[key];
    return { ...current, commandOverrides: next };
  });

  return (
    <DashboardShell guildId={guildId} guildName={settings.guildName} active="commands">
      <div className="page-heading command-heading"><div><div className="page-kicker"><Command size={14} /> Command center</div><h1>Every command, on your terms.</h1><p>Search the live catalog, disable individual actions, and tune cooldowns without touching the bot’s source.</p></div><div className="heading-stat"><strong>{commandCatalogEntries.length}</strong><span>working command actions</span></div></div>
      {settings.error && <div className="error-banner">{settings.error}</div>}
      {settings.message && <div className={settings.message.kind === "success" ? "success-banner" : "error-banner"}>{settings.message.text}</div>}
      <section className="command-toolbar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands, permissions, or modules…" aria-label="Search commands" /></label>
        <div className="filter-pills" aria-label="Command categories">{categories.map((item) => <button type="button" key={item} className={`filter-pill${category === item ? " active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
      </section>
      {settings.loading ? <div className="loading-stack">{[0,1,2,3].map((item) => <div className="skeleton" key={item} />)}</div> : <>
        <div className="command-summary-strip"><span><ShieldCheck size={15} /> Discord permissions still apply</span><span><SlidersHorizontal size={15} /> {disabledCount ? `${disabledCount} disabled` : "All commands available"}</span><span>{visible.length} shown</span></div>
        <div className="command-list">
          {visible.map((entry) => {
            const override = overrides[entry.key];
            const enabled = override?.enabled !== false;
            const cooldown = override?.cooldownSeconds ?? entry.defaultCooldownSeconds ?? 0;
            return <article className={`command-row-card${enabled ? "" : " disabled"}`} key={entry.key}>
              <div className="command-identity"><code>{entry.command}</code><div><h2>{entry.description}</h2><div className="command-meta"><span>{entry.category}</span><span>{entry.permission}</span>{entry.module && <span>{entry.module.replace(/_/g, " ")} module</span>}</div></div></div>
              <div className="command-controls">
                <label className="compact-field"><span>Cooldown</span><div><input type="number" min={0} max={3600} value={cooldown} onChange={(event) => updateOverride(entry.key, { cooldownSeconds: Number(event.target.value) })} /><em>sec</em></div></label>
                <label className="switch-control"><input type="checkbox" checked={enabled} onChange={(event) => updateOverride(entry.key, { enabled: event.target.checked })} /><span aria-hidden="true" /><b>{enabled ? "On" : "Off"}</b></label>
                <button className="icon-button" type="button" onClick={() => resetOverride(entry.key)} disabled={!override} aria-label={`Reset ${entry.command}`} title="Use defaults"><RotateCcw size={15} /></button>
              </div>
            </article>;
          })}
        </div>
        {!visible.length && <div className="empty-state panel"><Search size={22} /><strong>No commands match that search</strong><span>Try a command name, permission, or another category.</span></div>}
        <div className="sticky-save-bar"><div><span className={`save-state-dot ${settings.dirty ? "changed" : "saved"}`} /><strong>{settings.dirty ? "Unsaved command changes" : "Command settings are current"}</strong><small>Changes remain permission- and module-aware.</small></div><button className="button primary" disabled={!settings.dirty || settings.saving} onClick={() => void settings.save()}>{settings.saving ? "Saving…" : <><Check size={15} /> Save command settings</>}</button></div>
      </>}
    </DashboardShell>
  );
}
