import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import Modal from './Modal'
import { TrackResultSkeleton } from './Skeleton'
import {
  QrCode, Hash, SearchCheck, CheckCircle2, CircleAlert, X
} from 'lucide-react'

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

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, background: '#f8fafc', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box'
}

export default function TrackDocumentModal({ onClose, initialId = null }) {
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [trackId, setTrackId] = useState(initialId || searchParams.get('id') || '')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(() => Boolean(initialId || searchParams.get('id')))

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

  // Auto-track when a tracking id is supplied (e.g. scanned QR code)
  useEffect(() => {
    const id = initialId || searchParams.get('id')
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

  // Decode the uploaded QR image using BarcodeDetector when available
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
    <Modal onClose={onClose} style={{ width: 560 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1d4ed8' }}>Track a document</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Scan a QR code or enter a Track ID to follow a document&rsquo;s movement.
          </div>
        </div>
        <button onClick={onClose} className="tt-x-btn" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {/* Method 01 — QR upload */}
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>01</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Upload QR code</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                Use the code printed on the document routing slip.
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              border: '1px solid #bfdbfe', borderRadius: 9, background: '#eff6ff', color: '#1d4ed8',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            <QrCode size={15} />
            {selectedFile ? 'Change QR code image' : 'Upload QR code'}
          </button>

          {selectedFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: '#334155', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </span>
              <button
                type="button"
                onClick={handleTrackByFile}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  border: '1px solid #2563eb', borderRadius: 8, background: '#2563eb', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                <SearchCheck size={13} /> Track from image
              </button>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        {/* Method 02 — Track ID */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>02</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Enter Track ID number</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                Find this reference number on the document cover sheet.
              </div>
            </div>
          </div>

          <form onSubmit={handleTrackById}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Hash
                  size={15}
                  style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  inputMode="text"
                  placeholder="e.g. DOC-2026-004821"
                  value={trackId}
                  onChange={(event) => {
                    setTrackId(event.target.value)
                    setNotFound(false)
                  }}
                  style={{ ...inp, paddingLeft: 32 }}
                />
              </div>
              <button
                type="submit"
                disabled={!trackId.trim() || loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                  border: '1px solid #2563eb', borderRadius: 9, background: '#2563eb', color: '#fff',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap', opacity: (!trackId.trim() || loading) ? 0.6 : 1
                }}
              >
                <SearchCheck size={14} />
                {loading ? 'Searching...' : 'Track by ID'}
              </button>
            </div>
          </form>
        </section>

        {loading && <TrackResultSkeleton />}

        {notFound && !loading && (
          <div style={{
            marginTop: 16, display: 'flex', gap: 12, padding: 14,
            border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 10
          }} role="alert">
            <CircleAlert size={20} style={{ color: '#b91c1c', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>Document not found</div>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                Check the Track ID or try a clearer photo of the QR code.
              </div>
            </div>
          </div>
        )}

        {result && (
          <div style={{
            marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', padding: 14,
            border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 10
          }}>
            <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>{result.title}</div>
              <div style={{ fontSize: 12, color: '#166534' }}>
                {result.tracking_id} · {result.doc_type} · submitted{' '}
                {new Date(result.created_at).toLocaleDateString('en-PH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </div>
            </div>
            <span style={{
              marginLeft: 'auto', background: status.bg, color: status.color,
              borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap'
            }}>
              {status.label}
            </span>
          </div>
        )}

        {result && result.steps?.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Routing history</div>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {result.steps.map((s) => {
                const done = s.status === 'approved' || s.status === 'received'
                const bad = s.status === 'rejected'
                const current = s.status === 'pending'
                return (
                  <li key={s.step_order} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, marginTop: 1,
                      background: done ? '#dcfce7' : bad ? '#fee2e2' : current ? '#dbeafe' : '#f1f5f9',
                      color: done ? '#15803d' : bad ? '#b91c1c' : current ? '#1d4ed8' : '#64748b',
                      border: `2px solid ${done ? '#86efac' : bad ? '#fca5a5' : current ? '#2563eb' : '#e2e8f0'}`,
                    }}>
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

      <style>{`
        .tt-x-btn { border:none; background:none; color:#64748b; cursor:pointer; display:flex; align-items:center; }
      `}</style>
    </Modal>
  )
}
