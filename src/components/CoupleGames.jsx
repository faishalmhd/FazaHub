import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gamepad2, Hand, RotateCcw, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

const GAME_OPTIONS = [
  { id: 'tic_tac_toe', name: 'Tic Tac Toe', tagline: '3 langkah menuju menang', icon: '✳️' },
  { id: 'rock_paper_scissors', name: 'Batu Gunting Kertas', tagline: 'Best of one, siapa jago?', icon: '✊' },
  { id: 'couple_quiz', name: 'Seberapa Kenal?', tagline: 'Jawab kompak, cek chemistry', icon: '💞' }
]

const QUIZ_QUESTIONS = [
  { prompt: 'Kalau punya satu hari kosong, kalian paling ingin...', options: ['Pergi jalan-jalan', 'Santai di rumah'] },
  { prompt: 'Quality time favorit kalian lebih terasa saat...', options: ['Ngobrol panjang', 'Melakukan hal bareng'] },
  { prompt: 'Pilih rencana date spontan:', options: ['Cari makanan enak', 'Cari tempat baru'] },
  { prompt: 'Kalau bisa mengulang satu momen, kalian pilih...', options: ['Pertemuan pertama', 'Date paling berkesan'] },
  { prompt: 'Love language yang paling terasa buat kalian...', options: ['Kata-kata manis', 'Waktu berkualitas'] }
]

const initialState = {
  tic_tac_toe: { board: Array(9).fill(null), turn: null, winner: null, draw: false },
  rock_paper_scissors: { round: 1, choices: {}, result: null },
  couple_quiz: { questionIndex: 0, answers: {}, scores: {}, revealed: false }
}

const gameColumns = 'couple_id,game_type,status,game_state,updated_by,updated_at'
const winningLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

function logDatabaseError(context, error) {
  console.error(`[Main Berdua] ${context}: ${error?.message || 'Unknown Supabase error'}`, error)
  if (error?.code === '42P01' || error?.code === '42703' || error?.code === 'PGRST204' || error?.code === 'PGRST205') {
    return 'Skema Main Berdua belum lengkap. Periksa tabel dan kolom couple_games di Supabase.'
  }
  return error?.message || 'Permainan belum dapat disinkronkan. Coba lagi.'
}

function makeGameState(type) {
  return JSON.parse(JSON.stringify(initialState[type]))
}

function normalizeGameState(type, state) {
  const defaults = makeGameState(type)
  if (!state || typeof state !== 'object') return defaults
  return {
    ...defaults,
    ...state,
    ...(defaults.board ? { board: Array.isArray(state.board) ? state.board : defaults.board } : {}),
    ...(defaults.choices ? { choices: { ...defaults.choices, ...state.choices } } : {}),
    ...(defaults.answers ? { answers: { ...defaults.answers, ...state.answers } } : {}),
    ...(defaults.scores ? { scores: { ...defaults.scores, ...state.scores } } : {})
  }
}

function applyGameAction(game, action, userId, partnerId, partner1Id) {
  const gameType = action.type === 'select' ? action.game_type : game?.game_type
  if (!initialState[gameType]) throw new Error('Jenis permainan tidak dikenal.')

  const currentState = game?.game_type === gameType
    ? normalizeGameState(gameType, game.game_state)
    : makeGameState(gameType)

  if (action.type === 'select') {
    return {
      game_type: gameType,
      game_state: game?.game_type === gameType ? currentState : makeGameState(gameType)
    }
  }

  if (action.type === 'reset') {
    return { game_type: gameType, game_state: makeGameState(gameType) }
  }

  if (gameType === 'tic_tac_toe' && action.type === 'move') {
    const index = Number(action.index)
    const board = [...(currentState.board || initialState.tic_tac_toe.board)]
    if (!Number.isInteger(index) || index < 0 || index > 8 || board[index] || currentState.winner || currentState.draw ||
      (currentState.turn && currentState.turn !== userId)) {
      throw new Error('Langkah tidak tersedia atau bukan giliranmu.')
    }

    const mark = userId === partner1Id ? 'X' : 'O'
    board[index] = mark
    const won = winningLines.some(([a, b, c]) => board[a] && board[a] === board[b] && board[b] === board[c])
    const draw = !won && board.every(Boolean)
    return {
      game_type: gameType,
      game_state: {
        board,
        turn: won || draw ? null : partnerId,
        winner: won ? userId : null,
        winnerMark: won ? mark : null,
        draw
      }
    }
  }

  if (gameType === 'rock_paper_scissors' && action.type === 'choose') {
    if (!['rock', 'paper', 'scissors'].includes(action.choice)) throw new Error('Pilihan tidak valid.')
    const round = currentState.result
      ? { round: (currentState.round || 1) + 1, choices: {}, result: null }
      : currentState
    if (round.choices[userId]) throw new Error('Pilihanmu untuk ronde ini sudah tersimpan.')

    const choices = { ...round.choices, [userId]: action.choice }
    const firstChoice = choices[partnerId]
    const yourChoice = choices[userId]
    let result = null
    if (firstChoice && yourChoice) {
      if (firstChoice === yourChoice) result = 'draw'
      else if (
        (firstChoice === 'rock' && yourChoice === 'scissors') ||
        (firstChoice === 'paper' && yourChoice === 'rock') ||
        (firstChoice === 'scissors' && yourChoice === 'paper')
      ) result = partnerId
      else result = userId
    }
    return { game_type: gameType, game_state: { ...round, choices, result } }
  }

  if (gameType === 'couple_quiz' && action.type === 'answer') {
    if (typeof action.answer !== 'string' || action.answer.length > 80 ||
      currentState.revealed || currentState.answers[userId]) {
      throw new Error('Jawaban tidak dapat dikirim.')
    }
    const answers = { ...currentState.answers, [userId]: action.answer }
    return {
      game_type: gameType,
      game_state: {
        ...currentState,
        answers,
        revealed: Boolean(answers[userId] && answers[partnerId])
      }
    }
  }

  if (gameType === 'couple_quiz' && action.type === 'next_question') {
    if (!currentState.revealed) throw new Error('Tunggu sampai kalian berdua menjawab.')
    const scores = { ...currentState.scores }
    if (currentState.answers[userId] === currentState.answers[partnerId]) {
      scores[userId] = (scores[userId] || 0) + 1
      scores[partnerId] = (scores[partnerId] || 0) + 1
    }
    return {
      game_type: gameType,
      game_state: {
        questionIndex: ((currentState.questionIndex || 0) + 1) % QUIZ_QUESTIONS.length,
        answers: {},
        scores,
        revealed: false
      }
    }
  }

  throw new Error('Aksi permainan tidak dikenal.')
}

export default function CoupleGames({ couple, user }) {
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [syncReady, setSyncReady] = useState(false)
  const partnerId = user.id === couple.partner_1_id ? couple.partner_2_id : couple.partner_1_id
  const playerMark = user.id === couple.partner_1_id ? 'X' : 'O'
  const selectedGame = GAME_OPTIONS.find(item => item.id === game?.game_type)

  const loadGame = useCallback(async () => {
    try {
      const { data, error: loadError } = await supabase.from('couple_games')
        .select(gameColumns)
        .eq('couple_id', couple.id)
        .maybeSingle()
      if (loadError) {
        setError(logDatabaseError('Gagal memuat state permainan', loadError))
      } else {
        setGame(data)
        setError('')
      }
    } catch (loadError) {
      setError(logDatabaseError('Gagal memuat state permainan', loadError))
    } finally {
      setLoading(false)
    }
  }, [couple.id])

  useEffect(() => {
    let active = true
    loadGame()
    const channel = supabase.channel(`couple-games-${couple.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'couple_games',
        filter: `couple_id=eq.${couple.id}`
      }, payload => {
        if (active && payload.new) {
          setGame(payload.new)
          setError('')
        }
      })
      .subscribe(status => {
        if (!active) return
        setSyncReady(status === 'SUBSCRIBED')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('Koneksi realtime permainan terputus. Coba muat ulang aplikasi.')
        }
      })
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [couple.id, loadGame])

  async function sendAction(action) {
    if (busy) return
    setBusy(true)
    setError('')
    let databaseErrorContext = ''
    try {
      databaseErrorContext = 'Gagal memuat state permainan'
      const { data: latestGame, error: loadError } = await supabase.from('couple_games')
        .select(gameColumns)
        .eq('couple_id', couple.id)
        .maybeSingle()
      if (loadError) throw loadError
      databaseErrorContext = ''

      const nextState = applyGameAction(latestGame, action, user.id, partnerId, couple.partner_1_id)
      databaseErrorContext = 'Gagal menyimpan state permainan'
      const { data, error: saveError } = await supabase.from('couple_games')
        .upsert({
          couple_id: couple.id,
          game_type: nextState.game_type,
          status: 'active',
          game_state: nextState.game_state,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: 'couple_id' })
        .select(gameColumns)
        .single()
      if (saveError) throw saveError
      databaseErrorContext = ''
      setGame(data)
    } catch (actionError) {
      if (databaseErrorContext || actionError?.code || actionError?.details || actionError?.hint) {
        setError(logDatabaseError(databaseErrorContext || 'Gagal menyimpan state permainan', actionError))
      } else {
        setError(actionError?.message || 'Permainan belum dapat disinkronkan. Coba lagi.')
      }
    } finally {
      setBusy(false)
    }
  }

  const gameState = game?.game_state || (game?.game_type ? initialState[game.game_type] : null)
  const quizQuestion = useMemo(
    () => QUIZ_QUESTIONS[(gameState?.questionIndex || 0) % QUIZ_QUESTIONS.length],
    [gameState?.questionIndex]
  )

  if (loading) {
    return <div className="grid min-h-64 place-items-center text-sm text-taupe">Menyiapkan ruang main...</div>
  }

  return (
    <section className="animate-rise-in pb-6">
      <header className="mb-5">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-taupe">FazaHub / Play mode</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Main berdua</h1>
            <p className="mt-1 text-xs text-taupe">Mini game kecil, seru-seruan bareng.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-bold text-taupe">
            <span className={`h-1.5 w-1.5 rounded-full ${syncReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {syncReady ? 'REALTIME ON' : 'MENYAMBUNG'}
          </span>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {GAME_OPTIONS.map(option => {
          const active = game?.game_type === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => sendAction({ type: 'select', game_type: option.id })}
              disabled={busy || !partnerId}
              aria-pressed={active}
              className={`rounded-2xl border p-3 text-left transition active:scale-[.98] disabled:opacity-50 ${active ? 'border-rose-500/60 bg-rose-500/10' : 'border-line bg-white hover:border-rose-500/30'}`}
            >
              <span className="text-lg" aria-hidden="true">{option.icon}</span>
              <span className="mt-2 block text-[11px] font-extrabold leading-tight">{option.name}</span>
            </button>
          )
        })}
      </div>

      {!partnerId && (
        <div className="mb-4 rounded-2xl border border-line bg-white p-4 text-sm text-taupe">
          Ajak pasangan bergabung dulu untuk mulai main bareng.
        </div>
      )}

      {error && <p role="alert" className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-300">{error}</p>}

      <div className="rounded-[1.75rem] border border-line bg-white p-5 shadow-soft">
        {!selectedGame ? (
          <div className="py-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><Gamepad2 size={26} /></div>
            <h2 className="mt-4 text-lg font-extrabold">Pilih game kalian</h2>
            <p className="mt-1 text-xs text-taupe">Pilihan game tersimpan bersama dalam satu ruang realtime.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.15em] text-terracotta">MINI GAME</p>
                <h2 className="mt-1 text-xl font-extrabold">{selectedGame.name}</h2>
                <p className="mt-1 text-xs text-taupe">{selectedGame.tagline}</p>
              </div>
              <button type="button" onClick={() => sendAction({ type: 'reset' })} disabled={busy || !partnerId} aria-label="Mulai ulang game" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-cream text-taupe transition hover:text-terracotta disabled:opacity-40">
                <RotateCcw size={15} />
              </button>
            </div>

            {game.game_type === 'tic_tac_toe' && (
              <div>
                <p aria-live="polite" className="mb-3 text-center text-xs font-semibold text-taupe">
                  {gameState.winner ? `${gameState.winner === user.id ? 'Kamu' : 'Pasangan'} menang!` : gameState.draw ? 'Seri, rematch yuk!' : gameState.turn ? (gameState.turn === user.id ? 'Giliranmu' : 'Giliran pasangan') : 'Pilih kotak pertama'}
                  <span className="ml-1 rounded-full bg-cream px-2 py-1 font-mono">{playerMark}</span>
                </p>
                <div className="mx-auto grid max-w-[264px] grid-cols-3 gap-2">
                  {(gameState.board || initialState.tic_tac_toe.board).map((mark, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => sendAction({ type: 'move', index })}
                      disabled={busy || !partnerId || Boolean(mark) || Boolean(gameState.winner) || gameState.draw || (gameState.turn && gameState.turn !== user.id)}
                      aria-label={`Kotak ${index + 1}${mark ? ` ${mark}` : ''}`}
                      className="grid aspect-square place-items-center rounded-2xl border border-line bg-cream text-3xl font-extrabold text-terracotta transition hover:border-rose-500/40 disabled:cursor-default disabled:opacity-80"
                    >
                      {mark || ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {game.game_type === 'rock_paper_scissors' && (
              <div className="text-center">
                <p aria-live="polite" className="text-xs font-semibold text-taupe">
                  Ronde {gameState.round || 1} · {gameState.result ? (
                    gameState.result === 'draw' ? 'Seri!' : gameState.result === user.id ? 'Kamu menang!' : 'Pasangan menang!'
                  ) : gameState.choices?.[user.id] ? 'Menunggu pilihan pasangan...' : 'Pilih jagoanmu'}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[['rock', '✊', 'Batu'], ['paper', '✋', 'Kertas'], ['scissors', '✌️', 'Gunting']].map(([choice, emoji, label]) => (
                    <button key={choice} type="button" onClick={() => sendAction({ type: 'choose', choice })} disabled={busy || !partnerId || Boolean(gameState.choices?.[user.id])} className="rounded-2xl border border-line bg-cream px-2 py-4 transition hover:border-rose-500/40 disabled:opacity-50">
                      <span className="block text-2xl">{emoji}</span><span className="mt-1 block text-[10px] font-bold">{label}</span>
                    </button>
                  ))}
                </div>
                {gameState.result && <p className="mt-4 text-[11px] text-taupe">Pilih lagi untuk mulai ronde berikutnya.</p>}
              </div>
            )}

            {game.game_type === 'couple_quiz' && (
              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold text-rose-400">
                  <Sparkles size={13} /> {gameState.scores?.[user.id] || 0} poin kamu · {gameState.scores?.[partnerId] || 0} pasangan
                </div>
                <p className="text-base font-extrabold leading-6">{quizQuestion.prompt}</p>
                {!gameState.revealed ? (
                  <div className="mt-4 space-y-2">
                    {quizQuestion.options.map(option => (
                      <button key={option} type="button" onClick={() => sendAction({ type: 'answer', answer: option })} disabled={busy || !partnerId || Boolean(gameState.answers?.[user.id])} className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-left text-xs font-bold transition hover:border-rose-500/40 disabled:opacity-60">
                        {gameState.answers?.[user.id] === option ? '✓ ' : ''}{option}
                      </button>
                    ))}
                    <p className="pt-1 text-[10px] text-taupe">{gameState.answers?.[user.id] ? 'Jawabanmu terkunci · menunggu pasangan' : 'Pilih jawaban yang paling kamu rasa cocok'}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-line bg-cream p-4">
                    <p className="text-xs font-bold">{gameState.answers?.[user.id] === gameState.answers?.[partnerId] ? 'Satu frekuensi 💞' : 'Beda pilihan, tetap seru 🤍'}</p>
                    <p className="mt-2 text-[11px] text-taupe">Kamu: {gameState.answers?.[user.id]} · {couple.partner_1_id === user.id ? couple.partner_2_name : couple.partner_1_name}: {gameState.answers?.[partnerId]}</p>
                    <button type="button" onClick={() => sendAction({ type: 'next_question' })} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                      <Hand size={14} /> Pertanyaan berikutnya
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-center text-[10px] leading-5 text-taupe">Skor dan giliran tersimpan pada satu baris bersama, lalu tersinkron realtime.</p>
    </section>
  )
}
