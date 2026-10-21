import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Layers, Building2, Server, FileSignature, Zap,
  UserPlus, FileText, Search
} from 'lucide-react'
import TrackDocumentModal from '../../components/TrackDocumentModal'
import './LandingPage.css'

const HOW_IT_WORKS_STEPS = [
  {
    icon: UserPlus,
    title: 'Register',
    description: 'Create your account with your personal details and proof of residency to get started.'
  },
  {
    icon: FileText,
    title: 'Request',
    description: 'Choose the document you need and submit your request online — anytime, anywhere.'
  },
  {
    icon: Search,
    title: 'Track & Receive',
    description: "Monitor your request status in real-time and pick up your document once it's ready."
  }
]

const LandingPage = () => {
  const navigate = useNavigate()
  const [showTrackModal, setShowTrackModal] = useState(false)
  return (
    <div className="landing-layout">
      {/* Grid Pattern Overlay */}
      <div className="sapforce-grid-bg"></div>
      
      {/* Light leaks (Sapforce signature element) */}
      <div className="sapforce-glow glow-1"></div>
      <div className="sapforce-glow glow-2"></div>

      {/* Floating Capsule Header */}
      <header className="capsule-header">
        <div className="header-inner">
          <div className="header-logo">
            <div className="logo-pulse-box">
              <Zap className="logo-spark" />
            </div>
            <span className="logo-brand-text">TRACKTASK</span>
          </div>

          <nav className="header-nav">
            <a href="#pipeline">Departments</a>
            <a href="#how-it-works">How It Works</a>
            <button className="header-btn-ghost" onClick={() => navigate('/request-document')}>
              Request Document
            </button>
            <button className="header-btn-ghost" onClick={() => setShowTrackModal(true)}>
              Track Document
            </button>
          </nav>
          <div className="header-actions">
            <button className="header-btn-pill" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-viewport">
        <div className="hero-container">
          <h1 className="sapforce-hero-title">
            Document Tracking<br />
            <span>With Real-Notifications</span>
          </h1>

          <p className="sapforce-hero-subtitle">
            Track every document from intake to approval with a secure, real-time notification system that keeps departments informed, deadlines visible, and document movement fully accountable from start to finish.
          </p>

          <div className="hero-cta-group">
            <button className="btn-pill-primary" onClick={() => navigate('/request-document')}>
              Request Document <ArrowRight className="pill-btn-icon" />
            </button>
            <button 
              className="btn-pill-secondary" 
              onClick={() => setShowTrackModal(true)}
            >
              Track Documents
            </button>
          </div>
        </div>
      </section>

      {/* Sapforce Interactive SVG Workflow Pipeline */}
      <section id="pipeline" className="pipeline-section">
        <div className="pipeline-header">
          <h2>City Of Naga Departments</h2>
          <p>With love for the City of Naga, Cebu, TrackTask connects every department to deliver transparent, efficient, and reliable public service for every citizen.</p>
        </div>

        <div className="pipeline-visualization-container">
          <div className="pipeline-canvas-box">
            {/* SVG laser lines connecting nodes */}
            <svg className="pipeline-svg-connections" xmlns="http://www.w3.org/2000/svg">
              {/* Dynamic glowing path wires */}
              <path d="M 120 180 Q 250 80 430 180" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <path d="M 120 180 Q 250 80 430 180" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeDasharray="15, 120" strokeDashoffset="0" className="laser-pulse" />

              <path d="M 430 180 Q 560 280 740 180" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <path d="M 430 180 Q 560 280 740 180" fill="none" stroke="var(--color-secondary)" strokeWidth="3" strokeDasharray="15, 120" strokeDashoffset="0" className="laser-pulse laser-delay" />

              <path d="M 740 180 H 1020" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <path d="M 740 180 H 1020" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray="15, 120" strokeDashoffset="0" className="laser-pulse laser-delay-long" />
            </svg>

            {/* Nodes Grid Layout */}
            <div className="node-wrapper-grid">
              <div className="pipeline-node node-enro">
                <div className="node-glow-ring"></div>
                <div className="node-icon-circle color-badge-orange">
                  <Building2 className="node-icon-svg" />
                </div>
                <div className="node-label">
                  <h4>City ENRO</h4>
                  <span>City Environment and Natural Resources Office</span>
                </div>
              </div>

              <div className="pipeline-node node-swm">
                <div className="node-glow-ring"></div>
                <div className="node-icon-circle color-badge-pink">
                  <Server className="node-icon-svg" />
                </div>
                <div className="node-label">
                  <h4>SWM Secretary</h4>
                  <span>Solid Waste Management</span>
                </div>
              </div>

              <div className="pipeline-node node-admin">
                <div className="node-glow-ring"></div>
                <div className="node-icon-circle color-badge-blue">
                  <Layers className="node-icon-svg" />
                </div>
                <div className="node-label">
                  <h4>City Administrator</h4>
                  <span>City Administration</span>
                </div>
              </div>

              <div className="pipeline-node node-mayor">
                <div className="node-glow-ring"></div>
                <div className="node-icon-circle color-badge-purple">
                  <FileSignature className="node-icon-svg" />
                </div>
                <div className="node-label">
                  <h4>City Mayor</h4>
                  <span>Office of the Mayor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="how-it-works-header">
          <span className="section-bullet">GETTING STARTED</span>
          <h2>How It Works</h2>
          <p>Simple steps to get your documents</p>
        </div>

        <div className="how-it-works-grid">
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="how-it-works-card">
                <div className="how-it-works-icon-circle">
                  <Icon className="how-it-works-icon-svg" />
                </div>
                <h3>{i + 1}. {step.title}</h3>
                <p>{step.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="sapforce-footer" />

      {showTrackModal && (
        <TrackDocumentModal onClose={() => setShowTrackModal(false)} />
      )}
    </div>
  )
}

export default LandingPage