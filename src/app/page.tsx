'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


type Difficulty = 'easy' | 'medium' | 'hard'
type Screen = 'home' | 'playing' | 'results' | 'leaderboard'

interface City {
  name: string
  country: string
}

interface Question {
  city: City
  options: City[]
  prompt: string
}

interface ScoreEntry {
  player_name: string
  score: number
  difficulty: Difficulty
  created_at: string
}

const CITIES: Record<string, City[]> = {
  easy: [
    { name: 'Paris', country: 'France' },
    { name: 'New York', country: 'USA' },
    { name: 'Tokyo', country: 'Japan' },
    { name: 'London', country: 'United Kingdom' },
    { name: 'Rome', country: 'Italy' },
    { name: 'Sydney', country: 'Australia' },
    { name: 'Dubai', country: 'UAE' },
    { name: 'Barcelona', country: 'Spain' },
    { name: 'Amsterdam', country: 'Netherlands' },
    { name: 'Istanbul', country: 'Turkey' },
    { name: 'Rio de Janeiro', country: 'Brazil' },
    { name: 'Cairo', country: 'Egypt' },
    { name: 'Bangkok', country: 'Thailand' },
    { name: 'Singapore', country: 'Singapore' },
  ],
  medium: [
    { name: 'Prague', country: 'Czech Republic' },
    { name: 'Lisbon', country: 'Portugal' },
    { name: 'Buenos Aires', country: 'Argentina' },
    { name: 'Cape Town', country: 'South Africa' },
    { name: 'Seoul', country: 'South Korea' },
    { name: 'Vienna', country: 'Austria' },
    { name: 'Santorini', country: 'Greece' },
    { name: 'Marrakech', country: 'Morocco' },
    { name: 'Budapest', country: 'Hungary' },
    { name: 'Kyoto', country: 'Japan' },
    { name: 'Mexico City', country: 'Mexico' },
    { name: 'Havana', country: 'Cuba' },
    { name: 'Lagos', country: 'Nigeria' },
    { name: 'Hanoi', country: 'Vietnam' },
  ],
  hard: [
    { name: 'Tbilisi', country: 'Georgia' },
    { name: 'Medellín', country: 'Colombia' },
    { name: 'Riga', country: 'Latvia' },
    { name: 'Chengdu', country: 'China' },
    { name: 'Valletta', country: 'Malta' },
    { name: 'Reykjavik', country: 'Iceland' },
    { name: 'Tallinn', country: 'Estonia' },
    { name: 'Cartagena', country: 'Colombia' },
    { name: 'Sarajevo', country: 'Bosnia' },
    { name: 'Zanzibar', country: 'Tanzania' },
    { name: 'Ulaanbaatar', country: 'Mongolia' },
    { name: 'Baku', country: 'Azerbaijan' },
    { name: 'Kotor', country: 'Montenegro' },
    { name: 'Bishkek', country: 'Kyrgyzstan' },
  ],
}

function getCityPool(difficulty: Difficulty): City[] {
  if (difficulty === 'easy') return CITIES.easy
  if (difficulty === 'medium') return [...CITIES.easy, ...CITIES.medium]
  return [...CITIES.easy, ...CITIES.medium, ...CITIES.hard]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makePrompt(city: City, difficulty: Difficulty): string {
  if (difficulty === 'easy')
    return `famous landmarks and skyline of ${city.name} ${city.country}, aerial view, iconic, cinematic photography, high quality`
  if (difficulty === 'medium')
    return `city architecture and streets of ${city.name} ${city.country}, urban photography, beautiful cityscape, high quality`
  return `street level local neighborhood in ${city.name} ${city.country}, candid urban photography, no obvious famous landmarks`
}

function buildQuestions(difficulty: Difficulty): Question[] {
  const pool = getCityPool(difficulty)
  const selected = shuffle(pool).slice(0, 10)
  return selected.map(city => {
    const others = pool.filter(c => c.name !== city.name)
    const wrong = shuffle(others).slice(0, 4)
    return {
      city,
      options: shuffle([city, ...wrong]),
      prompt: makePrompt(city, difficulty),
    }
  })
}

async function fetchImage(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`/api/image?prompt=${encodeURIComponent(prompt)}`)

    if (res.ok) {
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }

    if (res.status === 503) {
      await new Promise(r => setTimeout(r, 8000))
      continue
    }

    throw new Error(`API error ${res.status}`)
  }

  throw new Error('Failed after retries')
}

function getScoreLabel(score: number) {
  if (score === 100) return { emoji: '🏆', msg: "Perfect score! You're a geography legend." }
  if (score >= 80) return { emoji: '🌍', msg: 'Geography master! Seriously impressive.' }
  if (score >= 60) return { emoji: '✈️', msg: 'World traveler! Well done.' }
  if (score >= 40) return { emoji: '🗺️', msg: 'Getting around. Keep exploring!' }
  return { emoji: '🏠', msg: 'Time to travel more...' }
}

export default function CitySnap() {
  const [screen, setScreen] = useState<Screen>('home')
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const [loadingSecs, setLoadingSecs] = useState(0)
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [lbFilter, setLbFilter] = useState<Difficulty | 'all'>('all')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Fetch image whenever question changes
  useEffect(() => {
    if (screen !== 'playing' || questions.length === 0) return
    setImgSrc(null)
    setImgError(null)
    setLoadingSecs(0)

    fetchImage(questions[qIndex].prompt)
      .then(src => setImgSrc(src))
      .catch(e => setImgError(String(e)))
  }, [screen, qIndex, questions])

  // Loading timer
  useEffect(() => {
    if (screen !== 'playing' || imgSrc || imgError !== null) return
    const interval = setInterval(() => setLoadingSecs(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [screen, qIndex, imgSrc, imgError])

  function startGame() {
    if (!name.trim()) return
    const qs = buildQuestions(difficulty)
    setQuestions(qs)
    setQIndex(0)
    setScore(0)
    setSelected(null)
    setImgSrc(null)
    setImgError(null)
    setLoadingSecs(0)
    setSaved(false)
    setScreen('playing')
  }

  function handleAnswer(cityName: string) {
    if (selected !== null) return
    setSelected(cityName)
    if (cityName === questions[qIndex].city.name) {
      setScore(s => s + 10)
    }
    setTimeout(() => {
      if (qIndex + 1 < questions.length) {
        setQIndex(i => i + 1)
        setSelected(null)
      } else {
        setScreen('results')
      }
    }, 1500)
  }

  async function saveScore() {
    setSaving(true)
    await supabase.from('leaderboard').insert({ player_name: name, score, difficulty })
    setSaving(false)
    setSaved(true)
  }

  async function loadLeaderboard(filter: Difficulty | 'all') {
    let q = supabase
      .from('leaderboard')
      .select('player_name, score, difficulty, created_at')
      .order('score', { ascending: false })
      .limit(20)
    if (filter !== 'all') q = q.eq('difficulty', filter)
    const { data } = await q
    setScores(data || [])
  }

  async function goLeaderboard() {
    await loadLeaderboard(lbFilter)
    setScreen('leaderboard')
  }

  useEffect(() => {
    if (screen === 'leaderboard') loadLeaderboard(lbFilter)
  }, [lbFilter, screen])

  // HOME
  if (screen === 'home') return (
    <div className="min-h-screen bg-[#070710] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🌆</div>
          <h1 className="text-5xl font-bold tracking-tight">CitySnap</h1>
          <p className="text-gray-500 mt-2 text-sm">Guess the city from AI-generated images</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-600 uppercase tracking-wider mb-1.5 block">Your name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startGame()}
              placeholder="Enter your name..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 placeholder-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition text-white"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase tracking-wider mb-1.5 block">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                const active = difficulty === d
                const color = d === 'easy'
                  ? active ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-gray-600 hover:border-white/20'
                  : d === 'medium'
                  ? active ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-white/10 text-gray-600 hover:border-white/20'
                  : active ? 'border-red-500 text-red-400 bg-red-500/10' : 'border-white/10 text-gray-600 hover:border-white/20'
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`border rounded-xl py-2.5 text-sm font-medium capitalize transition-all ${color}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-700 mt-2 text-center min-h-[1rem]">
              {difficulty === 'easy' && 'Famous world cities — Paris, Tokyo, NYC...'}
              {difficulty === 'medium' && 'Mix of famous and lesser-known cities'}
              {difficulty === 'hard' && 'Obscure cities, unusual angles — tricky!'}
            </p>
          </div>

          <button
            onClick={startGame}
            disabled={!name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed font-semibold py-4 rounded-xl transition text-lg mt-2"
          >
            Start Game →
          </button>

          <button
            onClick={goLeaderboard}
            className="w-full text-gray-600 hover:text-gray-400 text-sm py-1 transition"
          >
            🏆 View Leaderboard
          </button>
        </div>
      </div>
    </div>
  )

  // PLAYING
  if (screen === 'playing') {
    const q = questions[qIndex]
    return (
      <div className="min-h-screen bg-[#070710] text-white flex flex-col">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5">
          <span className="text-sm text-gray-600 shrink-0">
            <span className="text-white font-bold">{qIndex + 1}</span>/10
          </span>
          <div className="flex-1 bg-white/10 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-700"
              style={{ width: `${(qIndex / 10) * 100}%` }}
            />
          </div>
          <span className="text-sm shrink-0">
            <span className="text-blue-400 font-bold">{score}</span>
            <span className="text-gray-600"> pts</span>
          </span>
        </div>

        <div className="flex-1 flex flex-col max-w-xl mx-auto w-full p-4 gap-4">
          <div className="rounded-2xl overflow-hidden bg-white/5 aspect-video relative border border-white/5">
            {!imgSrc && imgError === null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <div className="text-5xl animate-pulse">🌆</div>
                <p className="text-gray-400 text-sm font-medium">AI is generating the image...</p>
                <p className="text-gray-700 text-xs">{loadingSecs}s — first image can take up to 30s</p>
              </div>
            )}
            {imgError !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 p-4">
                <div className="text-4xl">⚠️</div>
                <p className="text-gray-500 text-sm text-center break-all">{imgError}</p>
                <button
                  onClick={() => {
                    setImgError(null)
                    setImgSrc(null)
                    setLoadingSecs(0)
                    fetchImage(questions[qIndex].prompt)
                      .then(src => setImgSrc(src))
                      .catch(e => setImgError(String(e)))
                  }}
                  className="text-blue-400 text-xs underline"
                >
                  Retry
                </button>
              </div>
            )}
            {imgSrc && (
              <img
                src={imgSrc}
                alt="Which city is this?"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <p className="text-center text-gray-600 text-xs uppercase tracking-widest">
            Which city is this?
          </p>

          <div className="grid grid-cols-1 gap-2">
            {q.options.map(opt => {
              let cls = 'border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 cursor-pointer'
              if (selected) {
                if (opt.name === q.city.name) {
                  cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-300 cursor-default'
                } else if (opt.name === selected) {
                  cls = 'border-red-500 bg-red-500/15 text-red-400 cursor-default'
                } else {
                  cls = 'border-white/5 bg-transparent text-gray-700 cursor-default'
                }
              }
              return (
                <button
                  key={opt.name}
                  onClick={() => handleAnswer(opt.name)}
                  disabled={!!selected}
                  className={`border rounded-xl px-4 py-3 text-left transition-all duration-200 ${cls}`}
                >
                  <span className="font-semibold">{opt.name}</span>
                  <span className="text-xs ml-2 opacity-50">{opt.country}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // RESULTS
  if (screen === 'results') {
    const { emoji, msg } = getScoreLabel(score)
    return (
      <div className="min-h-screen bg-[#070710] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-8xl mb-5">{emoji}</div>
          <div className="text-6xl font-bold mb-1">
            {score}
            <span className="text-3xl text-gray-600 font-normal">/100</span>
          </div>
          <p className="text-gray-400 mb-8">{msg}</p>

          <div className="space-y-3">
            {!saved ? (
              <button
                onClick={saveScore}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold py-4 rounded-xl transition"
              >
                {saving ? 'Saving...' : '🏆 Save to Leaderboard'}
              </button>
            ) : (
              <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium py-4 rounded-xl">
                ✓ Score saved!
              </div>
            )}
            <button
              onClick={goLeaderboard}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 font-medium py-3 rounded-xl transition"
            >
              View Leaderboard
            </button>
            <button
              onClick={() => setScreen('home')}
              className="w-full text-gray-600 hover:text-gray-400 py-2 text-sm transition"
            >
              Play again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // LEADERBOARD
  return (
    <div className="min-h-screen bg-[#070710] text-white flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🏆 Leaderboard</h2>
          <button onClick={() => setScreen('home')} className="text-gray-600 hover:text-white transition text-sm">
            ← Home
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['all', 'easy', 'medium', 'hard'] as const).map(f => (
            <button
              key={f}
              onClick={() => setLbFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${
                lbFilter === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {scores.length === 0 ? (
            <p className="text-center text-gray-700 py-12">No scores yet. Be the first!</p>
          ) : (
            scores.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  i === 0 ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-white/5'
                }`}
              >
                <span className={`font-bold text-sm w-6 text-center ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-700'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.player_name}</div>
                  <div className="text-xs text-gray-700 capitalize">{s.difficulty}</div>
                </div>
                <div className="font-bold text-blue-400 text-lg">{s.score}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
