const PROVIDERS = [
  { id: 'google', label: 'Continue with Google', mark: 'G' },
  { id: 'github', label: 'Continue with GitHub', mark: 'GH' },
  { id: 'microsoft', label: 'Continue with Microsoft', mark: 'MS' },
]

function OAuthButtons({ loadingProvider, onEmail, onProvider, showEmail = Boolean(onEmail) }) {
  return (
    <div className="oauth-group">
      {PROVIDERS.map((provider) => (
        <button
          className="oauth-button"
          disabled={Boolean(loadingProvider)}
          key={provider.id}
          type="button"
          onClick={() => onProvider(provider.id)}
        >
          <span>{provider.mark}</span>
          {loadingProvider === provider.id ? 'Connecting...' : provider.label}
        </button>
      ))}
      {showEmail && (
        <button className="oauth-button email" type="button" onClick={onEmail}>
          <span>@</span>
          Continue with Email
        </button>
      )}
    </div>
  )
}

export default OAuthButtons
