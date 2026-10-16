import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../../services/authService'
import {
  Mail, Lock, Eye, EyeOff, ShieldAlert,
  Loader2, Zap, ArrowLeft, QrCode, Bell, FileText,
} from 'lucide-react'
import './Login.css'

const BRAND_FEATURES = [
  {
    icon: QrCode,
    title: 'QR-tracked documents',
    text: 'Every file gets a Track ID and QR code, scannable from intake to approval.',
  },
  {
    icon: Bell,
    title: 'Real-time notifications',
    text: 'Each office is alerted the moment a document reaches their step.',
  },
  {
    icon: FileText,
    title: 'Sequential approvals',
    text: 'Forward routing with automatic reverse return, fully auditable.',
  },
]

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { profile } = await signIn(formData.email, formData.password)

      setLoading(false)

      if (!profile) {
        setError('No staff profile found for this account. Contact the system administrator.')
        return
      }

      navigate('/dashboard')
    } catch (err) {
      setLoading(false)
      setError(err?.message || 'An unexpected network error occurred. Please verify your connection.')
    }
  }

  return (
    <div className="login-page">
      {/* Brand panel */}
      <aside className="login-brand">
        <div className="login-brand-bg" />
        <div className="login-brand-orb orb-a" />
        <div className="login-brand-orb orb-b" />

        <button type="button" className="login-back" onClick={() => navigate('/')}>
          <ArrowLeft className="login-back-icon" />
          Home
        </button>

        <div className="login-brand-body">
          <div className="login-brand-logo">
            <div className="login-brand-mark">
              <Zap className="login-brand-mark-icon" />
            </div>
            <span className="login-brand-name">TRACKTASK</span>
          </div>

          <h1 className="login-brand-title">
            Track every document.<br />
            <span>In real time.</span><br />
            <span>Notifications</span>
          </h1>
          <p className="login-brand-sub">
            Document tracking with QR codes and sequential approval routing —
            built for the City ENRO / SWM workflow.
          </p>

          <ul className="login-brand-features">
            {BRAND_FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <li key={f.title} className="login-brand-feature">
                  <div className="login-brand-feature-icon">
                    <Icon className="login-brand-feature-svg" />
                  </div>
                  <div>
                    <div className="login-brand-feature-title">{f.title}</div>
                    <div className="login-brand-feature-text">{f.text}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="login-brand-foot">
          City of Naga, Cebu · ENRO / SWM document pipeline
        </div>
      </aside>

      {/* Form panel */}
      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <h2>Welcome back</h2>
            <p>Sign in to your staff workspace</p>
          </div>

          {error && (
            <div className="login-error-alert">
              <ShieldAlert className="alert-icon" />
              <p>{error}</p>
            </div>
          )}

          <div className="login-input-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail className="field-icon-left" />
              <input
                id="email"
                type="email"
                name="email"
                placeholder="name@agency.gov"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="login-input-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
              <a href="#" className="forgot-password-link">Forgot password?</a>
            </div>
            <div className="input-with-icon">
              <Lock className="field-icon-left" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="field-icon-right" /> : <Eye className="field-icon-right" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="btn-spinner" /> Verifying identity...
              </>
            ) : (
              'Sign in'
            )}
          </button>

          <p className="login-card-note">
            Authorized staff only. Contact your administrator for account access.
          </p>
        </form>
      </main>
    </div>
  )
}

export default Login
