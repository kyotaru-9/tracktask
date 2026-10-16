import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../services/supabaseClient'
import { TrackResultSkeleton } from '../../components/Skeleton'
import {
  ArrowLeft, QrCode, Hash, SearchCheck, CheckCircle2,
  CircleAlert,
} from 'lucide-react'
import './TrackDocumentsPage.css'

const STATUS_STYLES = {
  processing: { bg: '#dbeafe', color: '#1d4ed8', label: 'In Progress' },
  returning: { bg: '#fef3c7', color: '#b45309', label: 'Returning to the Mayor' },
  done: { bg: '#dcfce7', color: '#166534', label: 'Done' },
  rejected: { bg: '#fee2e2', color: '#b91c1c', label: 'Rejected' },
}

function stepName(s) {
  return s.handler_role === 'Division' && s.handler_division
    ? `Division — ${s.handler_division}`
    : s.handler_role
}

const TrackDocumentsPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [trackId, setTrackId] = useState(searchParams.get('id') || '')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(() => Boolean(searchParams.get('id')))

  // Pure fetch — no state updates, safe to call from anywhere
  async function fetchTrack(idValue) {
    const { data, error } = await supabase.rpc('track_document', {
      p_tracking_id: idValue.trim(),
    })
    if (error) throw error
    return data || null
  }

  function applyResult(data) {
    setResult(data)
    setNotFound(!data)
    setLoading(false)
  }

  function lookup(idValue) {
    if (!idValue.trim()) return
    setLoading(true)
    setNotFound(false)
    setResult(null)
    fetchTrack(idValue)
      .then(applyResult)
      .catch((e) => {
        console.error(e)
        applyResult(null)
      })
  }

  // Auto-track when arriving from a scanned QR code (?id=DOC-...)
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return undefined
    let cancelled = false
    fetchTrack(id)
      .then((data) => { if (!cancelled) applyResult(data) })
      .catch((e) => {
        console.error(e)
        if (!cancelled) applyResult(null)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null)
  }

  // Try to decode the uploaded QR image using BarcodeDetector when available
  const handleTrackByFile = async () => {
    if (!selectedFile) return
    if (typeof window.BarcodeDetector === 'undefined') {
      setNotFound(true)
      return
    }
    try {
      const bitmap = await createImageBitmap(selectedFile)
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(bitmap)
      if (codes.length && codes[0].rawValue) {
        let raw = codes[0].rawValue
        const match = raw.match(/[?&]id=([^&]+)/)
        if (match) raw = decodeURIComponent(match[1])
        setTrackId(raw)
        lookup(raw)
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    }
  }

  const handleTrackById = (event) => {
    event.preventDefault()
    lookup(trackId)
  }

  const status = result ? STATUS_STYLES[result.status] || STATUS_STYLES.processing : null

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

            <button type="button" className="upload-trigger-btn" onClick={() => fileInputRef.current?.click()}>
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
                      setNotFound(false)
                    }}
                    className="track-id-input"
                  />
                </div>
                <button type="submit" className="page-submit-btn" disabled={!trackId.trim() || loading}>
                  <SearchCheck className="btn-icon" />
                  {loading ? 'Searching...' : 'Track by ID'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {loading && <TrackResultSkeleton />}

        {notFound && !loading && (
          <div className="page-success" role="alert" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
            <CircleAlert className="page-success-icon" style={{ color: '#b91c1c' }} />
            <div>
              <p className="page-success-title" style={{ color: '#b91c1c' }}>Document not found</p>
              <p className="page-success-text">
                Check the Track ID or try a clearer photo of the QR code.
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="page-success">
            <CheckCircle2 className="page-success-icon" />
            <div>
              <p className="page-success-title">{result.title}</p>
              <p className="page-success-text">
                {result.tracking_id} · {result.doc_type} · submitted{' '}
                {new Date(result.created_at).toLocaleDateString('en-PH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
            <span
              style={{
                marginLeft: 'auto', background: status.bg, color: status.color,
                borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {status.label}
            </span>
          </div>
        )}

        {result && result.steps?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Routing history</h3>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {result.steps.map((s) => {
                const done = s.status === 'approved' || s.status === 'received'
                const bad = s.status === 'rejected'
                const current = s.status === 'pending'
                return (
                  <li key={s.step_order} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16 }}>
                    <span
                      style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, marginTop: 1,
                        background: done ? '#dcfce7' : bad ? '#fee2e2' : current ? '#dbeafe' : '#f1f5f9',
                        color: done ? '#15803d' : bad ? '#b91c1c' : current ? '#1d4ed8' : '#64748b',
                        border: `2px solid ${done ? '#86efac' : bad ? '#fca5a5' : current ? '#2563eb' : '#e2e8f0'}`,
                      }}
                    >
                      {done ? '✓' : bad ? '✕' : s.step_order + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{stepName(s)}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {done && (s.acted_at
                          ? `${s.status === 'received' ? 'Received' : 'Approved'} · ${new Date(s.acted_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                          : 'Completed')}
                        {bad && 'Rejected'}
                        {current && 'Awaiting this office'}
                        {s.status === 'waiting' && 'Waiting for prior approvals'}
                        {s.comment && <> · “{s.comment}”</>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrackDocumentsPage
