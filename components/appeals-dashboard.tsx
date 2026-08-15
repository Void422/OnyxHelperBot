"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { useSession } from "./session-context";
import { formatApiDate, useApi } from "./use-api";

interface AppealRow { appeal: { id: string; status: string; statement: string; context: string | null; appellantUserId: string; reviewerUserId: string | null; createdAt: string }; moderationCase: { caseNumber: number; action: string; reason: string; targetUserId: string } }

function AppealDecision({ guildId, row, onSaved }: { guildId: string; row: AppealRow; onSaved(): void }) {
  const { session } = useSession(); const [reason, setReason] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const decide = async (status: "reviewing" | "accepted" | "denied", unban = false) => {
    if (!session?.csrfToken) return; setSaving(true); setError("");
    try { const response = await fetch(`/api/guilds/${guildId}/appeals/${row.appeal.id}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken }, body: JSON.stringify({ status, decisionReason: reason || undefined, unban }) }); const body = (await response.json()) as { error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "The appeal could not be updated."); onSaved(); } catch (caught) { setError(caught instanceof Error ? caught.message : "The appeal could not be updated."); } finally { setSaving(false); }
  };
  return <div style={{ marginTop: 16 }}><div className="field"><label htmlFor={`decision-${row.appeal.id}`}>Decision note</label><textarea id={`decision-${row.appeal.id}`} className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Keep the reasoning clear and respectful." /></div>{error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}><button className="button" disabled={saving} onClick={() => void decide("reviewing")}>Mark reviewing</button><button className="button primary" disabled={saving || reason.length < 10} onClick={() => void decide("accepted")}>Accept</button><button className="button" disabled={saving || reason.length < 10} onClick={() => void decide("accepted", true)}>Accept and unban</button><button className="button danger" disabled={saving || reason.length < 10} onClick={() => void decide("denied")}>Deny</button></div></div>;
}

export function AppealsDashboard({ guildId }: { guildId: string }) {
  const settings = useApi<{ guild: { name: string } }>(`/api/guilds/${guildId}/settings`); const result = useApi<{ appeals: AppealRow[] }>(`/api/guilds/${guildId}/appeals`);
  return <DashboardShell guildId={guildId} guildName={settings.data?.guild.name} active="appeals"><div className="page-heading"><div><h1>Appeals</h1><p>Review the relevant case and appellant statement without exposing internal moderator notes.</p></div></div>{result.error && <div className="error-banner">{result.error}</div>}{result.loading ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : result.data?.appeals.length ? <div className="loading-stack">{result.data.appeals.map((row) => <article className="settings-card" key={row.appeal.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}><div><span className={`badge ${row.appeal.status}`}>{row.appeal.status.replace(/_/g," ")}</span><h2 style={{ marginTop: 12 }}>Case #{row.moderationCase.caseNumber} · {row.moderationCase.action}</h2></div><span className="activity-time">{formatApiDate(row.appeal.createdAt)}</span></div><p><strong>Case reason:</strong> {row.moderationCase.reason}</p><div className="panel-body" style={{ padding: 16, background: "#111113", borderRadius: 10 }}><strong style={{ fontSize: 12 }}>Appellant statement</strong><p style={{ color: "#b8b8be", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{row.appeal.statement}</p>{row.appeal.context && <p style={{ color: "#898991", whiteSpace: "pre-wrap" }}>{row.appeal.context}</p>}</div><AppealDecision guildId={guildId} row={row} onSaved={() => void result.refresh()} /></article>)}</div> : <div className="panel"><div className="empty-state"><Scale size={22} /><strong>No appeals need attention</strong><span>New submissions from the public appeal page will appear here.</span></div></div>}</DashboardShell>;
}
