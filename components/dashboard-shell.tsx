"use client";

/* eslint-disable @next/next/no-img-element -- Discord CDN avatars are user-provided remote resources. */

import { useState, type ReactNode } from "react";
import { Bot, ChevronDown, FileClock, Gift, Gavel, LayoutDashboard, ListTree, LogOut, Menu, MessageSquareText, MessagesSquare, RadioTower, Scale, Settings, ShieldCheck, Sparkles, TicketCheck, X, Zap } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "./onyx-mark";
import { useSession } from "./session-context";

const navigation = [
  { label: "Command center", items: [
    { key: "overview", label: "Overview", icon: LayoutDashboard, path: "" },
    { key: "commands", label: "Commands", icon: ListTree, path: "/commands" },
    { key: "moderation", label: "Moderation", icon: Gavel, path: "/moderation" },
    { key: "automod", label: "Automod", icon: ShieldCheck, path: "/automod" },
    { key: "message-limits", label: "Message limits", icon: MessageSquareText, path: "/message-limits" },
    { key: "tickets", label: "Tickets", icon: TicketCheck, path: "/tickets" },
  ] },
  { label: "Member experience", items: [
    { key: "messages", label: "Message studio", icon: MessagesSquare, path: "/messages" },
    { key: "levels", label: "Levels", icon: Zap, path: "/levels" },
    { key: "giveaways", label: "Giveaways", icon: Gift, path: "/giveaways" },
    { key: "community", label: "Community", icon: Sparkles, path: "/community" },
  ] },
  { label: "Operations", items: [
    { key: "logs", label: "Discord logs", icon: RadioTower, path: "/logs" },
    { key: "appeals", label: "Appeals", icon: Scale, path: "/appeals" },
    { key: "audit", label: "Audit trail", icon: FileClock, path: "/audit" },
    { key: "settings", label: "Server settings", icon: Settings, path: "/settings" },
  ] },
];

const flatNavigation = navigation.flatMap((section) => section.items);

export function DashboardShell({ guildId, guildName, active, children }: { guildId: string; guildName?: string; active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useSession();
  return (
    <div className="dashboard">
      <aside className={`dashboard-sidebar${open ? " open" : ""}`}>
        <Link href="/"><OnyxMark /></Link>
        <Link className="guild-switcher" href="/dashboard"><span className="guild-avatar">{(guildName ?? "O").slice(0,1).toUpperCase()}</span><span className="guild-switcher-copy"><span className="guild-switcher-name">{guildName ?? "Loading server…"}</span><span className="guild-switcher-label">Switch server</span></span><ChevronDown size={14} /></Link>
        <nav aria-label="Dashboard navigation">{navigation.map((section) => <div className="sidebar-group" key={section.label}><div className="sidebar-section-label">{section.label}</div>{section.items.map(({ key, label, icon: Icon, path }) => <Link className={`sidebar-link${active === key ? " active" : ""}`} href={`/dashboard/${guildId}${path}`} key={key} onClick={() => setOpen(false)}><Icon /><span>{label}</span>{active === key && <span className="active-notch" />}</Link>)}</div>)}</nav>
        <div className="sidebar-bottom"><div className="user-row">{session?.user?.avatarUrl ? <img className="user-avatar" src={session.user.avatarUrl} alt="" /> : <span className="user-avatar" />}<span className="user-name">{session?.user?.displayName ?? session?.user?.username ?? "Discord account"}</span><button className="icon-button" onClick={() => void logout()} aria-label="Sign out"><LogOut size={15} /></button></div></div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X size={18} /> : <Menu size={18} />}</button><div className="breadcrumbs"><span>{guildName ?? "Server"}</span><strong>{flatNavigation.find((item) => item.key === active)?.label ?? "Dashboard"}</strong></div></div><div className="topbar-actions"><Link className="command-jump" href={`/dashboard/${guildId}/commands`}><MessageSquareText size={14} /><span>Find a command</span><kbd>/</kbd></Link><div className="server-state"><span className="live-dot" /><Bot size={13} /> Connected</div></div></header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
