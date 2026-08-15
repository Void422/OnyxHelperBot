"use client";

/* eslint-disable @next/next/no-img-element -- Discord CDN avatars are user-provided remote resources. */

import { useState, type ReactNode } from "react";
import { Activity, ChevronDown, FileClock, Gift, Gavel, LayoutDashboard, LogOut, Menu, Scale, Settings, X } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "./onyx-mark";
import { useSession } from "./session-context";

const navigation = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, path: "" },
  { key: "moderation", label: "Moderation", icon: Gavel, path: "/moderation" },
  { key: "appeals", label: "Appeals", icon: Scale, path: "/appeals" },
  { key: "giveaways", label: "Giveaways", icon: Gift, path: "/giveaways" },
  { key: "audit", label: "Audit log", icon: FileClock, path: "/audit" },
  { key: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

export function DashboardShell({ guildId, guildName, active, children }: { guildId: string; guildName?: string; active: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useSession();
  return (
    <div className="dashboard">
      <aside className={`dashboard-sidebar${open ? " open" : ""}`}>
        <Link href="/"><OnyxMark /></Link>
        <Link className="guild-switcher" href="/dashboard"><span className="guild-avatar">{(guildName ?? "O").slice(0,1).toUpperCase()}</span><span className="guild-switcher-copy"><span className="guild-switcher-name">{guildName ?? "Loading server…"}</span><span className="guild-switcher-label">Switch server</span></span><ChevronDown size={14} /></Link>
        <div className="sidebar-section-label">Workspace</div>
        <nav aria-label="Dashboard navigation">
          {navigation.map(({ key, label, icon: Icon, path }) => <Link className={`sidebar-link${active === key ? " active" : ""}`} href={`/dashboard/${guildId}${path}`} key={key} onClick={() => setOpen(false)}><Icon />{label}</Link>)}
        </nav>
        <div className="sidebar-bottom"><div className="user-row">{session?.user?.avatarUrl ? <img className="user-avatar" src={session.user.avatarUrl} alt="" /> : <span className="user-avatar" />}<span className="user-name">{session?.user?.displayName ?? session?.user?.username ?? "Discord account"}</span><button className="icon-button" onClick={() => void logout()} aria-label="Sign out"><LogOut size={15} /></button></div></div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"}>{open ? <X size={18} /> : <Menu size={18} />}</button><div className="breadcrumbs"><span>{guildName ?? "Server"}</span> / <strong>{navigation.find((item) => item.key === active)?.label ?? "Dashboard"}</strong></div></div><div className="server-state"><Activity size={13} /> Bot configuration</div></header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
