import { useState } from 'react'

type Tier = 'Lightweight' | 'Standard' | 'Heavy' | 'Image'
type Company = 'Anthropic' | 'OpenAI' | 'Google' | 'Meta' | 'Mixed'

interface Model {
  id: string
  name: string
  company: Company
  tier: Tier
  emoji: string
  waterPer1kTokens: number
  kWhPerMTokens: number
}

const MODELS: Model[] = [
  { id: 'claude-haiku',  name: 'Claude Haiku',      company: 'Anthropic', tier: 'Lightweight', emoji: '🌿', waterPer1kTokens: 0.1, kWhPerMTokens: 0.10 },
  { id: 'claude-sonnet', name: 'Claude Sonnet',      company: 'Anthropic', tier: 'Standard',    emoji: '🎵', waterPer1kTokens: 0.2, kWhPerMTokens: 0.20 },
  { id: 'claude-opus',   name: 'Claude Opus',        company: 'Anthropic', tier: 'Heavy',       emoji: '🔮', waterPer1kTokens: 0.4, kWhPerMTokens: 0.40 },
  { id: 'gpt4o-mini',    name: 'GPT-4o mini',        company: 'OpenAI',    tier: 'Lightweight', emoji: '⚡', waterPer1kTokens: 0.1, kWhPerMTokens: 0.10 },
  { id: 'gpt4o',         name: 'GPT-4o',             company: 'OpenAI',    tier: 'Standard',    emoji: '🤖', waterPer1kTokens: 0.4, kWhPerMTokens: 0.35 },
  { id: 'gpt4',          name: 'GPT-4',              company: 'OpenAI',    tier: 'Heavy',       emoji: '💡', waterPer1kTokens: 0.5, kWhPerMTokens: 0.40 },
  { id: 'gpt5',          name: 'GPT-5',              company: 'OpenAI',    tier: 'Heavy',       emoji: '🚀', waterPer1kTokens: 0.5, kWhPerMTokens: 0.45 },
  { id: 'gemini-flash',  name: 'Gemini Flash',       company: 'Google',    tier: 'Lightweight', emoji: '✨', waterPer1kTokens: 0.1, kWhPerMTokens: 0.10 },
  { id: 'gemini-pro',    name: 'Gemini Pro',         company: 'Google',    tier: 'Standard',    emoji: '💎', waterPer1kTokens: 0.2, kWhPerMTokens: 0.20 },
  { id: 'llama3',        name: 'Llama 3',            company: 'Meta',      tier: 'Standard',    emoji: '🦙', waterPer1kTokens: 0.2, kWhPerMTokens: 0.20 },
  { id: 'dalle-mj',      name: 'DALL-E/Midjourney',  company: 'Mixed',     tier: 'Image',       emoji: '🎨', waterPer1kTokens: 0.8, kWhPerMTokens: 0.02 },
]

const COMPANY_BADGE: Record<Company, string> = {
  Anthropic: 'bg-violet-500/20 text-violet-400 ring-violet-500/30',
  OpenAI:    'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  Google:    'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  Meta:      'bg-orange-500/20 text-orange-400 ring-orange-500/30',
  Mixed:     'bg-pink-500/20 text-pink-400 ring-pink-500/30',
}

const TIER_DOT: Record<Tier, string> = {
  Lightweight: 'bg-emerald-400',
  Standard:    'bg-amber-400',
  Heavy:       'bg-red-400',
  Image:       'bg-violet-400',
}

function calculate(model: Model, messageCount: number, imageCount: number, longContext: boolean) {
  if (model.tier === 'Image') {
    const waterL   = imageCount * 0.8
    const kWh      = imageCount * 0.02
    const carbonKg = kWh * 0.3
    return { waterL, kWh, carbonKg, totalTokens: 0 }
  }
  const tokensPerMessage = longContext ? 1500 : 300
  const totalTokens      = messageCount * tokensPerMessage
  const waterL           = (totalTokens / 1000) * model.waterPer1kTokens
  const kWh              = (totalTokens / 1_000_000) * model.kWhPerMTokens
  const carbonKg         = kWh * 0.3
  return { waterL, kWh, carbonKg, totalTokens }
}

function fmtWater(l: number): string {
  if (l < 1)    return `${(l * 1000).toFixed(1)} mL`
  if (l < 1000) return `${l.toFixed(2)} L`
  return `${(l / 1000).toFixed(2)} kL`
}

function fmtCarbon(kg: number): string {
  if (kg < 0.001) return `${(kg * 1_000_000).toFixed(1)} μg CO₂`
  if (kg < 1)     return `${(kg * 1000).toFixed(2)} g CO₂`
  return `${kg.toFixed(3)} kg CO₂`
}

function fmtKwh(kwh: number): string {
  if (kwh < 0.001) return `${(kwh * 1000).toFixed(3)} Wh`
  if (kwh < 1)     return `${(kwh * 1000).toFixed(2)} Wh`
  return `${kwh.toFixed(4)} kWh`
}

function impactLevel(waterL: number) {
  if (waterL < 0.1) return { label: 'Minimal',  color: '#10b981', pct: 12 }
  if (waterL < 1)   return { label: 'Low',       color: '#fbbf24', pct: 35 }
  if (waterL < 10)  return { label: 'Moderate',  color: '#f97316', pct: 65 }
  return                   { label: 'High',      color: '#ef4444', pct: 90 }
}

export default function AiImpactCalculator() {
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [messageCount,  setMessageCount]  = useState(50)
  const [imageCount,    setImageCount]    = useState(10)
  const [longContext,   setLongContext]   = useState(false)
  const [showSources,   setShowSources]   = useState(false)
  const [showInfo,      setShowInfo]      = useState(false)

  const selectedModel = MODELS.find(m => m.id === selectedId) ?? null
  const isImage       = selectedModel?.tier === 'Image'
  const results       = selectedModel
    ? calculate(selectedModel, messageCount, imageCount, longContext)
    : null
  const impact        = results ? impactLevel(results.waterL) : null

  function handleMsgInput(raw: string) {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) setMessageCount(Math.min(10000, Math.max(1, n)))
  }

  function handleImgInput(raw: string) {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) setImageCount(Math.min(500, Math.max(1, n)))
  }

  return (
    <div className="min-h-screen bg-[#020108] text-white font-sans">
      {/* ── Header ── */}
      <header className="border-b border-white/10 sticky top-0 z-20 bg-[#020108]/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              AI Environmental Impact
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              See the real cost of your AI usage
            </p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowInfo(v => !v)}
              className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:border-white/40 transition-colors text-sm font-medium"
              aria-label="Data sources info"
            >
              i
            </button>
            {showInfo && (
              <div className="absolute right-0 top-10 w-72 bg-[#0d0b14] border border-white/10 rounded-xl p-4 shadow-2xl text-sm text-white/70 z-30">
                <p className="font-medium text-white mb-2">Research basis</p>
                <ul className="space-y-1 text-xs leading-relaxed">
                  <li>• Li et al. (2023) — "Making AI Less Thirsty"</li>
                  <li>• IEA data center energy reports 2023–2024</li>
                  <li>• 0.3 kg CO₂ per kWh (global avg grid intensity)</li>
                  <li>• Values are estimates; real usage may vary</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-12">

        {/* ── Step 1: Model Grid ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <h2 className="text-base font-semibold text-white">Choose a model</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MODELS.map(m => {
              const selected = m.id === selectedId
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                  className={[
                    'relative flex flex-col items-start gap-2 rounded-xl p-3.5 text-left transition-all duration-150',
                    'bg-[#0d0b14] border',
                    selected
                      ? 'border-violet-500 ring-2 ring-violet-500/40 scale-[1.03]'
                      : 'border-white/8 hover:border-white/20',
                  ].join(' ')}
                >
                  <span className="text-2xl leading-none">{m.emoji}</span>
                  <span className="text-sm font-medium text-white leading-snug">{m.name}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${COMPANY_BADGE[m.company]}`}>
                      {m.company}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[m.tier]}`} />
                    <span className="text-[10px] text-white/45">{m.tier}</span>
                  </div>
                  {selected && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Step 2: Usage Inputs ── */}
        {selectedModel && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <h2 className="text-base font-semibold text-white">Your usage</h2>
            </div>

            <div className="bg-[#0d0b14] border border-white/8 rounded-xl p-5 space-y-6">
              {isImage ? (
                /* Image model inputs */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white/70">Number of images generated</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={imageCount}
                      onChange={e => handleImgInput(e.target.value)}
                      className="w-24 bg-[#020108] border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={imageCount}
                    onChange={e => setImageCount(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <p className="text-xs text-white/40">
                    {imageCount} image{imageCount !== 1 ? 's' : ''} · ~{(imageCount * 0.8).toFixed(1)} L water estimated
                  </p>
                </div>
              ) : (
                /* Text model inputs */
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-white/70">Messages / requests</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={messageCount}
                        onChange={e => handleMsgInput(e.target.value)}
                        className="w-28 bg-[#020108] border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10000}
                      value={messageCount}
                      onChange={e => setMessageCount(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                    <p className="text-xs text-white/40">
                      {messageCount.toLocaleString()} messages ·{' '}
                      ~{((messageCount * (longContext ? 1500 : 300)) / 1000).toFixed(1)}k tokens estimated
                    </p>
                  </div>

                  {/* Long context toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/8">
                    <div>
                      <p className="text-sm text-white/70">Long context mode</p>
                      <p className="text-xs text-white/35 mt-0.5">~1,500 tokens/msg vs ~300 tokens/msg</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={longContext}
                      onClick={() => setLongContext(v => !v)}
                      className={[
                        'relative w-11 h-6 rounded-full transition-colors duration-200',
                        longContext ? 'bg-violet-600' : 'bg-white/15',
                      ].join(' ')}
                    >
                      <span className={[
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                        longContext ? 'translate-x-5' : 'translate-x-0',
                      ].join(' ')} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Step 3: Results ── */}
        {selectedModel && results && impact && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <h2 className="text-base font-semibold text-white">Impact estimate</h2>
            </div>

            <div className="space-y-4">
              {/* Main stat cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Water card */}
                <div className="bg-[#0d0b14] border border-blue-500/20 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">💧</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Water</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-white">{fmtWater(results.waterL)}</p>
                  <p className="text-xs text-white/40 mt-1">consumed</p>
                </div>

                {/* Carbon card */}
                <div className="bg-[#0d0b14] border border-emerald-500/20 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">🌿</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Carbon</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-white">{fmtCarbon(results.carbonKg)}</p>
                  <p className="text-xs text-white/40 mt-1">emitted</p>
                </div>
              </div>

              {/* Impact level bar */}
              <div className="bg-[#0d0b14] border border-white/8 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white/70">Impact level</span>
                  <span className="text-sm font-semibold" style={{ color: impact.color }}>{impact.label}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${impact.pct}%`, backgroundColor: impact.color }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/25 mt-1.5">
                  <span>Minimal</span>
                  <span>Low</span>
                  <span>Moderate</span>
                  <span>High</span>
                </div>
              </div>

              {/* Comparison chips */}
              <div className="bg-[#0d0b14] border border-white/8 rounded-xl p-5">
                <p className="text-sm font-medium text-white/70 mb-4">That's equivalent to…</p>
                <div className="grid grid-cols-2 gap-3">
                  <CompChip
                    emoji="🍶"
                    label="water bottles"
                    value={fmt2(results.waterL / 0.5)}
                    sub="(500 mL each)"
                  />
                  <CompChip
                    emoji="🚿"
                    label="shower seconds"
                    value={fmt2(results.waterL / 0.13)}
                    sub="(0.13 L/sec)"
                  />
                  <CompChip
                    emoji="📱"
                    label="phone charges"
                    value={fmt2(results.kWh / 0.012)}
                    sub="(12 Wh battery)"
                  />
                  <CompChip
                    emoji="🚗"
                    label="km driven"
                    value={fmt2(results.carbonKg / 0.21)}
                    sub="(0.21 kg CO₂/km)"
                  />
                </div>
              </div>

              {/* Energy row */}
              <div className="bg-[#0d0b14] border border-white/8 rounded-xl px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-sm text-white/60">Energy consumed</span>
                </div>
                <span className="text-sm font-semibold text-white">{fmtKwh(results.kWh)}</span>
              </div>

              {/* Collapsible data sources */}
              <div className="bg-[#0d0b14] border border-white/8 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowSources(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm text-white/60 hover:text-white/80 transition-colors"
                >
                  <span className="font-medium">Data sources & methodology</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSources && (
                  <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-3 text-xs text-white/50 leading-relaxed">
                    <div>
                      <p className="text-white/70 font-medium mb-1">Water usage</p>
                      <p>Based on Li et al. (2023) "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models." Estimates range from 0.1L to 0.8L per 1,000 tokens depending on model size and inference hardware cooling.</p>
                    </div>
                    <div>
                      <p className="text-white/70 font-medium mb-1">Carbon footprint</p>
                      <p>Energy per token derived from IEA data center efficiency reports. Carbon intensity uses 0.3 kg CO₂/kWh global grid average (IEA 2023). Actual values vary by region and energy mix.</p>
                    </div>
                    <div>
                      <p className="text-white/70 font-medium mb-1">Image generation</p>
                      <p>0.8L water and 0.02 kWh per image based on estimates for diffusion model inference on GPU clusters with liquid cooling.</p>
                    </div>
                    <div className="pt-1 border-t border-white/8 text-white/30">
                      All values are estimates for educational purposes. Real-world usage varies significantly by deployment, hardware, and location.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Prompt when no model selected */}
        {!selectedModel && (
          <div className="text-center py-16 text-white/25">
            <p className="text-4xl mb-3">☝️</p>
            <p className="text-sm">Select a model above to see its environmental impact</p>
          </div>
        )}
      </main>
    </div>
  )
}

function CompChip({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-3 flex items-start gap-2">
      <span className="text-lg leading-none shrink-0">{emoji}</span>
      <div>
        <p className="text-sm font-semibold text-white">{value}</p>
        <p className="text-[10px] text-white/50">{label}</p>
        <p className="text-[9px] text-white/25">{sub}</p>
      </div>
    </div>
  )
}

function fmt2(n: number): string {
  if (n < 0.01)  return '<0.01'
  if (n < 10)    return n.toFixed(2)
  if (n < 1000)  return n.toFixed(1)
  if (n < 1e6)   return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1e6).toFixed(1)}M`
}
