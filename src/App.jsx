import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API = 'https://kiosco-ai.onrender.com'
const STORAGE_KEY = 'kiosco_perfil'

const TIPOS = ['kiosco', 'carnicería', 'verdulería', 'ropa', 'almacén', 'panadería', 'otro']
const CLIENTES_OPTS = ['familias', 'estudiantes', 'oficinistas', 'vecinos del barrio', 'jubilados']

function getStoredPerfil() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return stored?.nombre ? stored : null
  } catch {
    return null
  }
}

// ── Profile form (setup + edit) ──────────────────────────────────────────────

function ProfileForm({ initial = {}, onSave, onCancel }) {
  const [nombre,   setNombre]   = useState(initial.nombre || '')
  const [tipo,     setTipo]     = useState(initial.tipo   || '')
  const [barrio,   setBarrio]   = useState(initial.barrio || '')
  const [clientes, setClientes] = useState(initial.clientes || [])
  const [prod1,    setProd1]    = useState((initial.productos || [])[0] || '')
  const [prod2,    setProd2]    = useState((initial.productos || [])[1] || '')
  const [prod3,    setProd3]    = useState((initial.productos || [])[2] || '')

  function toggleCliente(val) {
    setClientes(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      nombre:    nombre.trim(),
      tipo,
      barrio:    barrio.trim(),
      clientes,
      productos: [prod1, prod2, prod3].map(p => p.trim()).filter(Boolean),
    })
  }

  return (
    <form className="pf-form" onSubmit={handleSubmit}>
      <div className="pf-group">
        <label className="pf-label">1. ¿Cómo se llama tu negocio?</label>
        <input
          className="pf-input"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Kiosco López, Almacén El Buen Precio..."
          required
        />
      </div>

      <div className="pf-group">
        <label className="pf-label">2. ¿Qué tipo de negocio es?</label>
        <select className="pf-input" value={tipo} onChange={e => setTipo(e.target.value)} required>
          <option value="">Seleccioná...</option>
          {TIPOS.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="pf-group">
        <label className="pf-label">3. ¿En qué barrio/ciudad está?</label>
        <input
          className="pf-input"
          value={barrio}
          onChange={e => setBarrio(e.target.value)}
          placeholder="Ej: Lomas de Zamora, Villa Urquiza..."
          required
        />
      </div>

      <div className="pf-group">
        <label className="pf-label">4. ¿Cómo son tus clientes principales?</label>
        <div className="pf-chips">
          {CLIENTES_OPTS.map(opt => (
            <button
              key={opt}
              type="button"
              className={`pf-chip ${clientes.includes(opt) ? 'active' : ''}`}
              onClick={() => toggleCliente(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-group">
        <label className="pf-label">5. ¿Cuáles son tus 3 productos más vendidos?</label>
        <div className="pf-products">
          <div className="pf-product-row">
            <span className="pf-num">1.</span>
            <input className="pf-input" value={prod1} onChange={e => setProd1(e.target.value)}
              placeholder="Ej: Gaseosas, Cigarrillos..." required />
          </div>
          <div className="pf-product-row">
            <span className="pf-num">2.</span>
            <input className="pf-input" value={prod2} onChange={e => setProd2(e.target.value)}
              placeholder="Ej: Alfajores, Agua mineral..." />
          </div>
          <div className="pf-product-row">
            <span className="pf-num">3.</span>
            <input className="pf-input" value={prod3} onChange={e => setProd3(e.target.value)}
              placeholder="Ej: Golosinas, Diarios..." />
          </div>
        </div>
      </div>

      <div className="pf-actions">
        {onCancel && (
          <button type="button" className="pf-btn-cancel" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="pf-btn-save">
          {onCancel ? 'Guardar cambios' : 'Guardar y comenzar →'}
        </button>
      </div>
    </form>
  )
}

// ── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [perfil,     setPerfil]     = useState(getStoredPerfil)
  const [showEdit,   setShowEdit]   = useState(false)
  const [decisiones, setDecisiones] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [recording,  setRecording]  = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error,      setError]      = useState(null)
  const [textInput,  setTextInput]  = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const streamRef        = useRef(null)

  function savePerfil(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setPerfil(p)
    setShowEdit(false)
  }

  const fetchDecisiones = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${API}/decisiones`)
      if (res.ok) {
        const data = await res.json()
        setDecisiones(data.decisiones)
        setLastUpdate(new Date())
      } else if (res.status !== 404) {
        setError('Error al obtener las decisiones.')
      }
    } catch {
      setError('No se pudo conectar al servidor.')
    }
  }, [])

  useEffect(() => {
    if (perfil) fetchDecisiones()
  }, [perfil, fetchDecisiones])

  const startRecording = async () => {
    if (loading || recording) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setError('No se pudo acceder al micrófono.')
    }
  }

  const stopRecording = async () => {
    if (!recording || !mediaRecorderRef.current) return
    setRecording(false)
    await new Promise(resolve => {
      mediaRecorderRef.current.onstop = resolve
      mediaRecorderRef.current.stop()
    })
    streamRef.current?.getTracks().forEach(t => t.stop())

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const form = new FormData()
    form.append('audio', blob, 'audio.webm')
    if (perfil) form.append('perfil', JSON.stringify(perfil))

    setLoading(true)
    try {
      const res  = await fetch(`${API}/audio`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del servidor')
      setDecisiones(data.decisiones)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message || 'Error al procesar el audio.')
    } finally {
      setLoading(false)
    }
  }

  const sendText = async () => {
    const texto = textInput.trim()
    if (!texto || loading) return
    setTextInput('')
    setError(null)
    setLoading(true)
    try {
      const res  = await fetch(`${API}/texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ...(perfil && { perfil }) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del servidor')
      setDecisiones(data.decisiones)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message || 'Error al enviar el texto.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = d => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ── Setup screen ────────────────────────────────────────────────────────────

  if (!perfil) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="setup-header">
            <span className="setup-icon">🏪</span>
            <h2>Configurá tu negocio</h2>
            <p>Personalizá el asistente con el contexto de tu negocio</p>
          </div>
          <ProfileForm onSave={savePerfil} />
        </div>
      </div>
    )
  }

  // ── Main screen ─────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <header className="header">
        <div className="header-main">
          <h1>{perfil.nombre}</h1>
          <button
            className="settings-btn"
            onClick={() => setShowEdit(true)}
            aria-label="Configuración del negocio"
          >
            ⚙️
          </button>
        </div>
        <p className="subtitle">Tu asistente de negocio</p>
      </header>

      <div className="status-bar">
        <span className="last-update">
          {lastUpdate ? `Actualizado ${formatTime(lastUpdate)}` : 'Sin datos aún'}
        </span>
        <button className="refresh-btn" onClick={fetchDecisiones} disabled={loading}>
          ↻ Actualizar
        </button>
      </div>

      <div className="decisions-area">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Procesando...</p>
          </div>
        ) : decisiones ? (
          <div className="markdown-content">
            <ReactMarkdown>{decisiones}</ReactMarkdown>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🎙️</span>
            <p>Las decisiones de hoy aparecen acá</p>
          </div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="controls">
        <div className="mic-section">
          <button
            className={`mic-btn ${recording ? 'recording' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={e => { e.preventDefault(); startRecording() }}
            onTouchEnd={e   => { e.preventDefault(); stopRecording()  }}
            disabled={loading}
            aria-label="Grabar audio"
          >
            🎙️
          </button>
          <span className={`mic-label ${recording ? 'recording' : ''}`}>
            {recording ? '● Grabando — soltá para enviar' : 'Consultá por voz'}
          </span>
        </div>

        <div className="divider"><span>o escribí tu consulta</span></div>

        <div className="text-input-row">
          <input
            className="text-input"
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            placeholder="Preguntale algo a Gelline..."
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={sendText}
            disabled={loading || !textInput.trim()}
            aria-label="Enviar"
          >
            →
          </button>
        </div>
      </div>

      {showEdit && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowEdit(false)}
        >
          <div className="modal-card">
            <div className="modal-header">
              <h3>Configuración del negocio</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <ProfileForm initial={perfil} onSave={savePerfil} onCancel={() => setShowEdit(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
