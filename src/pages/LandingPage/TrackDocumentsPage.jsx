import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, QrCode, Hash, SearchCheck, CheckCircle2 } from 'lucide-react'
import './TrackDocumentsPage.css'

const TrackDocumentsPage = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [trackId, setTrackId] = useState('')
  const [tracked, setTracked] = useState(false)

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
    setTracked(false)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleTrackById = (event) => {
    event.preventDefault()
    if (!trackId.trim()) return
    setTracked(true)
  }

  const handleTrackByFile = () => {
    if (!selectedFile) return
    setTracked(true)
  }

  return (
    <div className="track-page-shell">
      <div className="track-page-card">
        <button className="page-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft className="page-back-icon" />
          Back to Home
        </button>

        <div className="page-header">
          <div className="page-badge">Track Documents</div>
          <h1 className="page-title">Track a document</h1>
          <p className="page-description">
            Scan a QR code or enter a Track ID number to follow a document’s movement from intake to approval.
          </p>
        </div>

        <div className="track-methods">
          <section className="track-method" aria-labelledby="qr-method-label">
            <div className="method-head">
              <span className="method-index">01</span>
              <div>
                <h2 id="qr-method-label" className="method-title">Upload QR code</h2>
                <p className="method-hint">Use the code printed on the document routing slip.</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="visually-hidden-input"
            />

            <button type="button" className="upload-trigger-btn" onClick={handleBrowseClick}>
              <QrCode className="btn-icon" />
              {selectedFile ? 'Change QR code image' : 'Upload QR code'}
            </button>

            {selectedFile && (
              <div className="selected-file-row">
                <span className="selected-file-name">{selectedFile.name}</span>
                <button type="button" className="text-action-btn" onClick={handleTrackByFile}>
                  <SearchCheck className="btn-icon-sm" />
                  Track from image
                </button>
              </div>
            )}
          </section>

          <div className="method-divider" role="presentation">
            <span>or</span>
          </div>

          <section className="track-method" aria-labelledby="id-method-label">
            <div className="method-head">
              <span className="method-index">02</span>
              <div>
                <h2 id="id-method-label" className="method-title">Enter Track ID number</h2>
                <p className="method-hint">Find this reference number on the document cover sheet.</p>
              </div>
            </div>

            <form className="track-id-form" onSubmit={handleTrackById}>
              <label className="field-label" htmlFor="track-id-input">
                Track ID number for document
              </label>
              <div className="track-id-input-row">
                <div className="track-id-input-wrap">
                  <Hash className="input-icon" />
                  <input
                    id="track-id-input"
                    type="text"
                    inputMode="text"
                    placeholder="e.g. DOC-2026-004821"
                    value={trackId}
                    onChange={(event) => {
                      setTrackId(event.target.value)
                      setTracked(false)
                    }}
                    className="track-id-input"
                  />
                </div>
                <button type="submit" className="page-submit-btn" disabled={!trackId.trim()}>
                  <SearchCheck className="btn-icon" />
                  Track by ID
                </button>
              </div>
            </form>
          </section>
        </div>

        {tracked && (
          <div className="page-success" role="status">
            <CheckCircle2 className="page-success-icon" />
            <div>
              <p className="page-success-title">Document located</p>
              <p className="page-success-text">You can now review the current status and routing history.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrackDocumentsPage