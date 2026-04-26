import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [input, setInput] = useState('')
  const [blocks, setBlocks] = useState({ weekday: [], saturday: [], sunday: [] })
  const [shuttles, setShuttles] = useState([])
  const [paddle, setPaddle] = useState(null)
  const [liveBuses, setLiveBuses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)

  // load block list + shuttles on mount
  useEffect(() => {
    fetch('/api/account-options')
      .then(r => r.json())
      .then(d => {
        if (d.blocks) setBlocks(d.blocks)
        if (d.shuttles) setShuttles(d.shuttles)
      })
  }, [])

  // Supabase Realtime subscription to live_bus_paddles
  useEffect(() => {
    const channel = supabase
      .channel('live-bus-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_bus_paddles' },
        payload => {
          setLiveBuses(prev => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new]
            if (payload.eventType === 'DELETE')
              return prev.filter(b => b.block !== payload.old.block)
            if (payload.eventType === 'UPDATE')
              return prev.map(b => (b.block === payload.new.block ? payload.new : b))
            return prev
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // autocomplete suggestions
  const allBlocks = [
    ...blocks.weekday.map(b => ({ label: `${b} (Weekday)`, value: b })),
    ...blocks.saturday.map(b => ({ label: `${b} (Saturday)`, value: b })),
    ...blocks.sunday.map(b => ({ label: `${b} (Sunday)`, value: b })),
  ]

  function handleInputChange(e) {
    const val = e.target.value
    setInput(val)
    if (val.length < 2) { setSuggestions([]); return }
    const lower = val.toLowerCase()
    const matches = allBlocks
      .filter(b => b.value.toLowerCase().includes(lower))
      .slice(0, 8)
    setSuggestions(matches)
  }

  async function lookup(query) {
    const q = (query || input).trim()
    if (!q) return
    setSuggestions([])
    setInput(q)
    setLoading(true)
    setError(null)
    setPaddle(null)
    setLiveBuses([])
    setActiveSection(null)

    try {
      if (q.toLowerCase() === 'shuttle') {
        setActiveSection('shuttle')
        setLoading(false)
        return
      }

      // fetch paddle + live buses in parallel
      const [paddleRes, liveRes] = await Promise.all([
        fetch(`/api/paddle?block=${encodeURIComponent(q)}`),
        fetch(`/api/live-buses?block=${encodeURIComponent(q)}`),
      ])
      const paddleData = await paddleRes.json()
      const liveData = await liveRes.json()

      if (paddleData.ok) {
        setPaddle(paddleData)
        setActiveSection('paddle')
      } else {
        setError(paddleData.error || 'Block not found')
      }

      if (liveData.ok) setLiveBuses(liveData.buses || [])
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') lookup()
  }

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">OC Bus Tracker</h1>
        <p className="text-slate-400 text-sm">Blocks, paddles, shuttles, and live bus lookup</p>
        <p className="text-slate-500 text-xs mt-1">{today}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder='Block like 44-07, bus like 6525, or "shuttle"'
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => lookup()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg text-sm font-medium"
          >
            {loading ? '...' : 'Go'}
          </button>
        </div>

        {/* Autocomplete */}
        {suggestions.length > 0 && (
          <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl">
            {suggestions.map(s => (
              <li
                key={s.label}
                onClick={() => lookup(s.value)}
                className="px-4 py-2 text-sm hover:bg-slate-700 cursor-pointer text-slate-200"
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Paddle Section */}
      {paddle && (
        <Section
          title="Paddle"
          badge={paddle.block}
          open={activeSection === 'paddle'}
          onToggle={() => setActiveSection(activeSection === 'paddle' ? null : 'paddle')}
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <Info label="Paddle ID" value={paddle.paddleId} />
              <Info label="Service Day" value={capitalize(paddle.serviceDay)} />
              <Info label="Garage" value={paddle.garage} />
              <Info label="Sign On" value={paddle.signOn} />
              <Info label="Bus Type" value={paddle.busType} />
              <Info label="Routes" value={(paddle.routes || []).join(', ')} />
            </div>
            {paddle.variantLabel && (
              <p className="text-xs text-blue-400">{paddle.variantLabel} — effective {paddle.effective}</p>
            )}
            <div className="border-t border-slate-700 pt-3 space-y-3">
              {(paddle.trips || []).map(trip => (
                <TripCard key={trip.trip_number} trip={trip} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Live Bus Location Section */}
      {paddle && (
        <Section
          title="Bus Location"
          badge={liveBuses.length > 0 ? `${liveBuses.length} live` : 'Live'}
          open={activeSection === 'location'}
          onToggle={() => setActiveSection(activeSection === 'location' ? null : 'location')}
        >
          {liveBuses.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No live bus data for this block right now.
            </p>
          ) : (
            <div className="space-y-2">
              {liveBuses.map((b, i) => (
                <div key={i} className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white font-medium">Bus #{b.bus_number}</span>
                    <span className="text-blue-400">{b.route}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">{b.headsign}</p>
                  <p className="text-slate-500 text-xs">{b.start_time} → {b.end_time}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Shuttle Section */}
      {(activeSection === 'shuttle' || shuttles.length > 0) && (
        <Section
          title="Shuttles"
          badge={`${shuttles.length}`}
          open={activeSection === 'shuttle'}
          onToggle={() => setActiveSection(activeSection === 'shuttle' ? null : 'shuttle')}
        >
          <div className="space-y-2">
            {shuttles.map(s => (
              <div key={s.id} className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                <span className="text-blue-400 font-medium">{s.route}</span>
                <span className="text-white ml-2">{s.name}</span>
                <p className="text-slate-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Quick tip */}
      {!paddle && !loading && (
        <div className="text-slate-500 text-xs mt-4 space-y-1">
          <p>Use format <span className="text-slate-300">route-block</span>, e.g. <span className="text-slate-300">44-07</span></p>
          <p>Type a bus number like <span className="text-slate-300">6525</span> for live location</p>
          <p>Type <span className="text-slate-300">shuttle</span> to see today's shuttles</p>
        </div>
      )}

      {/* Safety notice */}
      <p className="mt-auto pt-8 text-slate-600 text-xs">
        Do not use your phone while operating the bus, and always follow the deadheads shown on the paddle.
      </p>
    </div>
  )
}

function Section({ title, badge, open, onToggle, children }) {
  return (
    <div className="mb-3 border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 text-left"
      >
        <span className="font-medium text-white">{title}</span>
        <div className="flex items-center gap-2">
          {badge && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{badge}</span>}
          <span className="text-slate-400 text-lg leading-none">{open ? '−' : '+'}</span>
        </div>
      </button>
      {open && <div className="px-4 py-3 bg-slate-900">{children}</div>}
    </div>
  )
}

function TripCard({ trip }) {
  const [showDirs, setShowDirs] = useState(false)
  const hasDirs = trip.start_directions || trip.next_directions

  return (
    <div className="bg-slate-800 rounded-lg px-4 py-3">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-blue-400 font-semibold text-sm">Route {trip.route}</span>
          <span className="text-slate-400 text-xs ml-2">Trip {trip.trip_number}</span>
          <p className="text-white text-sm mt-0.5">{trip.headsign}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>{trip.start_time}</p>
          <p>{trip.end_time}</p>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex justify-between">
        <span>{trip.start_stop}</span>
        <span className="mx-1">→</span>
        <span>{trip.end_stop}</span>
      </div>
      {trip.relief_stop && (
        <p className="text-xs text-amber-400 mt-1">Relief at {trip.relief_stop} {trip.relief_time}</p>
      )}
      {trip.notes && <p className="text-xs text-yellow-400 mt-1">{trip.notes}</p>}
      {hasDirs && (
        <button
          onClick={() => setShowDirs(v => !v)}
          className="mt-2 text-xs text-blue-500 hover:text-blue-400"
        >
          {showDirs ? 'Hide' : 'Show'} deadhead directions
        </button>
      )}
      {showDirs && (
        <div className="mt-2 text-xs text-slate-400 bg-slate-900 rounded p-2 leading-relaxed">
          {trip.start_directions && <p>{trip.start_directions}</p>}
          {trip.next_directions && <p className="mt-1">{trip.next_directions}</p>}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200">{value || '—'}</span>
    </div>
  )
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
