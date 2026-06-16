import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API         = 'https://kiosco-ai.onrender.com'
const STORAGE_KEY = 'kiosco_perfil'
const DEVICE_KEY  = 'kiosco_dispositivo'
const RATINGS_KEY = 'kiosco_ratings'

const TIPOS = ['kiosco', 'carnicería', 'verdulería', 'ropa', 'almacén', 'panadería', 'otro']

const DEFAULT_DEVICE = {
  activo:           false,
  apertura:         '09:00',
  cierre:           '20:00',
  descanso:         false,
  descansoInicio:   '13:00',
  descansoFin:      '15:00',
  saludoAutomatico: false,
}

function getStoredPerfil() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return s?.nombre ? s : null
  } catch { return null }
}

function getStoredDevice() {
  try {
    return { ...DEFAULT_DEVICE, ...JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') }
  } catch { return { ...DEFAULT_DEVICE } }
}

function getStoredRatings() {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}') } catch { return {} }
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
  return h.toString(36)
}

function getGellineStatus(cfg, debeGrabar) {
  if (!cfg.activo) return { text: 'Gelline está en pausa', dot: '#9CA3AF', pulse: false }
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const enDescanso = cfg.descanso && cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin)
  const dentro     = cur >= hm(cfg.apertura) && cur < hm(cfg.cierre)
  if (enDescanso) return { text: 'En pausa',        dot: '#EAB308', pulse: false }
  if (!dentro)    return { text: 'Fuera de horario', dot: '#9CA3AF', pulse: false }
  if (debeGrabar) return { text: 'Con vos',          dot: '#22C55E', pulse: true  }
  return                 { text: 'Acompañando',      dot: '#86EFAC', pulse: false }
}

const CATEGORY_CONFIG = {
  rojo:              { label: 'Actuá hoy',      bg: '#FEE2E2', color: '#991B1B' },
  amarillo:          { label: 'Esta semana',     bg: '#FEF9C3', color: '#854D0E' },
  verde:             { label: 'Para pensar',     bg: '#DCFCE7', color: '#166534' },
  'lo-que-funciono': { label: 'Lo que funcionó', bg: '#F0FDF4', color: '#15803D' },
  general:           { label: 'General',         bg: '#F3F4F6', color: '#374151' },
}

const HASH_SECTION_MAP = {
  'plata que se te escapa hoy':    'rojo',
  'esto se viene repitiendo':      'amarillo',
  'para que no te vuelva a pasar': 'verde',
  'lo que funcionó':               'lo-que-funciono',
  'lo que funciono':               'lo-que-funciono',
}

function parseDecisiones(md) {
  if (!md) return null
  const lines = md.split('\n')
  const decisions = []
  let current = null
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (current) decisions.push(current)
      const rawTitle = line.replace(/^###\s*/, '').trim()
      const category = HASH_SECTION_MAP[rawTitle.toLowerCase()] || 'general'
      current = { title: rawTitle, bodyLines: [], category }
    } else if (current) {
      current.bodyLines.push(line)
    }
  }
  if (current) decisions.push(current)
  if (decisions.length === 0) return md
  return decisions.map((d, i) => ({
    id:       simpleHash(d.category + (d.bodyLines[0] || String(i))),
    title:    d.title,
    body:     d.bodyLines.join('\n').trim(),
    category: d.category,
  }))
}

function formatDateLong() {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Profile Form (nombre + tipo únicamente) ───────────────────────────────────

function ProfileForm({ initial = {}, onSave, onCancel }) {
  const [nombre, setNombre] = useState(initial.nombre || '')
  const [tipo,   setTipo]   = useState(initial.tipo   || '')

  function handleSubmit(e) {
    e.preventDefault()
    const existing = getStoredPerfil() || {}
    onSave({ ...existing, nombre: nombre.trim(), tipo })
  }

  return (
    <form className="pf-form" onSubmit={handleSubmit}>
      <div className="pf-group">
        <label className="pf-label">¿Cómo se llama tu negocio?</label>
        <input
          className="pf-input"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Kiosco López, Almacén El Sol..."
          required
        />
      </div>

      <div className="pf-group">
        <label className="pf-label">¿Qué tipo de negocio es?</label>
        <div className="pf-tipo-grid">
          {TIPOS.map(t => (
            <button
              key={t}
              type="button"
              className={`pf-tipo-btn ${tipo === t ? 'active' : ''}`}
              onClick={() => setTipo(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-actions">
        {onCancel && (
          <button type="button" className="pf-btn-cancel" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="pf-btn-save"
          disabled={!nombre.trim() || !tipo}
        >
          {onCancel ? 'Guardar' : 'Empezar →'}
        </button>
      </div>
    </form>
  )
}

// ── Configurar Dispositivo (toggle + horario únicamente) ──────────────────────

function ConfigurarDispositivo({ onBack }) {
  const [config,     setConfig]     = useState(getStoredDevice)
  const [debeGrabar, setDebeGrabar] = useState(false)

  const configRef   = useRef(config)
  configRef.current = config

  useEffect(() => {
    async function cargarConfig() {
      try {
        const res  = await fetch(`${API}/config`)
        if (!res.ok) return
        const data = await res.json()
        const next = {
          activo:           data.activo            ?? false,
          apertura:         data.apertura          ?? '09:00',
          cierre:           data.cierre            ?? '20:00',
          descanso:         data.descanso          ?? false,
          descansoInicio:   data.descanso_inicio   ?? '13:00',
          descansoFin:      data.descanso_fin      ?? '15:00',
          saludoAutomatico: data.saludo_automatico ?? false,
        }
        localStorage.setItem(DEVICE_KEY, JSON.stringify(next))
        setConfig(next)
        setDebeGrabar(data.debe_grabar ?? false)
      } catch { }
    }
    cargarConfig()
  }, [])

  useEffect(() => {
    const check = () => {
      const cfg = configRef.current
      if (!cfg.activo) { setDebeGrabar(false); return }
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
      const dentro     = cur >= hm(cfg.apertura) && cur < hm(cfg.cierre)
      const enDescanso = cfg.descanso && cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin)
      setDebeGrabar(dentro && !enDescanso)
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  async function saveConfig(updates) {
    const next = { ...configRef.current, ...updates }
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next))
    setConfig(next)
    try {
      const res = await fetch(`${API}/config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activo:            next.activo,
          apertura:          next.apertura,
          cierre:            next.cierre,
          descanso:          next.descanso,
          descanso_inicio:   next.descansoInicio,
          descanso_fin:      next.descansoFin,
          saludo_automatico: next.saludoAutomatico,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDebeGrabar(data.debe_grabar ?? false)
      }
    } catch { }
  }

  return (
    <div className="cd-screen">
      <header className="cd-header">
        <button className="cd-back" onClick={onBack}>← Volver</button>
        <span className="cd-title">Mi dispositivo</span>
        <span />
      </header>

      <div className="cd-content">

        <div className="cd-card">
          <div className="cd-row">
            <div className="cd-row-info">
              <span className="cd-row-label">Gelline</span>
              <span className="cd-row-sub">{getGellineStatus(config, debeGrabar).text}</span>
            </div>
            <button
              className={`cd-toggle ${config.activo ? 'on' : ''}`}
              onClick={() => saveConfig({ activo: !configRef.current.activo })}
              aria-label="Activar Gelline"
            />
          </div>
        </div>

        <div className="cd-card">
          <p className="cd-card-title">Horario de atención</p>
          <div className="cd-time-row">
            <label className="cd-time-label">Apertura</label>
            <input
              className="cd-time-input"
              type="time"
              value={config.apertura}
              onChange={e => saveConfig({ apertura: e.target.value })}
            />
          </div>
          <div className="cd-sep" />
          <div className="cd-time-row">
            <label className="cd-time-label">Cierre</label>
            <input
              className="cd-time-input"
              type="time"
              value={config.cierre}
              onChange={e => saveConfig({ cierre: e.target.value })}
            />
          </div>
          <div className="cd-sep" />
          <div className="cd-row cd-row-inline">
            <span className="cd-time-label">Pausa al mediodía</span>
            <button
              className={`cd-toggle ${config.descanso ? 'on' : ''}`}
              onClick={() => saveConfig({ descanso: !configRef.current.descanso })}
              aria-label="Activar pausa al mediodía"
            />
          </div>
          {config.descanso && (
            <>
              <div className="cd-sep" />
              <div className="cd-time-row">
                <label className="cd-time-label">Inicio</label>
                <input
                  className="cd-time-input"
                  type="time"
                  value={config.descansoInicio}
                  onChange={e => saveConfig({ descansoInicio: e.target.value })}
                />
              </div>
              <div className="cd-sep" />
              <div className="cd-time-row">
                <label className="cd-time-label">Fin</label>
                <input
                  className="cd-time-input"
                  type="time"
                  value={config.descansoFin}
                  onChange={e => saveConfig({ descansoFin: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Decision Card ─────────────────────────────────────────────────────────────

function DecisionCard({ decision, rating, onRate }) {
  const cat = CATEGORY_CONFIG[decision.category] || CATEGORY_CONFIG.general

  return (
    <div className="dec-card">
      <div className="dec-card-header">
        <span className="dec-title">{decision.title}</span>
        <span className="dec-pill" style={{ background: cat.bg, color: cat.color }}>
          {cat.label}
        </span>
      </div>
      {decision.body && (
        <div className="dec-body">
          <ReactMarkdown>{decision.body}</ReactMarkdown>
        </div>
      )}
      <div className="dec-actions">
        <button
          className={`dec-rate ${rating === 1 ? 'active-up' : ''}`}
          onClick={() => onRate(decision.id, rating === 1 ? 0 : 1)}
          aria-label="Útil"
        >👍</button>
        <button
          className={`dec-rate ${rating === -1 ? 'active-down' : ''}`}
          onClick={() => onRate(decision.id, rating === -1 ? 0 : -1)}
          aria-label="No útil"
        >👎</button>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [perfil,        setPerfil]        = useState(getStoredPerfil)
  const [view,          setView]          = useState('main')
  const [showEdit,      setShowEdit]      = useState(false)
  const [decisiones,    setDecisiones]    = useState(null)
  const [semanaData,    setSemanaData]    = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [loadingSemana, setLoadingSemana] = useState(false)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [lastUpdate,    setLastUpdate]    = useState(null)
  const [error,         setError]         = useState(null)
  const [textInput,     setTextInput]     = useState('')
  const [tab,           setTab]           = useState('hoy')
  const [gellineActivo,     setGellineActivo]     = useState(() => getStoredDevice().activo)
  const [gellineDebeGrabar, setGellineDebeGrabar] = useState(false)
  const [ratings,           setRatings]           = useState(getStoredRatings)

  function savePerfil(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setPerfil(p)
    setShowEdit(false)
  }

  function handleBackFromConfig() {
    const cfg = getStoredDevice()
    setGellineActivo(cfg.activo)
    if (cfg.activo) {
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
      const dentro     = cur >= hm(cfg.apertura) && cur < hm(cfg.cierre)
      const enDescanso = cfg.descanso && cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin)
      setGellineDebeGrabar(dentro && !enDescanso)
    } else {
      setGellineDebeGrabar(false)
    }
    setView('main')
  }

  function rateDecision(id, value) {
    const next = { ...ratings, [id]: value }
    setRatings(next)
    localStorage.setItem(RATINGS_KEY, JSON.stringify(next))
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
        setError('Error al obtener los datos.')
      }
    } catch {
      setError('No se pudo conectar al servidor.')
    }
  }, [])

  const fetchSemana = useCallback(async () => {
    setLoadingSemana(true)
    try {
      const res = await fetch(`${API}/decisiones?periodo=semana`)
      if (res.ok) {
        const data = await res.json()
        setSemanaData(data.decisiones)
      }
    } catch { }
    finally { setLoadingSemana(false) }
  }, [])

  const triggerAnalisis = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      await fetch(`${API}/analizar`)
      await new Promise(r => setTimeout(r, 5_000))
      await fetchDecisiones()
    } catch {
      setError('No se pudo conectar al servidor.')
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    if (perfil) fetchDecisiones()
  }, [perfil, fetchDecisiones])

  useEffect(() => {
    if (tab === 'semana' && !semanaData && !loadingSemana) fetchSemana()
  }, [tab, semanaData, loadingSemana, fetchSemana])

  useEffect(() => {
    function checkStatus() {
      const cfg = getStoredDevice()
      setGellineActivo(cfg.activo)
      if (!cfg.activo) { setGellineDebeGrabar(false); return }
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
      const dentro     = cur >= hm(cfg.apertura) && cur < hm(cfg.cierre)
      const enDescanso = cfg.descanso && cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin)
      setGellineDebeGrabar(dentro && !enDescanso)
    }
    checkStatus()
    const id = setInterval(checkStatus, 60_000)
    return () => clearInterval(id)
  }, [])

  const sendText = async () => {
    const texto = textInput.trim()
    if (!texto || loading) return
    setTextInput('')
    setError(null)
    setLoading(true)
    try {
      const res  = await fetch(`${API}/texto`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ texto, ...(perfil && { perfil }) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error del servidor')
      setDecisiones(data.decisiones)
      setLastUpdate(new Date())
      setTab('hoy')
    } catch (e) {
      setError(e.message || 'Error al enviar.')
    } finally {
      setLoading(false)
    }
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  if (!perfil) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="setup-hero">
            <div className="setup-logo">G</div>
            <h1 className="setup-title">Bienvenido a Gelline</h1>
            <p className="setup-sub">Tu asistente que aprende escuchando tu negocio</p>
          </div>
          <ProfileForm onSave={savePerfil} />
        </div>
      </div>
    )
  }

  // ── Config screen ──────────────────────────────────────────────────────────

  if (view === 'dispositivo') {
    return <ConfigurarDispositivo onBack={handleBackFromConfig} />
  }

  // ── Decisiones del tab activo ──────────────────────────────────────────────

  const currentData    = tab === 'hoy' ? decisiones : semanaData
  const currentLoading = tab === 'hoy' ? (loading || analyzing) : loadingSemana
  const parsed         = parseDecisiones(currentData)
  const isArray        = Array.isArray(parsed)

  // ── Main screen ────────────────────────────────────────────────────────────

  return (
    <div className="app">

      <header className="app-header">
        <div className="header-date">{formatDateLong()}</div>
        <div className="header-row">
          <h1 className="header-nombre">{perfil.nombre}</h1>
          <button
            className="header-settings"
            onClick={() => setView('dispositivo')}
            aria-label="Mi dispositivo"
          >
            ⚙
          </button>
        </div>
      </header>

      {(() => {
        const s = getGellineStatus(getStoredDevice(), gellineDebeGrabar)
        return (
          <div className="status-badge">
            <span className={`status-dot ${s.pulse ? 'pulse' : ''}`} style={{ background: s.dot }} />
            <span className="status-text">{s.text}</span>
          </div>
        )
      })()}

      <div className="tabs">
        <button
          className={`tab-btn ${tab === 'hoy' ? 'active' : ''}`}
          onClick={() => setTab('hoy')}
        >
          Hoy
        </button>
        <button
          className={`tab-btn ${tab === 'semana' ? 'active' : ''}`}
          onClick={() => setTab('semana')}
        >
          Esta semana
        </button>
        <button
          className="tab-refresh"
          onClick={tab === 'hoy' ? fetchDecisiones : fetchSemana}
          disabled={currentLoading}
          aria-label="Actualizar"
        >
          ↻
        </button>
      </div>

      <div className="content-area">
        <h2 className="section-title">
          {tab === 'hoy' ? 'Lo que encontré hoy' : 'Resumen de la semana'}
        </h2>

        {currentLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Estoy analizando lo que escuché...</p>
          </div>
        ) : error ? (
          <div className="error-msg">{error}</div>
        ) : !currentData ? (
          <div className="empty-state">
            <div className="empty-icon">👂</div>
            <p className="empty-title">Todavía no escuché nada hoy</p>
            <p className="empty-sub">Cuando haya conversaciones, acá vas a ver mis sugerencias</p>
            <button className="analizar-btn" onClick={triggerAnalisis} disabled={analyzing}>
              Ver resumen de hoy
            </button>
          </div>
        ) : isArray ? (
          <div className="decisions-list">
            {parsed.map(dec => (
              <DecisionCard
                key={dec.id}
                decision={dec}
                rating={ratings[dec.id] || 0}
                onRate={rateDecision}
              />
            ))}
          </div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown>{currentData}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="query-bar">
        <input
          className="query-input"
          type="text"
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendText()}
          placeholder="Preguntale algo a Gelline..."
          disabled={loading}
        />
        <button
          className="query-btn"
          onClick={sendText}
          disabled={loading || !textInput.trim()}
          aria-label="Enviar"
        >
          →
        </button>
      </div>

      {showEdit && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowEdit(false)}
        >
          <div className="modal-card">
            <div className="modal-header">
              <h3>Tu negocio</h3>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <ProfileForm
              initial={perfil}
              onSave={savePerfil}
              onCancel={() => setShowEdit(false)}
            />
          </div>
        </div>
      )}

    </div>
  )
}
