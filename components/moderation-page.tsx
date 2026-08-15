"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { formatApiDate, useApi } from "./use-api";

interface CaseRecord { id: string; caseNumber: number; targetUserId: string; moderatorUserId: string; action: string; reason: string; active: boolean; automated: boolean; createdAt: string; expiresAt: string | null }

export function ModerationPage({ guildId }: { guildId: string }) {
  const [user, setUser] = useState(""); const [action, setAction] = useState(""); const [query, setQuery] = useState("");
  const settings = useApi<{ guild: { name: string } }>(`/api/guilds/${guildId}/settings`);
  const cases = useApi<{ cases: CaseRecord[]; hasMore: boolean }>(`/api/guilds/${guildId}/cases${query}`);
  const search = () => { const params = new URLSearchParams(); if (user.trim()) params.set("user", user.trim()); if (action) params.set("action", action); setQuery(params.size ? `?${params}` : ""); };
  return <DashboardShell guildId={guildId} guildName={settings.data?.guild.name} active="moderation">
    <div className="page-heading"><div><h1>Moderation</h1><p>Guild-scoped cases for staff actions and automated enforcement.</p></div></div>
    <section className="settings-card" style={{ marginBottom: 14 }}><div className="form-grid"><div className="field"><label htmlFor="case-user">Member ID</label><input id="case-user" className="input" value={user} onChange={(event) => setUser(event.target.value)} placeholder="Discord user ID" /></div><div className="field"><label htmlFor="case-action">Action</label><select id="case-action" className="select" value={action} onChange={(event) => setAction(event.target.value)}><option value="">All actions</option><option value="ban">Bans</option><option value="kick">Kicks</option><option value="warn">Warnings</option><option value="timeout">Timeouts</option><option value="automod">Automod</option></select></div></div><button className="button" style={{ marginTop: 14 }} onClick={search}><Search size={14} /> Filter cases</button></section>
    {cases.error && <div className="error-banner">{cases.error}</div>}
    <section className="panel"><div className="panel-header"><h2>Cases</h2></div>{cases.loading ? <div className="panel-body loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : cases.data?.cases.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Case</th><th>Action</th><th>Member</th><th>Reason</th><th>Moderator</th><th>Date</th></tr></thead><tbody>{cases.data.cases.map((item) => <tr key={item.id}><td><strong>#{item.caseNumber}</strong></td><td><span className="badge">{item.action.replace(/_/g," ")}</span>{item.automated && <div className="activity-meta">Automated</div>}</td><td><code>{item.targetUserId}</code></td><td>{item.reason}</td><td><code>{item.moderatorUserId}</code></td><td>{formatApiDate(item.createdAt)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Search size={22} /><strong>No cases found</strong><span>Try a different filter, or check back after the first moderation action.</span></div>}</section>
  </DashboardShell>;
}
