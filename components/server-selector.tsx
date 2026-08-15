"use client";

/* eslint-disable @next/next/no-img-element -- Discord CDN guild icons are user-provided remote resources. */

import { ArrowRight, Bot, CheckCircle2, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "./onyx-mark";
import { useSession } from "./session-context";
import { useApi } from "./use-api";

interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botInstalled: boolean;
}

function inviteFor(base: string, guildId: string) {
  const url = new URL(base);
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");
  return url.toString();
}

export function ServerSelector() {
  const { session, loading: sessionLoading, logout } = useSession();
  const { data, loading, error } = useApi<{ guilds: GuildSummary[] }>(session?.authenticated ? "/api/guilds" : null);

  if (sessionLoading) return <div className="auth-screen"><div className="auth-card"><div className="skeleton" /><div className="skeleton" style={{ marginTop: 10 }} /></div></div>;
  if (!session?.configured) {
    return <div className="auth-screen"><div className="auth-card"><OnyxMark /><h1>Finish the Discord connection</h1><p>The dashboard is built and ready. Add the application values below through the host&apos;s environment settings, then reload this page.</p><ul className="setup-list"><li>DISCORD_CLIENT_ID</li><li>DISCORD_CLIENT_SECRET</li><li>SESSION_SECRET</li><li>APP_URL</li></ul><Link className="button" href="/">Back to Onyx</Link></div></div>;
  }
  if (!session.authenticated) {
    return <div className="auth-screen"><div className="auth-card"><OnyxMark /><h1>Choose a server to manage</h1><p>Sign in with Discord. Onyx only shows servers where your account has Manage Server or Administrator.</p><a className="button primary" href="/api/auth/discord/login">Continue with Discord <ArrowRight size={16} /></a><Link className="button ghost" href="/">Back to home</Link></div></div>;
  }
  return (
    <main className="selector-page">
      <div className="container">
        <div className="selector-head"><Link href="/"><OnyxMark /></Link><button className="button ghost" onClick={() => void logout()}><LogOut size={15} /> Sign out</button></div>
        <div className="selector-title"><div className="eyebrow">Your servers</div><h1>Where are we working?</h1><p>Only servers you can manage are shown here.</p></div>
        {error && <div className="error-banner" style={{ marginTop: 24 }}>{error}</div>}
        {loading ? <div className="server-grid" style={{ marginTop: 34 }}>{[0,1,2].map((item) => <div className="skeleton" style={{ minHeight: 220 }} key={item} />)}</div> : data?.guilds.length ? (
          <div className="server-grid" style={{ marginTop: 34 }}>
            {data.guilds.map((guild) => (
              <article className="server-card" key={guild.id}>
                <div className="server-icon">{guild.iconUrl ? <img src={guild.iconUrl} alt="" /> : guild.name.slice(0, 1).toLocaleUpperCase()}</div>
                <h2>{guild.name}</h2>
                <div className="server-state">{guild.botInstalled ? <><CheckCircle2 size={13} /> Onyx is installed</> : <><Bot size={13} /> Ready to add Onyx</>}</div>
                {guild.botInstalled ? <Link className="button primary" href={`/dashboard/${guild.id}`}>Manage server <ArrowRight size={15} /></Link> : session.inviteUrl ? <a className="button" href={inviteFor(session.inviteUrl, guild.id)}><Plus size={15} /> Add Onyx</a> : null}
              </article>
            ))}
          </div>
        ) : <div className="panel" style={{ marginTop: 34 }}><div className="empty-state"><Bot size={24} /><strong>No manageable servers found</strong><span>Discord did not return a server where this account can manage settings.</span></div></div>}
      </div>
    </main>
  );
}
