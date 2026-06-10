import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API         = 'https://kiosco-ai.onrender.com'
const STORAGE_KEY = 'kiosco_perfil'
const DEVICE_KEY  = 'kiosco_dispositivo'

const TIPOS = ['kiosco', 'carnicería', 'verdulería', 'ropa', 'almacén', 'panadería', 'otro']
const CLIENTES_OPTS = ['familias', 'estudiantes', 'oficinistas', 'vecinos del barrio', 'jubilados']

const DEFAULT_DEVICE = {
  activo:           false,
  apertura:         '09:00',
  cierre:           '20:00',
  saludoAutomatico: false,
  descanso:         false,
  descansoInicio:   '13:00',
  descansoFin:      '14:00',
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
        <input className="pf-input" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Kiosco López, Almacén El Buen Precio..." required />
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
        <input className="pf-input" value={barrio} onChange={e => setBarrio(e.target.value)}
          placeholder="Ej: Lomas de Zamora, Villa Urquiza..." required />
      </div>

      <div className="pf-group">
        <label className="pf-label">4. ¿Cómo son tus clientes principales?</label>
        <div className="pf-chips">
          {CLIENTES_OPTS.map(opt => (
            <button key={opt} type="button"
              className={`pf-chip ${clientes.includes(opt) ? 'active' : ''}`}
              onClick={() => toggleCliente(opt)}>
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
          <button type="button" className="pf-btn-cancel" onClick={onCancel}>Cancelar</button>
        )}
        <button type="submit" className="pf-btn-save">
          {onCancel ? 'Guardar cambios' : 'Guardar y comenzar →'}
        </button>
      </div>
    </form>
  )
}

// ── Configurar Dispositivo ────────────────────────────────────────────────────

function ConfigurarDispositivo({ onBack }) {
  const [config,     setConfig]     = useState(getStoredDevice)
  const [debeGrabar, setDebeGrabar] = useState(false)

  const configRef   = useRef(config)
  configRef.current = config

  // ── Carga inicial desde servidor ──────────────────────────────────────────

  useEffect(() => {
    async function cargarConfig() {
      try {
        const res = await fetch(`${API}/config`)
        if (!res.ok) return
        const data = await res.json()
        const next = {
          activo:           data.activo            ?? false,
          apertura:         data.apertura          ?? '09:00',
          cierre:           data.cierre            ?? '20:00',
          descanso:         data.descanso          ?? false,
          descansoInicio:   data.descanso_inicio   ?? '13:00',
          descansoFin:      data.descanso_fin      ?? '14:00',
          saludoAutomatico: data.saludo_automatico ?? false,
        }
        localStorage.setItem(DEVICE_KEY, JSON.stringify(next))
        setConfig(next)
        setDebeGrabar(data.debe_grabar ?? false)
      } catch { /* usa fallback de localStorage */ }
    }
    cargarConfig()
  }, [])

  // Refresca el badge cada minuto sin tocar el micrófono
  useEffect(() => {
    const check = () => {
      const cfg = configRef.current
      if (!cfg.activo) { setDebeGrabar(false); return }
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
      const dentro    = cur >= hm(cfg.apertura) && cur < hm(cfg.cierre)
      const enDescanso = cfg.descanso &&
        cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin)
      setDebeGrabar(dentro && !enDescanso)
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

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
    } catch { /* ignora errores de red */ }
  }

  function getEstado() {
    if (!config.activo) return { label: 'Inactivo',        cls: 'inactivo' }
    if (debeGrabar)     return { label: 'Escuchando',      cls: 'escuchando' }
    const cfg = configRef.current
    const now = new Date()
    const cur = now.getHours() * 60 + now.getMinutes()
    const hm  = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    if (cfg.descanso && cur >= hm(cfg.descansoInicio) && cur < hm(cfg.descansoFin))
      return { label: 'En descanso', cls: 'descanso' }
    return { label: 'Fuera de horario', cls: 'fuera' }
  }

  const estado = getEstado()

  return (
    <div className="cd-screen">
      <header className="cd-header">
        <button className="cd-back" onClick={onBack}>
          ← Volver
        </button>
        <span className="cd-title">Configurar dispositivo</span>
        <span />
      </header>

      <div className="cd-content">

        {/* Estado actual */}
        <div className={`cd-estado ${estado.cls}`}>
          <span className="cd-estado-dot" />
          <span className="cd-estado-label">{estado.label}</span>
        </div>

        {/* Toggle asistente activo */}
        <div className="cd-card">
          <div className="cd-row">
            <div className="cd-row-info">
              <span className="cd-row-label">Asistente activo</span>
              <span className="cd-row-sub">
                Activa la escucha automática según el horario configurado
              </span>
            </div>
            <button
              className={`cd-toggle ${config.activo ? 'on' : ''}`}
              onClick={() => saveConfig({ activo: !configRef.current.activo })}
              aria-label="Activar asistente"
            />
          </div>
        </div>

        {/* Horario */}
        <div className="cd-card">
          <p className="cd-card-title">Horario</p>
          <div className="cd-time-row">
            <label className="cd-time-label">Hora de apertura</label>
            <input
              className="cd-time-input"
              type="time"
              value={config.apertura}
              onChange={e => saveConfig({ apertura: e.target.value })}
            />
          </div>
          <div className="cd-sep" />
          <div className="cd-time-row">
            <label className="cd-time-label">Hora de cierre</label>
            <input
              className="cd-time-input"
              type="time"
              value={config.cierre}
              onChange={e => saveConfig({ cierre: e.target.value })}
            />
          </div>
        </div>

        {/* Descanso al mediodía */}
        <div className="cd-card">
          <div className="cd-row">
            <div className="cd-row-info">
              <span className="cd-row-label">Descanso al mediodía</span>
              <span className="cd-row-sub">
                Pausa la grabación durante el horario de descanso
              </span>
            </div>
            <button
              className={`cd-toggle ${config.descanso ? 'on' : ''}`}
              onClick={() => saveConfig({ descanso: !config.descanso })}
              aria-label="Activar descanso"
            />
          </div>
          {config.descanso && (
            <>
              <div className="cd-sep" />
              <div className="cd-time-row">
                <label className="cd-time-label">Inicio descanso</label>
                <input
                  className="cd-time-input"
                  type="time"
                  value={config.descansoInicio}
                  onChange={e => saveConfig({ descansoInicio: e.target.value })}
                />
              </div>
              <div className="cd-sep" />
              <div className="cd-time-row">
                <label className="cd-time-label">Fin descanso</label>
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

        {/* Toggle saludo automático */}
        <div className="cd-card">
          <div className="cd-row">
            <div className="cd-row-info">
              <span className="cd-row-label">Saludo automático al abrir</span>
              <span className="cd-row-sub">
                Reproduce un saludo cuando empieza el horario
              </span>
            </div>
            <button
              className={`cd-toggle ${config.saludoAutomatico ? 'on' : ''}`}
              onClick={() => saveConfig({ saludoAutomatico: !config.saludoAutomatico })}
              aria-label="Activar saludo automático"
            />
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [perfil,     setPerfil]     = useState(getStoredPerfil)
  const [view,       setView]       = useState('main')   // 'main' | 'dispositivo'
  const [showEdit,   setShowEdit]   = useState(false)
  const [decisiones, setDecisiones] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error,      setError]      = useState(null)
  const [textInput,  setTextInput]  = useState('')

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

  // ── Configurar Dispositivo screen ───────────────────────────────────────────

  if (view === 'dispositivo') {
    return <ConfigurarDispositivo onBack={() => setView('main')} />
  }

  // ── Main screen ─────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <header className="header">
        <div className="header-main">
          <button className="cd-nav-btn" onClick={() => setView('dispositivo')}>
            ⚙ Configurar
          </button>
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
        <div className="mic-section mic-disabled">
          <span className="mic-soon">Grabación por voz próximamente</span>
        </div>

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
