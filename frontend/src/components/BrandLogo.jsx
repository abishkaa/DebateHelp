import './BrandLogo.css'

function BrandLogo({
  className = '',
  size = 'md',
}) {
  const classes = [
    'brand-logo',
    size === 'sm' ? 'brand-logo--sm' : 'brand-logo--md',
    className,
  ].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-label="DebateHelp">
      <img
        alt=""
        aria-hidden="true"
        className="brand-logo__image"
        src="/stitch-debatehelp-logo.png"
      />
    </span>
  )
}

export default BrandLogo
