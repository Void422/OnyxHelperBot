import { ArrowRight, Bot, Gavel, Gift, Gauge, Layers3, ShieldCheck, TicketCheck } from "lucide-react";
import Link from "next/link";
import { OnyxMark } from "@/components/onyx-mark";

const modules = [
  { icon: Gavel, title: "Moderation with memory", copy: "Cases, warnings, evidence, and temporary actions stay organized and survive every restart." },
  { icon: ShieldCheck, title: "Safety you can tune", copy: "Automod rules use measured thresholds, role and channel exemptions, and accountable actions." },
  { icon: Gift, title: "Fair giveaways", copy: "Eligibility is checked on the server. Entries are durable, weighted transparently, and selected once." },
  { icon: Gauge, title: "Participation, not spam", copy: "XP cooldowns, duplicate detection, and low-signal filtering reward real conversation." },
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
            <p className="hero-copy">Onyx brings moderation, appeals, giveaways, levels, tickets, and safety tools into one calm dashboard—without turning your community into a control panel.</p>
            <div className="hero-actions">
              <a className="button primary" href="/api/auth/discord/login">Continue with Discord <ArrowRight size={16} /></a>
              <a className="button" href="/appeal">Submit an appeal</a>
            </div>
            <div className="quiet-note">Discord permissions remain the authority. Onyx never asks for Administrator.</div>
          </div>

          <div className="product-window" aria-label="Onyx dashboard preview">
            <div className="window-bar"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" />onyx / overview</div>
            <div className="window-body">
              <aside className="window-sidebar">
                <div className="window-server">Onyx Community</div>
                {['Overview', 'Moderation', 'Automod', 'Appeals', 'Giveaways', 'Levels', 'Audit log'].map((item, index) => <div key={item} className={`window-nav-row${index === 0 ? ' active' : ''}`}>{item}</div>)}
              </aside>
              <div className="window-main">
                <div className="window-heading">Everything important, in one place.</div>
                <div className="window-sub">Live configuration · permission-aware · guild scoped</div>
                <div className="module-list">
                  {[
                    [Gavel, 'Moderation', 'Cases, warnings, temporary actions'],
                    [ShieldCheck, 'Automod', 'Measured rules and exemptions'],
                    [Gift, 'Giveaways', 'Eligibility checked server-side'],
                    [Gauge, 'Levels', 'Participation with anti-spam'],
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
          <div className="section-heading"><div className="eyebrow">A complete control plane</div><h2>Serious tools, with the noise edited out.</h2><p>Every module is designed around the work staff actually do. Settings save to durable storage, Discord actions are checked at execution time, and empty states tell the truth.</p></div>
          <div className="feature-grid">{modules.map(({ icon: Icon, title, copy }) => <article className="feature-card" key={title}><Icon size={22} /><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="section" id="approach">
        <div className="container principles">
          <div className="section-heading"><div className="eyebrow">Built to stay running</div><h2>Restarting the bot should be boring.</h2><p>Temporary bans, timeouts, giveaway endings, and reminders are persisted and leased before processing. A process restart pauses the work; it does not erase it.</p><Link className="button" href="/dashboard"><Bot size={15} /> Manage your server</Link></div>
          <div className="principle-list">
            <div className="principle"><strong>Backend authority</strong><span>Every sensitive request rechecks identity, guild permission, validation, and CSRF server-side.</span></div>
            <div className="principle"><strong>Scoped by design</strong><span>Every record carries its guild boundary. Navigating to another guild ID does not grant access.</span></div>
            <div className="principle"><strong>Useful audit history</strong><span>Configuration and workflow changes record the actor, target, before and after state, and time.</span></div>
            <div className="principle"><strong>Deliberate permissions</strong><span>Onyx asks only for the Discord permissions its implemented modules need.</span></div>
          </div>
        </div>
      </section>

      <footer className="site-footer"><div className="container site-footer-inner"><OnyxMark /><span>Built for communities that want capable tools and a quieter interface.</span></div></footer>
    </main>
  );
}
