"use client";

import { Gift } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { formatApiDate, useApi } from "./use-api";

interface Giveaway { id: string; prize: string; status: string; channelId: string; hostUserId: string; winnerCount: number; endsAt: string; eligibleEntryCount: number | null; winnerUserIds: string[] }
export function GiveawaysPage({ guildId }: { guildId: string }) {
  const settings = useApi<{ guild: { name: string } }>(`/api/guilds/${guildId}/settings`); const result = useApi<{ giveaways: Giveaway[] }>(`/api/guilds/${guildId}/giveaways`);
  return <DashboardShell guildId={guildId} guildName={settings.data?.guild.name} active="giveaways"><div className="page-heading"><div><h1>Giveaways</h1><p>Every row is backed by stored entries and a durable end time.</p></div><span className="button">Create with <code>/giveaway create</code></span></div>{result.error && <div className="error-banner">{result.error}</div>}<section className="panel">{result.loading ? <div className="panel-body loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : result.data?.giveaways.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Prize</th><th>Status</th><th>Winners</th><th>Eligible entries</th><th>Ends</th></tr></thead><tbody>{result.data.giveaways.map((item) => <tr key={item.id}><td><strong>{item.prize}</strong><div className="activity-meta">Channel {item.channelId}</div></td><td><span className={`badge ${item.status}`}>{item.status}</span></td><td>{item.winnerUserIds.length ? item.winnerUserIds.map((id) => <code key={id} style={{ display: "block" }}>{id}</code>) : item.winnerCount}</td><td>{item.eligibleEntryCount ?? "—"}</td><td>{formatApiDate(item.endsAt)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Gift size={22} /><strong>No giveaways yet</strong><span>Create one from Discord. It will appear here as soon as the message is posted.</span></div>}</section></DashboardShell>;
}
