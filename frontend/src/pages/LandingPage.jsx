import BrandLogo from '../components/BrandLogo.jsx'

const IMAGES = {
  hero: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 900'%3E%3Cdefs%3E%3CradialGradient id='pink' cx='34%25' cy='28%25' r='64%25'%3E%3Cstop offset='0' stop-color='%23ffe3ff' stop-opacity='.95'/%3E%3Cstop offset='.22' stop-color='%23ff5de9' stop-opacity='.88'/%3E%3Cstop offset='.68' stop-color='%239b2cff' stop-opacity='.35'/%3E%3Cstop offset='1' stop-color='%23020a12' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='cyan' cx='32%25' cy='24%25' r='72%25'%3E%3Cstop offset='0' stop-color='%23d9ffff' stop-opacity='.9'/%3E%3Cstop offset='.28' stop-color='%2300f6ff' stop-opacity='.76'/%3E%3Cstop offset='.76' stop-color='%2304ddaa' stop-opacity='.28'/%3E%3Cstop offset='1' stop-color='%23020a12' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='lime' cx='36%25' cy='24%25' r='70%25'%3E%3Cstop offset='0' stop-color='%23f3ffd9' stop-opacity='.9'/%3E%3Cstop offset='.34' stop-color='%23aaff34' stop-opacity='.68'/%3E%3Cstop offset='.82' stop-color='%2302f5a5' stop-opacity='.22'/%3E%3Cstop offset='1' stop-color='%23020a12' stop-opacity='0'/%3E%3C/radialGradient%3E%3Cfilter id='soft'%3E%3CfeGaussianBlur stdDeviation='18'/%3E%3C/filter%3E%3Cfilter id='shadow'%3E%3CfeDropShadow dx='24' dy='26' stdDeviation='18' flood-color='%23000000' flood-opacity='.45'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='900' height='900' fill='none'/%3E%3Cg filter='url(%23shadow)'%3E%3Ccircle cx='300' cy='610' r='230' fill='url(%23pink)'/%3E%3Cellipse cx='604' cy='520' rx='206' ry='244' fill='url(%23cyan)' transform='rotate(-18 604 520)'/%3E%3Cellipse cx='548' cy='236' rx='86' ry='232' fill='url(%23lime)' transform='rotate(20 548 236)'/%3E%3Ccircle cx='726' cy='246' r='96' fill='url(%23pink)' opacity='.52'/%3E%3C/g%3E%3Cg filter='url(%23soft)' opacity='.55'%3E%3Ccircle cx='140' cy='240' r='56' fill='%2300f6ff'/%3E%3Ccircle cx='806' cy='642' r='78' fill='%23ff5de9'/%3E%3Ccircle cx='438' cy='150' r='32' fill='%23aaff34'/%3E%3C/g%3E%3C/svg%3E",
}

const TERMINAL_LINES = [
  'boot.sequence // debatehelp_os',
  'loading: dialectic_core',
  'loading: evidence_harvester',
  'loading: fallacy_scanner',
  'operator: anonymous_scholar',
  'status: resistance_online',
  'target: weak premises',
  'mode: hostile_cross_ex',
  'archive: socrates/mandela/aurelius',
  'signal: sharpen_the_claim',
  'deploy: counterargument_net',
  'ready.',
]

const INTEL_CARDS = [
  {
    code: 'ARG-01',
    title: 'Argument Autopsy',
    body: 'Tear claims into premises, evidence, warrants, impact, and hidden assumptions.',
  },
  {
    code: 'CLASH-02',
    title: 'Rebuttal Generator',
    body: 'Surface the opponent’s cleanest attack before they know they have it.',
  },
  {
    code: 'EV-03',
    title: 'Evidence Strength',
    body: 'Mark weak citations, missing causal links, and unsupported leaps.',
  },
  {
    code: 'DRILL-04',
    title: 'War Room Practice',
    body: 'Run live debate reps with pressure, memory, and coaching feedback.',
  },
]

const DOSSIER_ROWS = [
  ['001', 'Socrates_vs_noise', 'question chains detect contradiction'],
  ['002', 'Mandela_reconcile', 'values frame meets political reality'],
  ['003', 'Aurelius_logic', 'control premises before conclusions'],
]

function LandingPage({ navigateTo }) {
  const startSignup = () => navigateTo('/signup')
  const openLogin = () => navigateTo('/login')

  return (
    <div className="stitch-landing du-landing">
      <div className="du-scanline" aria-hidden="true" />

      <header className="du-topbar">
        <button className="du-brand" type="button" onClick={() => navigateTo('/')}>
          <BrandLogo />
        </button>
        <nav aria-label="Primary navigation">
          <a href="#intel">Analysis</a>
          <a href="#dossier">Strategy</a>
          <a href="#resistance">Vault</a>
          <button type="button" onClick={openLogin}>Sign in</button>
        </nav>
        <div className="du-window-icons" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      <div className="du-shell">
        <aside className="du-rail" aria-label="DebateHelp terminal status">
          <div className="du-rail-panel">
            <p className="du-rail-title">DEBATE_CORE</p>
            <div className="du-terminal-feed">
              {[...TERMINAL_LINES, ...TERMINAL_LINES].map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))}
            </div>
          </div>

          <nav className="du-side-nav" aria-label="System sections">
            <a href="#intel">The Pit</a>
            <a href="#dossier">War Room</a>
            <a href="#resistance">Recruit</a>
          </nav>
        </aside>

        <main className="du-main">
          <section className="du-hero-window" aria-labelledby="landing-title">
            <div className="du-window-bar">
              <span>SYSTEM_INIT</span>
              <b>98%</b>
            </div>
            <div className="du-hero-art">
              <img
                alt=""
                aria-hidden="true"
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
                src={IMAGES.hero}
              />
              <div className="du-hero-copy">
                <p className="du-kicker">Debate mode // logic stable</p>
                <h1 id="landing-title">Master the argument</h1>
                <p>
                  Pressure-test claims, organize evidence, and build confident rebuttals with a focused AI debate workspace.
                </p>
                <div className="du-hero-actions">
                  <button className="du-button primary" type="button" onClick={startSignup}>
                    Start training
                  </button>
                  <a className="du-button secondary" href="#intel">
                    Explore tools
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="du-grid-section" id="intel">
            <div className="du-section-heading">
              <p>001 / INTEL</p>
              <h2>Strategic_Intel</h2>
            </div>

            <div className="du-intel-grid">
              {INTEL_CARDS.map((card) => (
                <article className="du-intel-card" key={card.code}>
                  <span>{card.code}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
              <aside className="du-protocol-card">
                <p>TACTICAL_TYPE</p>
                <strong>CLAIM</strong>
                <strong>EVIDENCE</strong>
                <strong>REBUTTAL</strong>
                <span>System note: every argument is reviewed for structure, proof, and counterplay.</span>
              </aside>
            </div>
          </section>

          <section className="du-dossier" id="dossier">
            <div className="du-dossier-search">/ archive.query: philosophers/counter_logic</div>
            {DOSSIER_ROWS.map(([id, file, note]) => (
              <div className="du-dossier-row" key={id}>
                <span>{id}</span>
                <strong>{file}</strong>
                <p>{note}</p>
              </div>
            ))}
          </section>

          <section className="du-resistance" id="resistance">
            <span className="du-sticker">ACCESS_GRANTED</span>
            <h2>Join the workspace</h2>
            <p>
              Enter the vault, train your reasoning, and turn every debate into a sharp, evidence-backed operation.
            </p>
            <button className="du-button primary" type="button" onClick={startSignup}>
              Create operator
            </button>
          </section>
        </main>
      </div>

      <footer className="du-footer">
        <BrandLogo size="sm" />
        <span>Debate workspace active © 2026</span>
      </footer>
    </div>
  )
}

export default LandingPage
