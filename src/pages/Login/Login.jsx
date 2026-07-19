import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import {
  Mail, Lock, Eye, EyeOff, ShieldAlert,
  Loader2, Zap, UserCheck,
  Building2, Server, Layers, SquarePen
} from 'lucide-react'
import './Login.css'

const ROLES = [
  {
    key: 'enro',
    label: 'City ENRO',
    description: 'City Environment and Natural Resources Office',
    email: 'cityenro@gmail.com',
    icon: Building2,
    accent: 'role-enro',
  },
  {
    key: 'swm',
    label: 'SWM Secretary',
    description: 'Solid Waste Management',
    email: 'swmsecretary@gmail.com',
    icon: Server,
    accent: 'role-swm',
  },
  {
    key: 'admin',
    label: 'City Administrator',
    description: 'City Administration',
    email: 'cityadministrator@gmail.com',
    icon: Layers,
    accent: 'role-admin',
  },
  {
    key: 'mayor',
    label: 'City Mayor',
    description: 'Office of the Mayor',
    email: 'citymayor@gmail.com',
    icon: SquarePen,
    accent: 'role-mayor',
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
  const [autofillSuccess, setAutofillSuccess] = useState('')

  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    if (error) setError('')
  }

  const handleRoleSelect = (role) => {
    setFormData((prev) => ({ ...prev, email: role.email }))
    setError('')
    setAutofillSuccess(`${role.label} selected — enter your password to continue.`)
    document.getElementById('password')?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setAutofillSuccess('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      })

      setLoading(false)

      if (authError) {
        setError(authError.message)
        return
      }

      const email = data.user?.email?.toLowerCase()

      if (email === 'cityadministrator@gmail.com') {
        navigate('/city-administrator')
      } else if (email === 'cityenro@gmail.com') {
        navigate('/city-enro')
      } else if (email === 'swmsecretary@gmail.com') {
        navigate('/swm-secretary')
      } else if (email === 'divisions@gmail.com') {
        navigate('/divisions')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setLoading(false)
      setError('An unexpected network error occurred. Please verify your connection.')
    }
  }

  return (
    <div className="login-layout-wrapper">
      {/* Background decoration matching landing page */}
      <div className="login-mesh bg-orb-l1"></div>
      <div className="login-mesh bg-orb-l2"></div>
      <div className="login-grid-overlay"></div>

      <div className="login-card-container animate-fade-in">
        <form className="login-form-card" onSubmit={handleSubmit}>
          {/* Logo Brand Header */}
          <div className="login-logo-header">
            <div className="login-logo-icon-box">
              <Zap className="login-logo-icon" />
            </div>
            <h1 className="login-system-title">TRACKTASK</h1>
          </div>

          <div className="login-subheader">
            <h2>Welcome Back</h2>
            <p>Document Tracking With Real-time Notifications</p>
          </div>

          {/* Messages and feedback alerts */}
          {error && (
            <div className="login-error-alert animate-fade-in">
              <ShieldAlert className="alert-icon" />
              <p>{error}</p>
            </div>
          )}

          {autofillSuccess && (
            <div className="login-success-alert animate-fade-in">
              <UserCheck className="alert-icon" />
              <p>{autofillSuccess}</p>
            </div>
          )}

          {/* Form Fields */}
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
              <label htmlFor="password">Security Password</label>
              <a href="#" className="forgot-password-link">Forgot?</a>
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
                <Loader2 className="btn-spinner" /> Validating Identity...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>

      {/* Role showcase / quick access */}
      <div className="role-showcase-wrapper animate-fade-in">
        <div className="role-showcase-grid">
          {ROLES.map((role) => {
            const Icon = role.icon
            return (
              <button
                type="button"
                key={role.key}
                className={`role-select-card ${role.accent}`}
                onClick={() => handleRoleSelect(role)}
              >
                <div className="role-icon-box">
                  <Icon className="role-icon" />
                </div>
                <div className="role-title">{role.label}</div>
                <div className="role-desc">{role.description}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Login