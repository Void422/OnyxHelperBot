import { ArrowRight, Bot, Gavel, Gift, Gauge, Layers3, ShieldCheck, TicketCheck } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "@/components/onyx-mark";

const modules = [
  { icon: Gavel, title: "Moderation with memory", copy: "Cases, warnings, evidence, and timed actions stay organized for the whole staff team." },
  { icon: ShieldCheck, title: "Safety you can tune", copy: "Automod rules use measured thresholds, role and channel exemptions, and accountable actions." },
  { icon: Gift, title: "Giveaways people remember", copy: "Role gates, bonus tickets, winner roles, timed rewards, and a reveal that feels like an event." },
  { icon: Gauge, title: "Ranks worth grinding for", copy: "Build a seven-role ladder with distinct colors, escalating perks, and a finish line members can flex." },
  { icon: TicketCheck, title: "Support that stays tidy", copy: "Ticket ownership, staff access, claims, closure, and transcripts follow one clear workflow." },
  { icon: Layers3, title: "One control plane", copy: "Guild settings, appeals, logs, modules, and audit history live in a dashboard that controls the bot." },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="container site-header-inner">
          <Link href="/" aria-label="Onyx home"><OnyxMark /></Link>
          <nav className="site-nav" aria-label="Primary navigation">
            <a className="nav-link" href="#platform">Platform</a>
            <a className="nav-link" href="#approach">Approach</a>
            <a className="nav-link" href="/appeal">Appeal a decision</a>
            <Link className="button" href="/dashboard">Open dashboard <ArrowRight size={15} /></Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Discord management, considered</div>
            <h1>Your server, under control.</h1>
            <p className="hero-copy">Onyx gives serious Discord teams real control over commands, moderation, tickets, automod, levels, messages, logs, and community programs—without the usual wall of toggles.</p>
            <div className="hero-proof"><span><strong>78</strong> command actions</span><span><strong>9</strong> automod rules</span><span><strong>11</strong> working modules</span></div>
            <div className="hero-actions">
              <a className="button primary" href="/api/auth/discord/login">Continue with Discord <ArrowRight size={16} /></a>
              <a className="button" href="/appeal">Submit an appeal</a>
            </div>
            <div className="quiet-note">No Administrator permission required.</div>
          </div>

          <div className="product-window" aria-label="Onyx dashboard preview">
            <div className="window-bar"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" />onyx / overview</div>
            <div className="window-body">
              <aside className="window-sidebar">
                <div className="window-server">Onyx Community</div>
                {['Overview', 'Commands', 'Moderation', 'Automod', 'Tickets', 'Message studio', 'Discord logs'].map((item, index) => <div key={item} className={`window-nav-row${index === 1 ? ' active' : ''}`}>{item}</div>)}
              </aside>
              <div className="window-main">
                <div className="window-heading">Every command, on your terms.</div>
                <div className="window-sub">Access · cooldowns · rank rewards</div>
                <div className="module-list">
                  {[
                    [Gavel, '/ban', 'Moderation · Ban Members · 3s cooldown'],
                    [ShieldCheck, '/suggest', 'Community · Everyone · 30s cooldown'],
                    [TicketCheck, '/ticket close', 'Tickets · Manage Channels · 2s cooldown'],
                    [Gauge, '/leaderboard', 'Levels · Everyone · 10s cooldown'],
                  ].map(([Icon, name, copy]) => (
                    <div className="module-row" key={String(name)}>
                      <span className="module-icon"><Icon size={15} /></span>
                      <span className="module-meta"><span className="module-name">{String(name)}</span><span className="module-description">{String(copy)}</span></span>
                      <span className="status-dot" aria-label="Enabled" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="platform">
        <div className="container">
          <div className="section-heading"><div className="eyebrow">Everything in its place</div><h2>Serious tools, with the noise edited out.</h2><p>Set up moderation, member ranks, ticket flows, community events, messages, and logs without digging through a wall of toggles.</p></div>
          <div className="feature-grid">{modules.map(({ icon: Icon, title, copy }) => <article className="feature-card" key={title}><Icon size={22} /><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="section" id="approach">
        <div className="container principles">
          <div className="section-heading"><div className="eyebrow">Set it and move on</div><h2>Your server keeps its rhythm.</h2><p>Timed moderation, giveaway reveals, reminders, and role rewards keep their place even when Onyx restarts.</p><Link className="button" href="/dashboard"><Bot size={15} /> Manage your server</Link></div>
          <div className="principle-list">
            <div className="principle"><strong>Your server stays yours</strong><span>Only members with the right Discord access can change its setup.</span></div>
            <div className="principle"><strong>One server at a time</strong><span>Every setting, case, rank, and giveaway belongs to the community that created it.</span></div>
            <div className="principle"><strong>A trail staff can use</strong><span>See who changed what, what it affected, and when it happened.</span></div>
            <div className="principle"><strong>Only the permissions it needs</strong><span>Onyx works without asking for the Administrator switch.</span></div>
          </div>
        </div>
      </section>

      <footer className="site-footer"><div className="container site-footer-inner"><OnyxMark /><span>Built for communities that want capable tools and a quieter interface.</span></div></footer>
    </main>
  );
}
