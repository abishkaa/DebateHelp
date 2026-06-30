const AUTH_VARIANTS = {
  login: {
    image: 'https://lh3.googleusercontent.com/aida/AP1WRLtg2pbKy7cUKo8oUj08Bqbp2Ownl-SmfGaw_wK07wdtEMRtgyEHqjzS3s9h1xCHgg3izQ8oWJvItF0YDPFYdI_uSpp_E-6PxzjNdqMtBXjsrWxsVa_VAVW27TXN3Jw429td_VKaznwBAHWUghsA5eOTiMOkR6mEtKf8w-YZ3fdoO5Whk7FmMGQZiUt9wROomeujJh9f7ADsyMiwOA1gjBNCEGz5DZEZg78P11VlHh1BB1GgDGjysYnINpA',
    heroTitle: 'Enter the Chaos.',
    heroText: 'Reconnect to your debate terminal, battle logs, and neon logic engine.',
    quote: "Access your scholar's vault.",
  },
  signup: {
    image: 'https://lh3.googleusercontent.com/aida/AP1WRLueLl1HIMvt5UiiOP5py7JB9M3f_7q_-F84q21Ao-elL7qGbtvb6qQl7-3vBfcFatgWAQK5EmUtQGZ1YdFdXKIQb6f6KojZ5Mp0gt4NxARANuhAWE9oa0ka2t9udQuQDZhre6csE5Yaqk3xfqorC_zwdPGp7n5jPAJgYGzb0t6jnNf5q_2ZM8757bvvhTEgo5FjDREs7NnL69fWMpPZppba3wwkr8Hfu1JnBZ3RVbHMZFwu_E-06yN0Y5g',
    heroTitle: 'Join the Riot.',
    heroText: 'Build a vault for cases, counters, evidence, and battlefield-ready rhetoric.',
    quote: 'Curiosity has its own party mode.',
  },
  setup: {
    image: 'https://lh3.googleusercontent.com/aida/AP1WRLvaEWsOyHzVGcbb2z7sVZIVQ9VOgw1HY1VQWnptiKDit8QiMMJ_mBc3qeQVEJ9BDwgtJGfo0ybbDzxeAbZE_hwKauRkOZ1-9YKcLEJ6mzBcuCSklzGt_P-7ekmGJ2eM1D6ObQrLmlF6kTmHWiGF2-ly-JPAgV7oBRBbWQ-xNmFNx6LkREczhZgM5ys_mU7ek8HEYgLv4HZoPGegmYV0p3mw20N3pcUebbd_Y2NsELAEi9t9t7mBSmIEcEE',
    heroTitle: 'Configure the Vault.',
    heroText: 'Tune your goals, format, and pressure level before the next debate drop.',
    quote: 'Strategy is what keeps chaos useful.',
  },
}

function AuthLayout({ children, footer, subtitle, title, variant = 'login' }) {
  const config = AUTH_VARIANTS[variant] || AUTH_VARIANTS.login

  return (
    <main className={`auth-shell auth-${variant}`}>
      <section className="auth-hero" aria-label="DebateHelp authentication introduction">
        <div className="auth-hero-image" style={{ backgroundImage: `url("${config.image}")` }} />
        <div className="auth-hero-shade" />
        <div className="auth-brand">
          <div className="brand-mark">DH</div>
          <div>
            <p>DebateHelp</p>
            <span>Debate strategy terminal</span>
          </div>
        </div>
        <div className="auth-hero-copy">
          <p className="eyebrow">AUTHENTICATION_REQUIRED</p>
          <h1>{config.heroTitle}</h1>
          <p>{config.heroText}</p>
        </div>
        <blockquote className="auth-quote">
          <p>“{config.quote}”</p>
          <cite>— DebateHelp OS</cite>
        </blockquote>
      </section>

      <section className="auth-card" aria-label={title}>
        <header className="auth-card-heading">
          <p>DEBATEHELP</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </header>
        {children}
        {footer && <footer className="auth-footer">{footer}</footer>}
      </section>
    </main>
  )
}

export default AuthLayout
