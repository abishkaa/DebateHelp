const IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida/AP1WRLvaz1UdLGRKFKUM_n7ELs2Q4GTYHnNJXFHW_FykJgWQZCXRNeY-vrQ4dAaDxSQtWGcVulAxvcm6R_4gOVRE4NMjS2lSiuQMxD0j30kC4sdalctHHqHweBiLE72pr8DFw0h6Xrj2IUFn_493ykYBxPD7lbPBBCnPbr21ueD-MA-xzoj5D7AGVrX7-a_iwXxaPtyMCij2oVI8sFcCnXNjbkHiBdiSJ69ZyJrGGjoLE4sli4JVbY6pDuGwHno',
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
          DEBATEHELP_OS
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
                alt="Glossy neon 3D shapes floating through a charcoal interface"
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
        <strong>DEBATEHELP</strong>
        <span>Debate workspace active © 2026</span>
      </footer>
    </div>
  )
}

export default LandingPage
