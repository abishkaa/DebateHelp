import { useId, useState } from 'react'

function AuthFormInput({
  autoComplete,
  error,
  inputRef,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}) {
  const generatedId = useId()
  const inputId = `${name}-${generatedId}`
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div className="auth-field">
      <label htmlFor={inputId}>{label}</label>
      <div className={isPassword ? 'auth-input-wrap' : undefined}>
        <input
          autoComplete={autoComplete}
          id={inputId}
          ref={inputRef}
          name={name}
          placeholder={placeholder}
          required={required}
          type={inputType}
          value={value}
          onChange={onChange}
        />
        {isPassword && (
          <button
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            type="button"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <em>{error}</em>}
    </div>
  )
}

export default AuthFormInput
