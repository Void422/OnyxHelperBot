"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LogOut, Scale } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "./onyx-mark";
import { useSession } from "./session-context";
import { formatApiDate, useApi } from "./use-api";

interface AppealData {
  eligible: Array<{ caseId: string; caseNumber: number; guildName: string; action: string; reason: string }>;
  appeals: Array<{ id: string; status: string; decisionReason: string | null; updatedAt: string }>;
}

export function AppealPage() {
  const { session, loading: sessionLoading, logout } = useSession();
  const result = useApi<AppealData>(session?.authenticated ? "/api/appeals" : null);
  const [caseId, setCaseId] = useState("");
  const [statement, setStatement] = useState("");
  const [context, setContext] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const selectedCaseId = caseId || result.data?.eligible[0]?.caseId || "";
  const selectedCase = result.data?.eligible.find((item) => item.caseId === selectedCaseId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.csrfToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/appeals", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-onyx-csrf": session.csrfToken },
        body: JSON.stringify({ caseId: selectedCaseId, statement, context: context || undefined, acknowledged }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Onyx could not submit this appeal.");
      setMessage({ kind: "success", text: "Your appeal has been sent to the server's staff team." });
      setStatement("");
      setContext("");
      setAcknowledged(false);
      await result.refresh();
    } catch (caught) {
      setMessage({ kind: "error", text: caught instanceof Error ? caught.message : "Onyx could not submit this appeal." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="appeal-page">
      <div className="container">
        <header className="appeal-header">
          <Link href="/"><OnyxMark /></Link>
          {session?.authenticated && <button className="button ghost" onClick={() => void logout()}><LogOut size={14} /> Sign out</button>}
        </header>

        {sessionLoading ? (
          <div className="appeal-grid"><div className="skeleton" style={{ minHeight: 260 }} /><div className="skeleton" style={{ minHeight: 460 }} /></div>
        ) : !session?.configured ? (
          <div className="auth-screen" style={{ minHeight: "auto" }}><div className="auth-card"><OnyxMark /><h1>Appeals need the Discord connection</h1><p>Configure Discord OAuth for this deployment before accepting submissions.</p></div></div>
        ) : !session.authenticated ? (
          <div className="appeal-grid">
            <div className="appeal-copy"><div className="eyebrow">A fair way back</div><h1>Appeal a moderation decision.</h1><p>Sign in with Discord to see eligible actions connected to your account. Internal staff notes are never shown here.</p><p>Your statement goes to the server&apos;s staff team. Onyx does not decide the outcome automatically.</p></div>
            <div className="appeal-form"><Scale size={24} /><h2>Start with Discord</h2><p>This confirms the account connected to the moderation action.</p><a className="button primary" href="/api/auth/discord/login?returnTo=%2Fappeal">Continue with Discord <ArrowRight size={15} /></a></div>
          </div>
        ) : (
          <div className="appeal-grid">
            <div className="appeal-copy">
              <div className="eyebrow">Appeals</div><h1>A clear path to reconsideration.</h1><p>Choose an eligible action and explain what you would like the staff team to reconsider. Be specific, honest, and concise.</p>
              {result.data?.appeals.length ? <div className="settings-card" style={{ marginTop: 30 }}><h2>Your submitted appeals</h2><div className="activity-list">{result.data.appeals.map((appeal) => <div className="activity-row" key={appeal.id}><div><span className={`badge ${appeal.status}`}>{appeal.status.replace(/_/g," ")}</span>{appeal.decisionReason && <div className="activity-meta" style={{ marginTop: 7 }}>{appeal.decisionReason}</div>}</div><span className="activity-time">{formatApiDate(appeal.updatedAt)}</span></div>)}</div></div> : null}
            </div>
            <form className="appeal-form" onSubmit={(event) => void submit(event)}>
              <h2>Submit an appeal</h2><p>Only active, eligible moderation actions appear here.</p>
              {result.error && <div className="error-banner">{result.error}</div>}
              {message && <div className={message.kind === "success" ? "success-banner" : "error-banner"}>{message.text}</div>}
              {result.loading ? <div className="loading-stack"><div className="skeleton" /><div className="skeleton" /></div> : result.data?.eligible.length ? <>
                <div className="field"><label htmlFor="appeal-case">Moderation action</label><select id="appeal-case" className="select" value={selectedCaseId} onChange={(event) => setCaseId(event.target.value)}>{result.data.eligible.map((item) => <option value={item.caseId} key={item.caseId}>{item.guildName} · Case #{item.caseNumber} · {item.action}</option>)}</select></div>
                {selectedCase && <div className="panel-body" style={{ background: "#111113", borderRadius: 10, marginBottom: 16 }}><strong style={{ fontSize: 12 }}>Recorded reason</strong><p style={{ color: "#92929a", fontSize: 12, lineHeight: 1.55 }}>{selectedCase.reason}</p></div>}
                <div className="field"><label htmlFor="appeal-statement">Why should this be reconsidered?</label><textarea id="appeal-statement" className="textarea" minLength={40} maxLength={4000} required value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Explain what happened, what has changed, and why you are asking the staff team to reconsider." /><small>{statement.length} / 4,000 characters</small></div>
                <div className="field"><label htmlFor="appeal-context">Additional context (optional)</label><textarea id="appeal-context" className="textarea" maxLength={2000} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Add any context that does not fit above." /></div>
                <label className="checkbox-row"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} required /><span>I understand that the server&apos;s staff team makes the final decision and that submitting duplicate appeals may delay review.</span></label>
                <button className="button primary" style={{ width: "100%", marginTop: 18 }} disabled={saving || statement.length < 40 || !acknowledged}>{saving ? "Submitting…" : "Submit appeal"}</button>
              </> : <div className="empty-state"><Scale size={22} /><strong>No eligible actions found</strong><span>There is no active moderation action attached to this Discord account that can be appealed right now.</span></div>}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
