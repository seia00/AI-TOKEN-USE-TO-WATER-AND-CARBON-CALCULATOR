import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level   = 1 | 2 | 3
type Tier    = 'Lightweight' | 'Standard' | 'Heavy' | 'Image'
type Company = 'Anthropic' | 'OpenAI' | 'Google' | 'Meta' | 'Mixed'
type Unit    = 'messages' | 'tokens' | 'hours' | 'api-calls' | 'conversations'

interface Model {
  id: string; name: string; company: Company; tier: Tier; emoji: string
  waterPer1kTokens: number; kWhPerMTokens: number
}
interface Results { waterL: number; kWh: number; carbonKg: number; totalTokens: number }

// ─── Data ─────────────────────────────────────────────────────────────────────

const MODELS: Model[] = [
  { id: 'claude-haiku',  name: 'Claude Haiku',      company: 'Anthropic', tier: 'Lightweight', emoji: '🌿', waterPer1kTokens: 0.1,  kWhPerMTokens: 0.10 },
  { id: 'claude-sonnet', name: 'Claude Sonnet',      company: 'Anthropic', tier: 'Standard',    emoji: '🎵', waterPer1kTokens: 0.2,  kWhPerMTokens: 0.20 },
  { id: 'claude-opus',   name: 'Claude Opus',        company: 'Anthropic', tier: 'Heavy',       emoji: '🔮', waterPer1kTokens: 0.4,  kWhPerMTokens: 0.40 },
  { id: 'gpt4o-mini',    name: 'GPT-4o mini',        company: 'OpenAI',    tier: 'Lightweight', emoji: '⚡', waterPer1kTokens: 0.1,  kWhPerMTokens: 0.10 },
  { id: 'gpt4o',         name: 'GPT-4o',             company: 'OpenAI',    tier: 'Standard',    emoji: '🤖', waterPer1kTokens: 0.4,  kWhPerMTokens: 0.35 },
  { id: 'gpt4',          name: 'GPT-4',              company: 'OpenAI',    tier: 'Heavy',       emoji: '💡', waterPer1kTokens: 0.5,  kWhPerMTokens: 0.40 },
  { id: 'gpt5',          name: 'GPT-5',              company: 'OpenAI',    tier: 'Heavy',       emoji: '🚀', waterPer1kTokens: 0.5,  kWhPerMTokens: 0.45 },
  { id: 'gemini-flash',  name: 'Gemini Flash',       company: 'Google',    tier: 'Lightweight', emoji: '✨', waterPer1kTokens: 0.1,  kWhPerMTokens: 0.10 },
  { id: 'gemini-pro',    name: 'Gemini Pro',         company: 'Google',    tier: 'Standard',    emoji: '💎', waterPer1kTokens: 0.2,  kWhPerMTokens: 0.20 },
  { id: 'llama3',        name: 'Llama 3',            company: 'Meta',      tier: 'Standard',    emoji: '🦙', waterPer1kTokens: 0.2,  kWhPerMTokens: 0.20 },
  { id: 'dalle-mj',      name: 'DALL-E / Midjourney', company: 'Mixed',   tier: 'Image',       emoji: '🎨', waterPer1kTokens: 0.8,  kWhPerMTokens: 0.02 },
]

interface UnitCfg { label: string; emoji: string; min: number; max: number; step: number; tpu: (lc: boolean) => number; desc: string }
const UNITS: Record<Unit, UnitCfg> = {
  messages:      { label: 'Messages',      emoji: '💬', min: 1,   max: 5000,   step: 1,   tpu: (lc) => lc ? 1500 : 300,  desc: 'Individual chat messages sent'   },
  tokens:        { label: 'Tokens',        emoji: '🔢', min: 100, max: 1000000,step: 100, tpu: () => 1,                  desc: 'Raw token count (for devs)'      },
  hours:         { label: 'Hours',         emoji: '⏱', min: 1,   max: 200,    step: 1,   tpu: () => 30000,              desc: 'Active hours of AI usage'        },
  'api-calls':   { label: 'API Calls',     emoji: '📡', min: 1,   max: 50000,  step: 1,   tpu: () => 500,               desc: 'API requests (avg ~500 tokens)'  },
  conversations: { label: 'Conversations', emoji: '🗨', min: 1,   max: 1000,   step: 1,   tpu: (lc) => lc ? 30000 : 6000, desc: 'Full back-and-forth sessions'  },
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const CO: Record<Company, string> = { Anthropic: '#8b5cf6', OpenAI: '#10b981', Google: '#3b82f6', Meta: '#f97316', Mixed: '#ec4899' }
const TC: Record<Tier,    string> = { Lightweight: '#22c55e', Standard: '#eab308', Heavy: '#ef4444', Image: '#a78bfa' }

const PX = "'Press Start 2P', monospace"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTotalTokens(unit: Unit, val: number, lc: boolean) { return val * UNITS[unit].tpu(lc) }

function calculate(model: Model, tokens: number, imgCount: number): Results {
  if (model.tier === 'Image') {
    const kWh = imgCount * 0.02
    return { waterL: imgCount * 0.8, kWh, carbonKg: kWh * 0.3, totalTokens: 0 }
  }
  const kWh = (tokens / 1_000_000) * model.kWhPerMTokens
  return { waterL: (tokens / 1000) * model.waterPer1kTokens, kWh, carbonKg: kWh * 0.3, totalTokens: tokens }
}

function fmtWater(l: number) {
  if (l < 1)    return `${(l * 1000).toFixed(1)} mL`
  if (l < 1000) return `${l.toFixed(2)} L`
  return `${(l / 1000).toFixed(2)} kL`
}
function fmtCarbon(kg: number) {
  if (kg < 0.001) return `${(kg * 1e6).toFixed(1)} μg CO₂`
  if (kg < 1)     return `${(kg * 1000).toFixed(2)} g CO₂`
  return `${kg.toFixed(3)} kg CO₂`
}
function fmtKwh(kwh: number) {
  if (kwh < 1) return `${(kwh * 1000).toFixed(2)} Wh`
  return `${kwh.toFixed(4)} kWh`
}
function fmt2(n: number) {
  if (n < 0.01) return '<0.01'
  if (n < 10)   return n.toFixed(2)
  if (n < 1000) return n.toFixed(1)
  if (n < 1e6)  return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1e6).toFixed(1)}M`
}
function impactInfo(waterL: number) {
  if (waterL < 0.1) return { label: 'MINIMAL',  fg: '#22c55e', bg: '#166534', pct: 12 }
  if (waterL < 1)   return { label: 'LOW',       fg: '#facc15', bg: '#713f12', pct: 35 }
  if (waterL < 10)  return { label: 'MODERATE',  fg: '#f97316', bg: '#7c2d12', pct: 65 }
  return                   { label: 'CRITICAL',  fg: '#ef4444', bg: '#7f1d1d', pct: 92 }
}

// ─── Pixel Dropdown ───────────────────────────────────────────────────────────

function PixelDropdown({ value, onChange }: { value: Model | null; onChange: (m: Model) => void }) {
  const [open, setOpen]   = useState(false)
  const [rect, setRect]   = useState<DOMRect | null>(null)
  const triggerRef        = useRef<HTMLButtonElement>(null)
  const listRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (listRef.current?.contains(e.target as Node))    return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function toggle() {
    if (!open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(v => !v)
  }

  const btnStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
    background: 'rgba(0,0,0,0.72)', border: '3px solid rgba(255,255,255,0.8)',
    boxShadow: '5px 5px 0 rgba(0,0,0,0.9)', fontFamily: PX, fontSize: '10px', color: '#fff',
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={triggerRef} onClick={toggle} style={btnStyle}>
        {value ? (
          <>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{value.emoji}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</span>
            <span style={{ fontSize: '9px', padding: '3px 7px', background: CO[value.company] + '30', color: CO[value.company], border: `1px solid ${CO[value.company]}80`, whiteSpace: 'nowrap' }}>
              {value.company}
            </span>
            <span style={{ width: '8px', height: '8px', background: TC[value.tier], flexShrink: 0 }} />
          </>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>— SELECT MODEL —</span>
        )}
        <span style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && rect && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width,
            zIndex: 9999, maxHeight: '320px', overflowY: 'auto',
            background: 'rgba(5,3,12,0.97)', border: '3px solid rgba(255,255,255,0.8)',
            borderTop: 'none', boxShadow: '5px 5px 0 rgba(0,0,0,0.9)',
          }}
        >
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => { onChange(m); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 16px', textAlign: 'left', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: m.id === value?.id ? 'rgba(139,92,246,0.25)' : 'transparent',
                fontFamily: PX, fontSize: '9px', color: '#fff',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (m.id !== value?.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = m.id === value?.id ? 'rgba(139,92,246,0.25)' : 'transparent' }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{m.emoji}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span style={{ fontSize: '8px', padding: '2px 6px', color: CO[m.company], border: `1px solid ${CO[m.company]}40`, whiteSpace: 'nowrap' }}>{m.company}</span>
              <span style={{ width: '7px', height: '7px', background: TC[m.tier], flexShrink: 0 }} />
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

function pixelCard(borderColor = 'rgba(255,255,255,0.25)', bg = 'rgba(0,0,0,0.6)'): React.CSSProperties {
  return { background: bg, border: `3px solid ${borderColor}`, boxShadow: `5px 5px 0 rgba(0,0,0,0.85)` }
}

function pxBtn(bg: string, fg: string, border: string): React.CSSProperties {
  return {
    width: '100%', padding: '15px', fontFamily: PX, fontSize: '11px', letterSpacing: '0.06em',
    background: bg, color: fg, border: `3px solid ${border}`,
    boxShadow: '5px 5px 0 rgba(0,0,0,0.85)', cursor: 'pointer',
  }
}

// ─── Level Panels ─────────────────────────────────────────────────────────────

function LevelSky({ model, onSelect, onDrop }: {
  model: Model | null
  onSelect: (m: Model) => void
  onDrop: () => void
}) {
  return (
    <div
      className="scanlines"
      style={{
        height: '100vh', position: 'relative', overflow: 'hidden',
        backgroundImage: "url('/sky.png')", backgroundSize: 'cover',
        backgroundPosition: 'center bottom', imageRendering: 'pixelated',
        backgroundColor: '#3a7bd5',
      }}
    >
      {/* Sky colour overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,30,80,0.45) 0%, rgba(20,60,150,0.25) 100%)' }} />

      {/* Floating clouds */}
      <span className="float-1" style={{ position: 'absolute', top: '8%',  left: '5%',  fontSize: '32px', opacity: 0.7, pointerEvents: 'none' }}>☁️</span>
      <span className="float-2" style={{ position: 'absolute', top: '15%', right: '8%', fontSize: '24px', opacity: 0.6, pointerEvents: 'none' }}>☁️</span>
      <span className="float-3" style={{ position: 'absolute', top: '6%',  left: '55%', fontSize: '20px', opacity: 0.5, pointerEvents: 'none' }}>☁️</span>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px', overflowY: 'auto' }}>

        {/* Level badge */}
        <div style={{ ...pixelCard('rgba(255,255,255,0.5)', 'rgba(0,0,0,0.55)'), marginBottom: '12px', padding: '6px 14px', fontFamily: PX, fontSize: '8px', color: '#93c5fd', letterSpacing: '0.12em' }}>
          ▲ LEVEL 1: THE SKY
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: PX, fontSize: 'clamp(15px, 2.8vw, 24px)', color: '#fff', textShadow: '4px 4px 0 rgba(0,0,30,0.9)', textAlign: 'center', lineHeight: 1.8, margin: '0 0 8px' }}>
          AI IMPACT QUEST
        </h1>
        <p style={{ fontFamily: PX, fontSize: '8px', color: 'rgba(255,255,255,0.55)', marginBottom: '32px', textAlign: 'center', lineHeight: 2 }}>
          DISCOVER THE HIDDEN COST OF AI
        </p>

        {/* Dropdown */}
        <div style={{ width: '100%', maxWidth: '440px', marginBottom: '20px' }}>
          <div style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', letterSpacing: '0.1em' }}>
            CHOOSE YOUR MODEL
          </div>
          <PixelDropdown value={model} onChange={onSelect} />
        </div>

        {/* Model stat card */}
        {model && (
          <div style={{ ...pixelCard('rgba(255,255,255,0.3)', 'rgba(0,0,0,0.6)'), width: '100%', maxWidth: '440px', padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'COMPANY', value: model.company.toUpperCase(), color: CO[model.company] },
              { label: 'TIER',    value: model.tier.toUpperCase(),    color: TC[model.tier]    },
              { label: '💧 WATER/1K TOKENS', value: model.tier === 'Image' ? '0.8L / IMG' : `${model.waterPer1kTokens}L`, color: '#60a5fa' },
              { label: '⚡ ENERGY', value: model.tier === 'Image' ? '0.02kWh/IMG' : `${model.kWhPerMTokens}kWh/M`, color: '#fde047' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>{s.label}</div>
                <div style={{ fontFamily: PX, fontSize: '9px', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTA button */}
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <button
            onClick={() => model && onDrop()}
            disabled={!model}
            style={{
              ...pxBtn(model ? '#7c3aed' : 'rgba(60,60,80,0.6)', '#fff', model ? '#c4b5fd' : 'rgba(255,255,255,0.15)'),
              opacity: model ? 1 : 0.6, cursor: model ? 'pointer' : 'not-allowed',
            }}
            onMouseDown={e => { if (model) (e.currentTarget as HTMLElement).style.transform = 'translate(3px,3px)' }}
            onMouseUp={e =>   { (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            {model ? '▼  DIG DEEPER  ▼' : 'SELECT A MODEL FIRST'}
          </button>
          {model && (
            <p style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center' }}>
              CONTINUE TO LEVEL 2 — THE FIELDS
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LevelFields({ model, unit, onUnitChange, value, onValueChange, longContext, onLcChange, tokens, onDrop }: {
  model: Model | null; unit: Unit; onUnitChange: (u: Unit) => void
  value: number; onValueChange: (v: number) => void
  longContext: boolean; onLcChange: (v: boolean) => void
  tokens: number; onDrop: () => void
}) {
  const isImg = model?.tier === 'Image'

  function clamp(raw: string) {
    const n = parseInt(raw, 10)
    if (isNaN(n)) return
    const cfg = UNITS[unit]
    const max = isImg ? 500 : cfg.max
    const min = isImg ? 1   : cfg.min
    onValueChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <div
      className="scanlines"
      style={{
        height: '100vh', position: 'relative', overflow: 'hidden',
        backgroundImage: "url('/fields.png')", backgroundSize: 'cover',
        backgroundPosition: 'center center', imageRendering: 'pixelated',
        backgroundColor: '#2d6a2d',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,20,0,0.5) 0%, rgba(0,40,10,0.4) 100%)' }} />

      {/* Floating field decor */}
      <span className="float-1" style={{ position: 'absolute', bottom: '12%', left: '4%',  fontSize: '28px', opacity: 0.65, pointerEvents: 'none' }}>🌾</span>
      <span className="float-2" style={{ position: 'absolute', bottom: '10%', right: '5%', fontSize: '24px', opacity: 0.55, pointerEvents: 'none' }}>🌿</span>
      <span className="float-3" style={{ position: 'absolute', top: '10%',    right: '3%', fontSize: '20px', opacity: 0.5,  pointerEvents: 'none' }}>🍃</span>

      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>

        {/* Level badge */}
        <div style={{ ...pixelCard('rgba(74,222,128,0.5)', 'rgba(0,0,0,0.6)'), marginBottom: '12px', padding: '6px 14px', fontFamily: PX, fontSize: '8px', color: '#4ade80', letterSpacing: '0.12em' }}>
          ▶ LEVEL 2: THE FIELDS
        </div>

        <h2 style={{ fontFamily: PX, fontSize: 'clamp(13px, 2.2vw, 18px)', color: '#fff', textShadow: '4px 4px 0 rgba(0,0,0,0.9)', textAlign: 'center', lineHeight: 1.8, margin: '0 0 24px' }}>
          ENTER YOUR USAGE
        </h2>

        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Unit type selector */}
          {!isImg && (
            <div style={{ ...pixelCard('rgba(74,222,128,0.3)', 'rgba(0,0,0,0.55)'), padding: '14px' }}>
              <div style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px', letterSpacing: '0.1em' }}>
                UNIT TYPE
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Object.keys(UNITS) as Unit[]).map(u => (
                  <button
                    key={u}
                    onClick={() => onUnitChange(u)}
                    style={{
                      padding: '7px 10px', fontFamily: PX, fontSize: '7px', cursor: 'pointer',
                      background: unit === u ? '#4ade80' : 'rgba(0,0,0,0.5)',
                      color: unit === u ? '#000' : 'rgba(255,255,255,0.6)',
                      border: unit === u ? '2px solid #86efac' : '2px solid rgba(255,255,255,0.2)',
                      boxShadow: unit === u ? '3px 3px 0 rgba(0,0,0,0.7)' : 'none',
                    }}
                  >
                    {UNITS[u].emoji} {UNITS[u].label.toUpperCase()}
                  </button>
                ))}
              </div>
              <p style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                {UNITS[unit].desc.toUpperCase()}
              </p>
            </div>
          )}

          {/* Slider + input */}
          <div style={{ ...pixelCard('rgba(74,222,128,0.4)', 'rgba(0,0,0,0.6)'), padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontFamily: PX, fontSize: '8px', color: '#4ade80' }}>
                {isImg ? '🎨 IMAGES' : `${UNITS[unit].emoji} ${UNITS[unit].label.toUpperCase()}`}
              </span>
              <input
                type="number"
                min={isImg ? 1 : UNITS[unit].min}
                max={isImg ? 500 : UNITS[unit].max}
                value={value}
                onChange={e => clamp(e.target.value)}
                style={{
                  width: '110px', background: 'rgba(0,0,0,0.75)', color: '#4ade80',
                  border: '2px solid rgba(74,222,128,0.5)', padding: '5px 9px',
                  fontFamily: PX, fontSize: '11px', textAlign: 'right',
                }}
              />
            </div>
            <input
              type="range"
              min={isImg ? 1 : UNITS[unit].min}
              max={isImg ? 500 : UNITS[unit].max}
              step={isImg ? 1 : UNITS[unit].step}
              value={value}
              onChange={e => onValueChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4ade80' }}
            />
            <div style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.35)', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {isImg
                ? `${value} IMAGE${value !== 1 ? 'S' : ''} → ${(value * 0.8).toFixed(1)}L WATER`
                : `≈ ${tokens >= 1000000 ? (tokens / 1000000).toFixed(2) + 'M' : tokens >= 1000 ? (tokens / 1000).toFixed(1) + 'K' : tokens} TOKENS TOTAL`}
            </div>
          </div>

          {/* Long-context toggle */}
          {!isImg && (unit === 'messages' || unit === 'conversations') && (
            <div style={{ ...pixelCard('rgba(255,255,255,0.15)', 'rgba(0,0,0,0.5)'), padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: PX, fontSize: '7px', color: '#fff', marginBottom: '4px' }}>LONG CONTEXT</div>
                <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.35)' }}>
                  {unit === 'messages' ? '1500 VS 300 TOKENS/MSG' : '30K VS 6K TOKENS/CONVO'}
                </div>
              </div>
              <button
                role="switch" aria-checked={longContext}
                onClick={() => onLcChange(!longContext)}
                style={{
                  width: '48px', height: '26px', position: 'relative', cursor: 'pointer',
                  background: longContext ? '#4ade80' : 'rgba(255,255,255,0.15)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px', width: '16px', height: '16px',
                  background: longContext ? '#000' : '#fff',
                  left: longContext ? '26px' : '3px', transition: 'left 0.15s',
                }} />
              </button>
            </div>
          )}

          {/* Calculate button */}
          <button
            onClick={onDrop}
            style={pxBtn('#16a34a', '#fff', '#4ade80')}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
            onMouseUp={e =>   (e.currentTarget.style.transform = '')}
          >
            ▼  REVEAL THE TRUTH  ▼
          </button>
        </div>
      </div>
    </div>
  )
}

function LevelMines({ results, model, onReset }: {
  results: Results | null; model: Model | null; onReset: () => void
}) {
  const [showSources, setShowSources] = useState(false)
  const impact = results ? impactInfo(results.waterL) : null

  return (
    <div
      className="scanlines"
      style={{
        height: '100vh', position: 'relative', overflow: 'hidden',
        backgroundImage: "url('/mines.png')", backgroundSize: 'cover',
        backgroundPosition: 'center center', imageRendering: 'pixelated',
        backgroundColor: '#0d0600',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(20,5,0,0.65) 100%)' }} />

      {/* Mine decor */}
      <span className="float-2" style={{ position: 'absolute', top: '8%',  left: '3%',  fontSize: '24px', opacity: 0.5, pointerEvents: 'none' }}>⛏️</span>
      <span className="float-1" style={{ position: 'absolute', top: '12%', right: '4%', fontSize: '20px', opacity: 0.4, pointerEvents: 'none' }}>💎</span>
      <span className="float-3" style={{ position: 'absolute', bottom: '8%', left: '4%', fontSize: '18px', opacity: 0.35, pointerEvents: 'none' }}>🪨</span>

      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px', overflowY: 'auto' }}>

        {/* Level badge */}
        <div style={{ ...pixelCard('rgba(239,68,68,0.5)', 'rgba(0,0,0,0.7)'), margin: '8px 0 12px', padding: '6px 14px', fontFamily: PX, fontSize: '8px', color: '#f87171', letterSpacing: '0.12em' }}>
          ▼ LEVEL 3: THE MINES
        </div>

        <h2 style={{ fontFamily: PX, fontSize: 'clamp(13px, 2vw, 16px)', color: '#fff', textShadow: '4px 4px 0 rgba(200,0,0,0.4)', textAlign: 'center', lineHeight: 1.8, margin: '0 0 20px' }}>
          THE REAL COST
        </h2>

        {results && impact && model && (
          <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Water + Carbon cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ ...pixelCard('#2563eb', 'rgba(0,20,60,0.75)'), padding: '16px' }}>
                <div style={{ fontFamily: PX, fontSize: '7px', color: '#60a5fa', marginBottom: '8px' }}>💧 WATER</div>
                <div style={{ fontFamily: PX, fontSize: 'clamp(11px, 2.4vw, 15px)', color: '#fff', lineHeight: 1.5 }}>{fmtWater(results.waterL)}</div>
                <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>CONSUMED</div>
              </div>
              <div style={{ ...pixelCard('#16a34a', 'rgba(0,40,10,0.75)'), padding: '16px' }}>
                <div style={{ fontFamily: PX, fontSize: '7px', color: '#4ade80', marginBottom: '8px' }}>🌿 CARBON</div>
                <div style={{ fontFamily: PX, fontSize: 'clamp(11px, 2.4vw, 15px)', color: '#fff', lineHeight: 1.5 }}>{fmtCarbon(results.carbonKg)}</div>
                <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>EMITTED</div>
              </div>
            </div>

            {/* Impact HP bar */}
            <div style={{ ...pixelCard(impact.fg, impact.bg + '99'), padding: '14px', boxShadow: `5px 5px 0 rgba(0,0,0,0.85), 0 0 24px ${impact.fg}35` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.5)' }}>IMPACT LEVEL</span>
                <span style={{ fontFamily: PX, fontSize: '10px', color: impact.fg }}>{impact.label}</span>
              </div>
              {/* Pixel HP bar */}
              <div style={{ height: '18px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.2)', overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    height: '100%', width: `${impact.pct}%`, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
                    background: `repeating-linear-gradient(90deg, ${impact.fg} 0px, ${impact.fg} 10px, ${impact.bg} 10px, ${impact.bg} 12px)`,
                  }}
                />
                {/* Pixel tick marks */}
                {[25, 50, 75].map(p => (
                  <div key={p} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p}%`, width: '2px', background: 'rgba(0,0,0,0.6)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.2)' }}>
                <span>MINIMAL</span><span>LOW</span><span>MOD</span><span>CRIT</span>
              </div>
            </div>

            {/* Comparisons */}
            <div style={{ ...pixelCard('rgba(255,255,255,0.12)', 'rgba(0,0,0,0.55)'), padding: '14px' }}>
              <div style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', letterSpacing: '0.1em' }}>THAT'S EQUIVALENT TO…</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { e: '🍶', v: fmt2(results.waterL / 0.5),        l: 'WATER BOTTLES', s: '500mL each'      },
                  { e: '🚿', v: fmt2(results.waterL / 0.13),       l: 'SHOWER SECS',   s: '0.13L/sec'       },
                  { e: '📱', v: fmt2(results.kWh / 0.012),         l: 'PHONE CHARGES', s: '12Wh battery'    },
                  { e: '🚗', v: fmt2(results.carbonKg / 0.21),     l: 'KM DRIVEN',     s: '0.21kg CO₂/km'   },
                ].map(c => (
                  <div key={c.l} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{c.e}</span>
                    <div>
                      <div style={{ fontFamily: PX, fontSize: '10px', color: '#fff' }}>{c.v}</div>
                      <div style={{ fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{c.l}</div>
                      <div style={{ fontFamily: PX, fontSize: '5px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{c.s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Energy row */}
            <div style={{ ...pixelCard('rgba(250,204,21,0.3)', 'rgba(0,0,0,0.55)'), padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.5)' }}>⚡ ENERGY CONSUMED</span>
              <span style={{ fontFamily: PX, fontSize: '10px', color: '#fde047' }}>{fmtKwh(results.kWh)}</span>
            </div>

            {/* Data sources collapsible */}
            <div style={{ border: '2px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.45)' }}>
              <button
                onClick={() => setShowSources(v => !v)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontFamily: PX, fontSize: '7px', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', background: 'transparent', border: 'none' }}
              >
                <span>DATA SOURCES</span><span>{showSources ? '▲' : '▼'}</span>
              </button>
              {showSources && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', fontFamily: PX, fontSize: '6px', color: 'rgba(255,255,255,0.35)', lineHeight: 2 }}>
                  <p style={{ marginTop: '10px' }}>• LI ET AL. 2023 "MAKING AI LESS THIRSTY"</p>
                  <p>• IEA DATA CENTER ENERGY REPORTS 2023-2024</p>
                  <p>• GLOBAL AVG GRID: 0.3 KG CO2/KWH</p>
                  <p style={{ color: 'rgba(255,255,255,0.2)', marginTop: '6px' }}>ESTIMATES FOR EDUCATIONAL PURPOSES</p>
                </div>
              )}
            </div>

            {/* Play again */}
            <button
              onClick={onReset}
              style={pxBtn('#7f1d1d', '#fca5a5', '#ef4444')}
              onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
              onMouseUp={e =>   (e.currentTarget.style.transform = '')}
            >
              ▲  PLAY AGAIN  ▲
            </button>

            <div style={{ height: '16px' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AiImpactCalculator() {
  const [level,      setLevel]      = useState<Level>(1)
  const [dropping,   setDropping]   = useState(false)
  const [landing,    setLanding]    = useState(false)
  const [model,      setModel]      = useState<Model | null>(null)
  const [unit,       setUnit]       = useState<Unit>('messages')
  const [inputVal,   setInputVal]   = useState(50)
  const [longCtx,    setLongCtx]    = useState(false)

  const isImg     = model?.tier === 'Image'
  const tokens    = isImg ? 0 : getTotalTokens(unit, inputVal, longCtx)
  const results   = model ? calculate(model, tokens, isImg ? inputVal : 0) : null

  function drop() {
    if (dropping || level >= 3) return
    setDropping(true)
    setLevel(l => (l + 1) as Level)
    setTimeout(() => {
      setDropping(false)
      setLanding(true)
      setTimeout(() => setLanding(false), 450)
    }, 870)
  }

  function reset() {
    setLevel(1); setDropping(false); setLanding(false)
    setModel(null); setInputVal(50); setUnit('messages'); setLongCtx(false)
  }

  function handleModelSelect(m: Model) {
    setModel(m)
    if (m.tier === 'Image') { setUnit('messages'); setInputVal(10) }
    else setInputVal(50)
  }

  const LEVEL_COLORS: Record<Level, string> = { 1: '#93c5fd', 2: '#4ade80', 3: '#f87171' }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Screen flash overlay */}
      {dropping && (
        <div
          className="level-flash"
          style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}
        />
      )}

      {/* HUD: level indicator */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 8000, display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
        {([1, 2, 3] as Level[]).map(l => (
          <div
            key={l}
            style={{
              fontFamily: PX, fontSize: '7px', padding: '5px 8px',
              background: level === l ? LEVEL_COLORS[l] : 'rgba(0,0,0,0.55)',
              color: level === l ? '#000' : 'rgba(255,255,255,0.3)',
              border: `2px solid ${level === l ? LEVEL_COLORS[l] : 'rgba(255,255,255,0.15)'}`,
              boxShadow: level === l ? `3px 3px 0 rgba(0,0,0,0.7), 0 0 12px ${LEVEL_COLORS[l]}60` : 'none',
              transition: 'all 0.3s',
            }}
          >
            LV{l} {level > l ? '✓' : level === l ? '●' : '○'}
          </div>
        ))}
      </div>

      {/* Rumble wrapper */}
      <div className={landing ? 'rumble' : ''} style={{ height: '100%' }}>
        {/* Sliding panels container */}
        <div
          style={{
            transform: `translateY(-${(level - 1) * 100}vh)`,
            transition: dropping ? 'transform 0.87s cubic-bezier(0.32, 0, 0.67, 0)' : 'none',
            willChange: 'transform',
          }}
        >
          <LevelSky   model={model}  onSelect={handleModelSelect} onDrop={drop} />
          <LevelFields
            model={model} unit={unit} onUnitChange={setUnit}
            value={inputVal} onValueChange={setInputVal}
            longContext={longCtx} onLcChange={setLongCtx}
            tokens={tokens} onDrop={drop}
          />
          <LevelMines results={results} model={model} onReset={reset} />
        </div>
      </div>
    </div>
  )
}
