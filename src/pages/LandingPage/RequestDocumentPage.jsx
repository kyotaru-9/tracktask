import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Send, Upload, QrCode, Download } from 'lucide-react'
import TrackDocumentModal from '../../components/TrackDocumentModal'
import './RequestDocument.css'

const generateTrackingId = () => {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `TRK-${stamp}-${rand}`
}

const RequestDocumentPage = () => {
  const navigate = useNavigate()
  const qrRef = useRef(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    location: '',
    action: '',
    notes: '',
    residencyFile: null,
    governmentIdFile: null,
    documentFile: null
  })
  const [generated, setGenerated] = useState(false)
  const [trackingId, setTrackingId] = useState('')
  const [showTrackModal, setShowTrackModal] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (event) => {
    const { name, files } = event.target
    setForm((prev) => ({ ...prev, [name]: files?.[0] || null }))
  }

  const nextStep = () => {
    if (step < 3) {
      setStep((prev) => prev + 1)
    } else {
      setTrackingId(generateTrackingId())
      setGenerated(true)
    }
  }

  const previousStep = () => {
    if (step > 1) {
      setStep((prev) => prev - 1)
    }
  }

  const qrValue = useMemo(() => {
    const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ')
    return [fullName, form.location, form.action].filter(Boolean).join(' | ')
  }, [form.firstName, form.middleName, form.lastName, form.location, form.action])

  const qrBlocks = useMemo(() => {
    const size = 18
    const blocks = []
    const seed = qrValue.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const finder =
          (x < 5 && y < 5) ||
          (x > size - 6 && y < 5) ||
          (x < 5 && y > size - 6)

        const shouldFill = finder || ((seed + x * 7 + y * 3 + x * y) % 5) < 2

        if (shouldFill) {
          blocks.push({ x, y, key: `${x}-${y}` })
        }
      }
    }

    return blocks
  }, [qrValue])

  const handleDownloadQr = () => {
    if (!qrRef.current) return

    const svgEl = qrRef.current
    const serializer = new XMLSerializer()
    let source = serializer.serializeToString(svgEl)

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${trackingId || 'document-request-qr'}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="request-page-shell">
      <div className="request-page-card">
        <button className="page-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft className="page-back-icon" />
          Back to Home
        </button>

        <div className="request-grid">
          <aside className="request-sidebar">
            <div className="request-sidebar-inner">
              <div className="page-badge">Request Document</div>
              <h1 className="page-title">Create a secure document request</h1>
              <p className="page-description">
                Follow three guided steps to submit your request, attach supporting files, and generate a QR code for complete document tracking.
              </p>

              <div className="wizard-timeline">
                {[
                  { id: 1, title: 'Fill document details', text: 'Enter your name, location, and the action requested.' },
                  { id: 2, title: 'Upload IDs', text: 'Attach residency and valid ID documents.' },
                  { id: 3, title: 'Upload document', text: 'Add the main document to finalize your request.' }
                ].map((item) => (
                  <div key={item.id} className={`wizard-card ${step === item.id ? 'current' : step > item.id ? 'completed' : ''}`}>
                    <div className="wizard-card-index">{item.id}</div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="request-main">
            {!generated ? (
              <>
                {step === 1 && (
                  <div className="wizard-panel">
                    <h2>Step 1 — Fill up the information</h2>
                    <div className="page-form">
                      <label className="page-field">
                        <span>First Name</span>
                        <input
                          name="firstName"
                          value={form.firstName}
                          onChange={handleChange}
                          placeholder="Juan"
                          required
                        />
                      </label>

                      <label className="page-field">
                        <span>Last Name</span>
                        <input
                          name="lastName"
                          value={form.lastName}
                          onChange={handleChange}
                          placeholder="Dela Cruz"
                          required
                        />
                      </label>

                      <label className="page-field">
                        <span>Middle Name (Optional)</span>
                        <input
                          name="middleName"
                          value={form.middleName}
                          onChange={handleChange}
                          placeholder="Santos"
                        />
                      </label>

                      <label className="page-field">
                        <span>Location</span>
                        <input
                          name="location"
                          value={form.location}
                          onChange={handleChange}
                          placeholder="Barangay, City, or Office"
                          required
                        />
                      </label>

                        <label className="page-field">
                        <span>Contact Number</span>
                        <input
                          name="contactNumber"
                          value={form.contactNumber}
                          onChange={handleChange}
                          placeholder="e.g., 09123456789"
                          required
                        />
                      </label>

                        <label className="page-field">
                        <span>Email</span>
                        <input
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="e.g., juan.delacruz@example.com"
                          required
                        />
                      </label>

                      <label className="page-field">
                        <span>Action</span>
                        <input
                          name="action"
                          value={form.action}
                          onChange={handleChange}
                          placeholder="What is this request for? e.g. Permit Renewal"
                          required
                        />
                      </label>

                      <label className="page-field">
                        <span>Notes</span>
                        <textarea
                          name="notes"
                          rows="4"
                          value={form.notes}
                          onChange={handleChange}
                          placeholder="Add purpose, urgency, or routing details"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="wizard-panel">
                    <h2>Step 2 — Upload residency and valid ID</h2>
                    <div className="upload-stack">
                      <label className="upload-card">
                        <Upload className="upload-icon" />
                        <div>
                          <strong>Residency document</strong>
                          <p>{form.residencyFile ? form.residencyFile.name : 'Upload residency proof'}</p>
                        </div>
                        <input type="file" name="residencyFile" onChange={handleFileChange} />
                      </label>

                      <label className="upload-card">
                        <Upload className="upload-icon" />
                        <div>
                          <strong>Valid ID</strong>
                          <p>{form.governmentIdFile ? form.governmentIdFile.name : 'Upload valid government ID'}</p>
                        </div>
                        <input type="file" name="governmentIdFile" onChange={handleFileChange} />
                      </label>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="wizard-panel">
                    <h2>Step 3 — Upload the document</h2>
                    <label className="upload-card single-upload">
                      <Upload className="upload-icon" />
                      <div>
                        <strong>Main document</strong>
                        <p>{form.documentFile ? form.documentFile.name : 'Upload the document to be tracked'}</p>
                      </div>
                      <input type="file" name="documentFile" onChange={handleFileChange} />
                    </label>
                  </div>
                )}

                <div className="wizard-actions">
                  {step > 1 && (
                    <button type="button" className="page-secondary-btn" onClick={previousStep}>
                      Previous
                    </button>
                  )}
                  <button type="button" className="page-submit-btn" onClick={nextStep}>
                    {step < 3 ? 'Continue' : 'Generate QR Code'}
                    <ArrowRight className="page-submit-icon" />
                  </button>
                </div>
              </>
            ) : (
              <div className="wizard-panel qr-panel">
                <div className="qr-badge">
                  <QrCode className="qr-badge-icon" />
                  QR Code Generated
                </div>
                <h2>Your document request is ready</h2>
                <p className="page-description">
                  Download your QR code to track the document through every stage of the workflow. If the QR code doesn't download or scan, use the Tracking ID below instead.
                </p>

                <div className="qr-preview-box">
                  <svg
                    ref={qrRef}
                    viewBox="0 0 18 18"
                    className="qr-preview-svg"
                    role="img"
                    aria-label="Generated QR code"
                  >
                    <rect x="0" y="0" width="18" height="18" fill="#0a0b10" />
                    {qrBlocks.map((block) => (
                      <rect key={block.key} x={block.x} y={block.y} width="1" height="1" fill="#ffffff" />
                    ))}
                  </svg>
                </div>

                <div className="qr-meta">
                  <span>Reference</span>
                  <strong>{qrValue || 'Document Request'}</strong>
                </div>

                <div className="qr-meta tracking-id-meta">
                  <span>Tracking ID</span>
                  <strong>{trackingId}</strong>
                  <p className="tracking-id-note">
                    Save this ID — you can look up your request with it if the QR code fails to download or scan.
                  </p>
                </div>

                <div className="wizard-actions qr-actions">
                  <button type="button" className="page-secondary-btn" onClick={handleDownloadQr}>
                    <Download className="page-submit-icon" />
                    Download QR Code
                  </button>
                  <button type="button" className="page-submit-btn" onClick={() => setShowTrackModal(true)}>
                    <Send className="page-submit-icon" />
                    Track Document
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {showTrackModal && (
        <TrackDocumentModal
          onClose={() => setShowTrackModal(false)}
          initialId={trackingId || null}
        />
      )}
    </div>
  )
}

export default RequestDocumentPage