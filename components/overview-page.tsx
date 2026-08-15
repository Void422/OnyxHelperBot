"use client";

import { Activity, FileQuestion, Gift, Gavel, Inbox, MessagesSquare, Users } from "lucide-react";
import { DashboardShell } from "./dashboard-shell";
import { formatApiDate, useApi } from "./use-api";

interface OverviewData {
  guild: { id: string; name: string; memberCount: number };
  modules: string[];
  stats: { moderationActions30d: number; pendingAppeals: number; activeGiveaways: number; openTickets: number; activeLevelMembers30d: number };
  recentActivity: Array<{ id: string; action: string; actorUserId: string; createdAt: string; targetType: string }>;
}

export function OverviewPage({ guildId }: { guildId: string }) {
  const { data, loading, error } = useApi<OverviewData>(`/api/guilds/${guildId}/overview`);
  const metrics = data ? [
    [Gavel, data.stats.moderationActions30d, "Moderation actions · 30 days"],
    [FileQuestion, data.stats.pendingAppeals, "Appeals awaiting resolution"],
    [Gift, data.stats.activeGiveaways, "Running giveaways"],
    [Inbox, data.stats.openTickets, "Open support tickets"],
    [Users, data.stats.activeLevelMembers30d, "Members earning XP · 30 days"],
  ] as const : [];
  return (
    <DashboardShell guildId={guildId} guildName={data?.guild.name} active="overview">
      <div className="page-heading"><div><h1>Overview</h1><p>The current state of your server’s Onyx modules—no sample data, no inflated totals.</p></div><a className="button" href={`/dashboard/${guildId}/settings`}>Review settings</a></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="loading-stack">{[0,1,2].map((item) => <div className="skeleton" key={item} />)}</div> : data && <>
        <section className="metric-grid">{metrics.map(([Icon, value, label]) => <article className="metric-card" key={label}><Icon className="metric-icon" size={17} /><div className="metric-value">{value.toLocaleString()}</div><div className="metric-label">{label}</div></article>)}</section>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-header"><h2>Recent configuration activity</h2><a className="nav-link" href={`/dashboard/${guildId}/audit`}>View audit log</a></div><div className="panel-body">{data.recentActivity.length ? <div className="activity-list">{data.recentActivity.map((event) => <div className="activity-row" key={event.id}><div><div className="activity-action">{event.action.replace(/[._]/g, " ")}</div><div className="activity-meta">{event.targetType} · actor {event.actorUserId}</div></div><div className="activity-time">{formatApiDate(event.createdAt)}</div></div>)}</div> : <div className="empty-state"><Activity size={22} /><strong>No configuration changes yet</strong><span>Changes made from the dashboard or bot will appear here.</span></div>}</div></section>
          <section className="panel"><div className="panel-header"><h2>Enabled modules</h2></div><div className="panel-body">{data.modules.length ? <div className="module-chips">{data.modules.map((module) => <span className="chip" key={module}>{module.replace(/_/g, " ")}</span>)}</div> : <div className="empty-state"><MessagesSquare size={22} /><strong>No modules enabled</strong><span>Open settings to choose what Onyx should run in this server.</span></div>}</div></section>
        </div>
      </>}
    </DashboardShell>
  );
}
