import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Bell, CalendarDays, Camera, Check, ChevronLeft, ChevronRight,
  Download, Heart, ImagePlus, LogOut, MessageCircle, MessageSquare, Plus, Send, Settings, Sparkles, Trash2, Upload, X
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { uploadImage, optimizedImage } from './lib/cloudinary'
import { exportJournal } from './lib/exportJournal'
import { compressImage } from './utils/compressImage'
import { checkLocalReminder, downloadCalendarAlarm, readReminderSettings, saveReminderSettings, showTestReminder } from './utils/reminder'

const moods = [
  { label: 'Happy', emoji: '☀️' },
  { label: 'Capek', emoji: '🥱' },
  { label: 'Kangen', emoji: '🥺' },
  { label: 'Makan', emoji: '🍽️' },
  { label: 'Sibuk', emoji: '🔥' },
  { label: 'Sayang', emoji: '🥰' }
]

const dateLabel = (value, options = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('id-ID', options).format(new Date(`${value}T12:00:00`))

const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function Button({ children, className = '', ...props }) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`} {...props}>{children}</button>
}

function SetupNotice() {
  return (
    <div className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-md rounded-[2rem] border border-line bg-white p-7 shadow-soft">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><Heart fill="currentColor" /></div>
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-terracotta">FazaHub</p>
        <h1 className="mt-2 text-2xl font-extrabold">Satu langkah kecil lagi</h1>
        <p className="mt-3 text-sm leading-6 text-taupe">Tambahkan kredensial Supabase di file <code className="rounded bg-cream px-1.5 py-0.5">.env</code> untuk mulai menggunakan jurnal privat ini.</p>
        <div className="mt-5 rounded-2xl bg-cream p-4 font-mono text-xs leading-6 text-taupe">
          VITE_SUPABASE_URL=...<br />VITE_SUPABASE_ANON_KEY=...
        </div>
        <p className="mt-4 text-xs leading-5 text-taupe">Untuk fitur foto, isi juga Cloudinary cloud name dan unsigned upload preset.</p>
      </div>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } })
      if (result.error) setMessage(result.error.message)
      else if (mode === 'signup' && !result.data.session) setMessage('Cek email kamu untuk mengonfirmasi akun, lalu masuk.')
    } catch (error) {
      setMessage(error.message || 'Koneksi gagal. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md animate-rise-in">
        <Brand />
        <div className="mt-8 rounded-[2rem] border border-line bg-white p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold text-terracotta">{mode === 'login' ? 'Senang kamu kembali' : 'Mulai cerita kalian'}</p>
          <h1 className="mt-2 text-2xl font-extrabold">{mode === 'login' ? 'Masuk ke FazaHub' : 'Buat akun baru'}</h1>
          <p className="mt-2 text-sm leading-6 text-taupe">Ruang kecil yang hanya bisa kalian berdua lihat.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && <Field label="Nama panggilan" value={name} onChange={setName} placeholder="Contoh: Naya" required />}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="kamu@email.com" required />
            <Field label="Kata sandi" type="password" value={password} onChange={setPassword} placeholder="Minimal 6 karakter" minLength={6} required />
            {message && <p role="status" className="rounded-xl bg-[#FFF1ED] px-4 py-3 text-sm leading-5 text-[#A54D37]">{message}</p>}
            <Button type="submit" disabled={busy} className="w-full bg-terracotta px-5 py-3.5 text-sm text-white hover:bg-[#cf6b52]">
              {busy ? 'Sebentar ya...' : mode === 'login' ? 'Masuk' : 'Buat akun'} <ArrowRight size={17} />
            </Button>
          </form>
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }} className="mt-5 w-full text-center text-sm font-medium text-taupe hover:text-charcoal">
            {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
            <span className="font-bold text-terracotta">{mode === 'login' ? 'Daftar' : 'Masuk'}</span>
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-taupe">Dibuat dengan <Heart className="mx-1 inline text-terracotta" size={12} fill="currentColor" /> untuk cerita kalian.</p>
      </div>
    </main>
  )
}

function Brand({ compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'justify-center'}`}>
      <span className="grid h-12 w-12 place-items-center rounded-[17px] bg-terracotta text-white shadow-[0_8px_20px_rgba(224,122,95,.24)]"><Heart size={23} fill="currentColor" /></span>
      <div>
        <div className="font-sans text-[1.35rem] font-extrabold tracking-[-.06em]">Faza<span className="text-terracotta">Hub</span></div>
        {!compact && <div className="mt-0.5 text-xs text-taupe">ruang kecil untuk cerita kita</div>}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-charcoal">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-2xl border border-line bg-[#FDFCFB] px-4 py-3 text-sm outline-none transition placeholder:text-[#B5AFA6] focus:border-terracotta focus:ring-4 focus:ring-[#E07A5F]/10" {...props} />
    </label>
  )
}

function CoupleSetup({ user, onComplete, onSignOut }) {
  const [mode, setMode] = useState('choice')
  const [name, setName] = useState(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createCouple(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const inviteCode = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('')
      const { data, error: createError } = await supabase.from('couples').insert({
        invite_code: inviteCode, partner_1_id: user.id, partner_1_name: name.trim()
      }).select().single()
      if (createError) throw createError
      onComplete(data)
    } catch (createError) {
      setError(createError.code === '23505'
        ? 'Akun ini sudah terhubung ke ruang lain. Muat ulang aplikasi untuk membuka ruang tersebut.'
        : createError.message || 'Ruang belum berhasil dibuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function joinCouple(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { data, error: joinError } = await supabase.rpc('join_couple', {
        p_invite_code: code.trim().toUpperCase(), p_partner_name: name.trim()
      })
      if (joinError) throw joinError
      const { data: couple, error: fetchError } = await supabase.from('couples').select('*').eq('id', data).single()
      if (fetchError) throw fetchError
      onComplete(couple)
    } catch (joinError) {
      setError(joinError.message || 'Kode belum berhasil dipakai. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-5 py-10">
      <section className="w-full max-w-md animate-rise-in">
        <Brand />
        <div className="mt-8 rounded-[2rem] border border-line bg-white p-6 shadow-soft sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><Heart fill="currentColor" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-terracotta">Ruang berdua</p>
          <h1 className="mt-2 text-2xl font-extrabold">{mode === 'choice' ? 'Siap bikin kenangan?' : mode === 'create' ? 'Buat ruang kalian' : 'Gabung ke ruang'}</h1>
          <p className="mt-2 text-sm leading-6 text-taupe">{mode === 'choice' ? 'Buat ruang baru lalu bagikan kode undangan, atau masukkan kode dari pasanganmu.' : mode === 'create' ? 'Nanti kamu bisa mengundang pasangan dengan kode privat.' : 'Masukkan kode undangan 6 karakter dari pasanganmu.'}</p>
          {mode === 'choice' ? (
            <div className="mt-6 space-y-3">
              <Button onClick={() => setMode('create')} className="w-full bg-terracotta px-5 py-3.5 text-sm text-white"><Plus size={18} /> Buat ruang baru</Button>
              <Button onClick={() => setMode('join')} className="w-full border border-line bg-white px-5 py-3.5 text-sm text-charcoal hover:bg-cream"><Heart size={17} /> Aku punya kode undangan</Button>
            </div>
          ) : (
            <form onSubmit={mode === 'create' ? createCouple : joinCouple} className="mt-6 space-y-4">
              <Field label="Nama panggilanmu" value={name} onChange={setName} placeholder="Contoh: Naya" maxLength={50} required />
              {mode === 'join' && <Field label="Kode undangan" value={code} onChange={value => setCode(value.toUpperCase())} placeholder="ABC123" maxLength={6} autoCapitalize="characters" required />}
              {error && <p role="alert" className="rounded-xl bg-[#FFF1ED] px-4 py-3 text-sm text-[#A54D37]">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full bg-terracotta px-5 py-3.5 text-sm text-white">{busy ? 'Sebentar ya...' : mode === 'create' ? 'Buat ruang' : 'Gabung sekarang'} <ArrowRight size={17} /></Button>
              <button type="button" onClick={() => { setMode('choice'); setError('') }} className="w-full py-2 text-sm font-semibold text-taupe">Kembali</button>
            </form>
          )}
          <button onClick={onSignOut} className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-taupe hover:text-charcoal"><LogOut size={14} /> Keluar</button>
        </div>
      </section>
    </main>
  )
}

function SnapCard({ snap, partnerName, canDelete = false, onDelete, comments = [], commentsLoading = false, userId, onAddComment }) {
  const mood = moods.find(item => item.label === snap.mood)
  const author = partnerName(snap.user_id)
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#121215] animate-rise-in">
      <div className="relative isolate aspect-[4/5]">
        <img src={optimizedImage(snap.image_url)} alt={snap.note || `Kenangan ${dateLabel(snap.snap_date)}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
        {mood && <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">{mood.emoji} {mood.label}</span>}
        {canDelete && <button type="button" onClick={() => onDelete(snap)} aria-label="Hapus foto ini" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md"><Trash2 size={16} /></button>}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight">{author}</p>
              <p className="mt-1 font-mono text-xs tracking-wide text-white/75">{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(snap.created_at))} <span className="mx-1">·</span> {dateLabel(snap.snap_date, { day: 'numeric', month: 'short' })}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">FazaHub</span>
          </div>
          {snap.note && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-white/90">{snap.note}</p>}
        </div>
      </div>
      <CommentThread snapId={snap.id} comments={comments} loading={commentsLoading} userId={userId} partnerName={partnerName} onAddComment={onAddComment} />
    </article>
  )
}

function CommentThread({ snapId, comments, loading, userId, partnerName, onAddComment }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      await onAddComment(snapId, body)
      setDraft('')
    } catch (submitError) {
      setError(submitError.message || 'Komentar gagal dikirim. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 p-4">
      {comments.length > 0 && <div className="space-y-2.5">
        {comments.map(comment => <div key={comment.id} className="flex items-start gap-2.5 text-xs leading-5">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-bold ${comment.user_id === userId ? 'bg-rose-500/15 text-rose-400' : 'bg-white/10 text-zinc-300'}`}>{partnerName(comment.user_id).slice(0, 1).toUpperCase()}</span>
          <p className="min-w-0 flex-1"><span className="mr-1.5 font-bold text-charcoal">{partnerName(comment.user_id)}</span><span className="whitespace-pre-wrap text-taupe">{comment.body}</span></p>
          <time className="shrink-0 font-mono text-[9px] text-taupe">{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(comment.created_at))}</time>
        </div>)}
      </div>}
      {loading && comments.length === 0 && <p className="text-[11px] text-taupe">Memuat komentar...</p>}
      <form onSubmit={submit} className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`comment-${snapId}`}>Tulis komentar</label>
        <input id={`comment-${snapId}`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Tulis komentar..." className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2.5 text-xs outline-none placeholder:text-taupe focus:border-rose-500/50" />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim komentar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-40"><Send size={15} /></button>
      </form>
      {error && <p role="alert" className="text-[11px] text-rose-400">{error}</p>}
    </div>
  )
}

function FeedView({ snaps, partnerName, userId, commentsBySnap, commentsLoading, onAddComment, onAdd, loading, streak, todayUserCount, reminderDue, onDelete }) {
  return (
    <div className="pb-6">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[.16em] text-taupe">{dateLabel(localDate())}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div><p className="text-xs font-semibold text-taupe">Cerita hari ini</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Hari ini</h1></div>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs font-bold text-charcoal">{streak}D <span aria-hidden="true">🔥</span></span>
        </div>
        <p className="mt-3 text-xs text-taupe">{todayUserCount > 0 ? `Kamu sudah menyimpan ${todayUserCount} momen hari ini.` : 'Simpan momen pertamamu hari ini.'}</p>
      </div>
      {reminderDue && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">Hari ini masih punya satu ruang untuk disimpan.</div>}
      {loading ? <Loading /> : snaps.length === 0
        ? <EmptyState onAdd={onAdd} />
        : <div className="space-y-4">{snaps.map(snap => <SnapCard key={snap.id} snap={snap} partnerName={partnerName} canDelete={snap.user_id === userId} onDelete={onDelete} comments={commentsBySnap[snap.id] || []} commentsLoading={commentsLoading} userId={userId} onAddComment={onAddComment} />)}</div>}
      <Button onClick={onAdd} className="fixed bottom-24 right-[max(calc((100vw-26rem)/2+1rem),1rem)] z-20 h-14 w-14 rounded-full bg-white text-black shadow-xl" aria-label="Tambah foto"><Plus size={23} /></Button>
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-[#E6D9D0] bg-white px-7 py-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#FFF0EC] text-terracotta"><Camera size={27} /></div>
      <h2 className="mt-5 text-lg font-extrabold">Halaman pertama cerita kalian</h2>
      <p className="mx-auto mt-2 max-w-[260px] text-sm leading-6 text-taupe">Simpan satu momen kecil hari ini. Besok, kalian akan senang menemukannya lagi.</p>
      <Button onClick={onAdd} className="mt-6 bg-terracotta px-5 py-3 text-sm text-white"><Plus size={17} /> Tambah foto pertama</Button>
    </div>
  )
}

function CalendarView({ snaps, onSelectDate }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const days = useMemo(() => {
    const year = month.getFullYear(), monthIndex = month.getMonth()
    const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7
    const count = new Date(year, monthIndex + 1, 0).getDate()
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)]
  }, [month])
  const snapsByDate = useMemo(() => snaps.reduce((acc, snap) => {
    acc[snap.snap_date] = [...(acc[snap.snap_date] || []), snap]
    return acc
  }, {}), [snaps])
  const orderedWeekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

  return (
    <div className="animate-rise-in pb-6">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-terracotta">Peta kenangan</p>
      <h1 className="mt-1 text-2xl font-extrabold">Kalender kita</h1>
      <div className="mt-5 rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-5 flex items-center justify-between">
          <Button aria-label="Bulan sebelumnya" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-9 w-9 rounded-xl text-taupe hover:bg-cream"><ChevronLeft size={19} /></Button>
          <span className="text-sm font-extrabold">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(month)}</span>
          <Button aria-label="Bulan berikutnya" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-9 w-9 rounded-xl text-taupe hover:bg-cream"><ChevronRight size={19} /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {orderedWeekdays.map(day => <div key={day} className="pb-2 text-[10px] font-bold uppercase tracking-wide text-[#A49D93]">{day}</div>)}
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="aspect-square" />
            const date = localDate(new Date(month.getFullYear(), month.getMonth(), day))
            const entries = snapsByDate[date] || []
            return (
              <button key={date} onClick={() => entries.length && onSelectDate(date)} disabled={!entries.length} className={`relative aspect-square overflow-hidden rounded-xl transition ${entries.length ? 'ring-2 ring-transparent hover:ring-terracotta' : 'cursor-default'}`}>
                {entries[0] ? <img src={optimizedImage(entries[0].image_url, true)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <span className={`grid h-full place-items-center text-xs ${date === localDate() ? 'font-extrabold text-terracotta' : 'text-taupe'}`}>{day}</span>}
                {entries[0] && <><span className="absolute inset-0 bg-black/20" /><span className="absolute inset-0 grid place-items-center text-xs font-bold text-white">{day}</span><span className="absolute bottom-1 right-1 min-w-4 rounded-full bg-black/70 px-1 text-[9px] font-bold leading-4 text-white">{entries.length > 1 ? `+${entries.length - 1}` : '1'}</span></>}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-taupe">Ketuk tanggal dengan foto untuk membuka kenangannya ✨</p>
    </div>
  )
}

function SettingsView({ couple, user, partnerName, snaps, theme, onThemeChange, onSignOut, onLeaveRoom }) {
  const [copied, setCopied] = useState(false)
  const [reminder, setReminder] = useState(() => readReminderSettings(user.id))
  const [reminderError, setReminderError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 })
  const [exportError, setExportError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [reminderBusy, setReminderBusy] = useState(false)
  const isPartner1 = couple.partner_1_id === user.id
  const myName = isPartner1 ? couple.partner_1_name : couple.partner_2_name
  const otherName = isPartner1 ? couple.partner_2_name : couple.partner_1_name
  const reminderLabel = reminder.time.replace(':', '.')

  async function toggleReminder() {
    if (reminderBusy) return
    setReminderBusy(true)
    setReminderError('')
    try {
      if (reminder.enabled) {
        const next = { ...reminder, enabled: false }
        saveReminderSettings(user.id, next)
        setReminder(next)
      } else {
        await showTestReminder()
        const next = { ...reminder, enabled: true }
        saveReminderSettings(user.id, next)
        setReminder(next)
      }
    } catch (error) {
      setReminderError(error.message || 'Pengaturan pengingat gagal. Coba lagi.')
    } finally {
      setReminderBusy(false)
    }
  }

  function changeReminderTime(time) {
    if (!/^\d{2}:\d{2}$/.test(time)) return
    const next = { ...reminder, time }
    try {
      saveReminderSettings(user.id, next)
      setReminder(next)
      setReminderError('')
    } catch (error) {
      setReminderError(error.message)
    }
  }

  async function downloadJournal() {
    setExportBusy(true)
    setExportProgress({ done: 0, total: snaps.length })
    setExportError('')
    try {
      await exportJournal(snaps, partnerName, (done, total) => setExportProgress({ done, total }))
    } catch (error) {
      setExportError(error.message || 'Ekspor jurnal gagal. Coba lagi.')
    } finally {
      setExportBusy(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(couple.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function leaveRoom() {
    setLeaving(true)
    try {
      await onLeaveRoom()
      setConfirmLeave(false)
    } catch (error) {
      setRoomError(error.message || 'Ruang belum berhasil ditinggalkan.')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div className="animate-rise-in pb-6">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-terracotta">FazaHub / Pengaturan</p>
      <h1 className="mt-1 text-2xl font-extrabold">Ruang kita</h1>
      <div className="mt-5 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><Heart fill="currentColor" size={21} /></div>
          <div><p className="text-sm font-extrabold">{myName} & {otherName || 'pasanganmu'}</p><p className="mt-1 text-xs text-taupe">{otherName ? 'Ruang kalian sudah berdua 🤍' : 'Menunggu pasangan bergabung'}</p></div>
        </div>
        {!otherName && <div className="mt-5 rounded-2xl bg-cream p-4">
          <p className="text-xs font-semibold text-taupe">Bagikan kode ini ke pasanganmu</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-xl font-extrabold tracking-[.2em] text-terracotta">{couple.invite_code}</span>
            <Button onClick={copyCode} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-charcoal shadow-sm">{copied ? <Check size={14} /> : <Upload size={14} />}{copied ? 'Tersalin' : 'Salin kode'}</Button>
          </div>
        </div>}
      </div>
      <div className="mt-4 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-taupe">Akun</p>
        <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm font-semibold">Email</span><span className="truncate text-sm text-taupe">{user.email}</span></div>
      </div>
      <div className="mt-4 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-sm font-extrabold">Tampilan</p><p className="mt-1 text-xs text-taupe">Pilih tema yang nyaman buatmu.</p></div>
          <button type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')} className="rounded-full border border-line bg-cream px-4 py-2 text-xs font-bold">{theme === 'dark' ? 'Gelap' : 'Terang'}</button>
        </div>
      </div>
      <div className="mt-4 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0EC] text-terracotta"><Bell size={19} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Pengingat harian</p>
            <p className="mt-1 text-xs leading-5 text-taupe">Notifikasi lokal saat FazaHub berjalan dan belum ada foto hari ini.</p>
          </div>
        </div>
        <label className="mt-4 block text-xs font-bold">Jam pengingat
          <input type="time" value={reminder.time} onChange={event => changeReminderTime(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-cream px-4 py-3 font-mono text-sm" />
        </label>
        <Button onClick={toggleReminder} disabled={reminderBusy} className={`mt-3 w-full px-4 py-3 text-sm ${reminder.enabled ? 'border border-line bg-white text-charcoal' : 'bg-terracotta text-white'}`}>
          {reminderBusy ? 'Memeriksa izin...' : reminder.enabled ? <><Bell size={16} /> Pengingat Aktif ({reminderLabel}) · Matikan</> : <><Bell size={16} /> Aktifkan pengingat ({reminderLabel})</>}
        </Button>
        <Button onClick={() => downloadCalendarAlarm(reminder.time)} className="mt-2 w-full border border-line bg-white px-4 py-3 text-xs text-charcoal">Tambah alarm ke Kalender HP (.ics)</Button>
        <p className="mt-3 text-[11px] leading-5 text-taupe">Notifikasi aplikasi hanya bisa dipastikan saat browser atau PWA berjalan. Untuk alarm yang tetap berbunyi saat aplikasi ditutup, impor file kalender dan pastikan aplikasi Kalender mengaktifkan notifikasinya.</p>
        {reminderError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{reminderError}</p>}
      </div>
      <div className="mt-4 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-taupe"><Download size={19} /></div>
          <div><p className="text-sm font-extrabold">Ekspor jurnal</p><p className="mt-1 text-xs leading-5 text-taupe">Unduh foto teroptimasi beserta catatan dan mood dalam satu file ZIP.</p></div>
        </div>
        <Button onClick={downloadJournal} disabled={exportBusy || !snaps.length} className="mt-4 w-full bg-cream px-4 py-3 text-sm text-charcoal">
          <Download size={16} />{exportBusy ? `Menyiapkan ${exportProgress.done}/${exportProgress.total} foto...` : `Unduh ZIP${snaps.length ? ` · ${snaps.length} foto` : ''}`}
        </Button>
        {exportError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{exportError}</p>}
      </div>
      <Button onClick={() => { setRoomError(''); setConfirmLeave(true) }} className="mt-4 w-full border border-[#F2DAD3] bg-white px-5 py-3.5 text-sm text-[#B6533C]"><LogOut size={17} /> Keluar / Hapus ruang</Button>
      <Button onClick={onSignOut} className="mt-5 w-full border border-[#F2DAD3] bg-white px-5 py-3.5 text-sm text-[#B6533C] hover:bg-[#FFF6F3]"><LogOut size={17} /> Keluar dari akun</Button>
      <p className="mt-7 text-center text-xs text-taupe">FazaHub dibuat untuk dua orang. <Heart className="mx-1 inline text-terracotta" size={12} fill="currentColor" /></p>
      {confirmLeave && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="leave-title" className="w-full max-w-sm rounded-3xl border border-line bg-white p-5 shadow-2xl">
          <h2 id="leave-title" className="text-lg font-extrabold">{isPartner1 ? 'Hapus ruang kalian?' : 'Keluar dari ruang?'}</h2>
          <p className="mt-2 text-sm leading-6 text-taupe">{isPartner1 ? 'Ruang, semua foto, dan catatan di dalamnya akan dihapus permanen untuk kalian berdua.' : 'Kamu akan keluar dari ruang. Foto kenangan tetap tersedia untuk pasanganmu.'}</p>
          {roomError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{roomError}</p>}
          <div className="mt-5 flex gap-3">
            <Button onClick={() => setConfirmLeave(false)} disabled={leaving} className="flex-1 border border-line bg-white px-4 py-3 text-sm">Batal</Button>
            <Button onClick={leaveRoom} disabled={leaving} className="flex-1 bg-terracotta px-4 py-3 text-sm text-white">{leaving ? 'Memproses...' : isPartner1 ? 'Hapus ruang' : 'Keluar'}</Button>
          </div>
        </section>
      </div>}
    </div>
  )
}

function Loading() {
  return <div className="grid min-h-64 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#F1D7CF] border-t-terracotta" /></div>
}

function AddSnapModal({ userId, coupleId, onClose, onSaved }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [mood, setMood] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(localDate())
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [error, setError] = useState('')
  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  useEffect(() => {
    if (!file) { setPreview(''); return undefined }
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  function chooseFile(event) {
    const input = event.currentTarget
    const selected = input.files?.[0]
    input.value = ''
    if (!selected) return
    const isImage = selected.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(selected.name)
    if (!isImage) { setFile(null); setError('Pilih file gambar ya.'); return }
    if (selected.size > 20 * 1024 * 1024) { setFile(null); setError('Ukuran foto maksimal 20 MB sebelum kompresi.'); return }
    setError('')
    setFile(selected)
  }

  async function submit(event) {
    event.preventDefault()
    if (!file) { setError('Pilih foto yang ingin disimpan.'); return }
    if (!mood) { setError('Pilih mood untuk momen ini.'); return }
    if (!cloudName || !uploadPreset) { setError('Cloudinary belum dikonfigurasi. Isi cloud name dan unsigned upload preset di .env.'); return }
    if (busy) return
    setBusy(true)
    setError('')
    setUploadProgress(0)
    try {
      setUploadStage('Mengoptimalkan foto...')
      const compressedFile = await compressImage(file)
      setUploadStage(`Mengunggah foto · ${Math.max(1, Math.round(compressedFile.size / 1024))} KB`)
      const imageUrl = await uploadImage(compressedFile, cloudName, uploadPreset, setUploadProgress)
      setUploadStage('Menyimpan kenangan...')
      const { error: saveError } = await supabase.from('daily_snaps').insert({
        couple_id: coupleId, user_id: userId, snap_date: date, image_url: imageUrl, mood, note: note.trim() || null
      })
      if (saveError) {
        throw new Error(`Foto sudah terunggah, tetapi catatannya gagal disimpan: ${saveError.message}. Periksa feed sebelum mencoba unggah ulang.`)
      }
      onSaved()
    } catch (uploadError) {
      setError(uploadError.message || 'Momen belum berhasil disimpan. Coba lagi ya.')
    } finally {
      setBusy(false)
      setUploadStage('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#211d19]/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <section className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-terracotta">Satu momen kecil</p><h2 className="mt-1 text-xl font-extrabold">Tambah kenangan</h2></div>
          <Button aria-label="Tutup" onClick={onClose} disabled={busy} className="h-10 w-10 rounded-xl bg-white text-taupe"><X size={19} /></Button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={chooseFile} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={chooseFile} className="hidden" />
          {preview && <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black/5"><img src={preview} alt="Pratinjau foto" className="absolute inset-0 h-full w-full object-cover" /></div>}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" onClick={() => galleryInputRef.current?.click()} className="border border-line bg-white px-3 py-3 text-xs text-charcoal"><ImagePlus size={16} />{preview ? 'Ganti dari galeri' : 'Pilih dari Galeri'}</Button>
            <Button type="button" onClick={() => cameraInputRef.current?.click()} className="border border-line bg-white px-3 py-3 text-xs text-charcoal"><Camera size={16} />Buka Kamera</Button>
          </div>
          {!preview && <p className="text-center text-[11px] text-taupe">JPG, PNG, WebP, atau HEIC · maksimal 20 MB sebelum kompresi</p>}
          <div>
            <p className="mb-2 text-xs font-bold">Mood hari ini</p>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {moods.map(item => <button type="button" key={item.label} onClick={() => setMood(item.label)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${mood === item.label ? 'border-terracotta bg-[#FFF0EC] text-[#A54D37]' : 'border-line bg-white text-taupe'}`}><span>{item.emoji}</span>{item.label}</button>)}
            </div>
          </div>
          <Field label="Tanggal momen" type="date" value={date} onChange={setDate} required />
          <label className="block"><span className="mb-2 block text-xs font-bold">Catatan kecil <span className="font-medium text-taupe">(opsional)</span></span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={200} rows={3} placeholder="Apa yang ingin kamu ingat dari hari ini?" className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-[#B5AFA6] focus:border-terracotta focus:ring-4 focus:ring-[#E07A5F]/10" /><span className="mt-1 block text-right text-[10px] text-taupe">{note.length}/200</span></label>
          {error && <p role="alert" className="rounded-xl bg-[#FFF1ED] px-4 py-3 text-xs leading-5 text-[#A54D37]">{error}</p>}
          {busy && <div aria-live="polite" className="space-y-2"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-rose-500 transition-[width]" style={{ width: `${uploadProgress}%` }} /></div><p className="text-center text-xs text-taupe">{uploadStage}{uploadProgress > 0 ? ` · ${uploadProgress}%` : ''}</p></div>}
          <Button type="submit" disabled={busy} className="w-full bg-terracotta px-5 py-3.5 text-sm text-white hover:bg-[#cf6b52]">{busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> {uploadStage || 'Menyimpan momen...'}</> : <><Sparkles size={17} /> Simpan kenangan</>}</Button>
        </form>
      </section>
    </div>
  )
}

function ChatView({ messages, user, partnerName, loading, onSend }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function submit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      await onSend(body)
      setDraft('')
    } catch (sendError) {
      setError(sendError.message || 'Pesan gagal dikirim. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex h-[calc(100dvh-13rem)] min-h-[360px] max-h-[720px] flex-col overflow-hidden rounded-3xl border border-line bg-white">
      <header className="border-b border-line px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-terracotta">Percakapan privat</p>
        <h1 className="mt-1 text-xl font-extrabold">Pesan berdua</h1>
        <p className="mt-1 text-[11px] text-taupe">Hanya kamu dan pasanganmu yang dapat melihat percakapan ini.</p>
      </header>
      <div aria-live="polite" className="chat-scroll-area flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? <Loading /> : messages.length === 0
          ? <div className="grid h-full place-items-center text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-taupe"><MessageCircle size={21} /></span><p className="mt-3 text-sm font-bold">Mulai obrolan kalian</p><p className="mt-1 text-xs text-taupe">Kirim pesan pertama, atau ceritakan foto hari ini.</p></div></div>
          : messages.map(message => {
            const mine = message.user_id === user.id
            return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <article className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 ${mine ? 'rounded-br-sm bg-white text-black' : 'rounded-bl-sm bg-[#25252B] text-zinc-100'}`}>
                {!mine && <p className="mb-1 text-[10px] font-bold text-rose-400">{partnerName(message.user_id)}</p>}
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
                <time className={`mt-1 block text-right font-mono text-[9px] ${mine ? 'text-zinc-500' : 'text-zinc-400'}`}>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}</time>
              </article>
            </div>
          })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="border-t border-line bg-white p-3">
        <div className="flex items-end gap-2">
          <label htmlFor="couple-chat-message" className="sr-only">Tulis pesan</label>
          <textarea
            id="couple-chat-message"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            maxLength={2000}
            rows={1}
            placeholder="Tulis pesan..."
            className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-line bg-cream px-4 py-3 text-sm outline-none placeholder:text-taupe focus:border-rose-500/50"
          />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pesan" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black disabled:opacity-40"><Send size={17} /></button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-rose-400">{error}</p>}
      </form>
    </section>
  )
}

const tabFromHash = hash => hash === '#calendar' ? 'calendar' : hash === '#space' ? 'space' : hash === '#chat' ? 'chat' : 'feed'

function AppShell({ user, couple, theme, onThemeChange, onSignOut, onLeaveRoom }) {
  const [snaps, setSnaps] = useState([])
  const [comments, setComments] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [error, setError] = useState('')
  const [reminderDue, setReminderDue] = useState(false)
  const [route, setRoute] = useState(() => {
    const tab = tabFromHash(window.location.hash)
    return { tab, overlay: null, date: null }
  })
  const routeRef = useRef(route)
  const [today, setToday] = useState(() => localDate())
  const partnerName = userId => userId === couple.partner_1_id ? couple.partner_1_name : (couple.partner_2_name || 'Pasangan')

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentDate = localDate()
      setToday(previousDate => previousDate === currentDate ? previousDate : currentDate)
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const setCurrentRoute = nextRoute => {
    routeRef.current = nextRoute
    setRoute(nextRoute)
  }

  const loadSnaps = useCallback(async () => {
    const pageSize = 1000
    const entries = []
    let offset = 0
    while (true) {
      const { data, error: loadError } = await supabase.from('daily_snaps')
        .select('id,couple_id,user_id,snap_date,image_url,mood,note,created_at')
        .eq('couple_id', couple.id)
        .order('snap_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }
      entries.push(...(data || []))
      if (!data || data.length < pageSize) break
      offset += pageSize
    }
    setSnaps(entries)
    setError('')
    setLoading(false)
  }, [couple.id])

  const loadComments = useCallback(async () => {
    const pageSize = 1000
    const entries = []
    let offset = 0
    while (true) {
      const { data, error: loadError } = await supabase.from('snap_comments')
        .select('id,snap_id,couple_id,user_id,body,created_at')
        .eq('couple_id', couple.id)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (loadError) {
        setError(`Komentar belum bisa dimuat: ${loadError.message}`)
        setCommentsLoading(false)
        return
      }
      entries.push(...(data || []))
      if (!data || data.length < pageSize) break
      offset += pageSize
    }
    setComments(entries)
    setCommentsLoading(false)
  }, [couple.id])

  const loadMessages = useCallback(async () => {
    const pageSize = 1000
    const entries = []
    let offset = 0
    while (true) {
      const { data, error: loadError } = await supabase.from('couple_messages')
        .select('id,couple_id,user_id,body,created_at')
        .eq('couple_id', couple.id)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (loadError) {
        setError(`Pesan belum bisa dimuat: ${loadError.message}`)
        setMessagesLoading(false)
        return
      }
      entries.push(...(data || []))
      if (!data || data.length < pageSize) break
      offset += pageSize
    }
    setMessages(entries)
    setMessagesLoading(false)
  }, [couple.id])

  async function addComment(snapId, body) {
    const { data, error: insertError } = await supabase.from('snap_comments')
      .insert({ snap_id: snapId, couple_id: couple.id, user_id: user.id, body })
      .select('id,snap_id,couple_id,user_id,body,created_at')
      .single()
    if (insertError) throw insertError
    setComments(current => current.some(comment => comment.id === data.id)
      ? current
      : [...current, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
  }

  async function sendMessage(body) {
    const { data, error: insertError } = await supabase.from('couple_messages')
      .insert({ couple_id: couple.id, user_id: user.id, body })
      .select('id,couple_id,user_id,body,created_at')
      .single()
    if (insertError) throw insertError
    setMessages(current => current.some(message => message.id === data.id)
      ? current
      : [...current, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
  }

  useEffect(() => {
    const initialRoute = { tab: tabFromHash(window.location.hash), overlay: null, date: null }
    window.history.replaceState({ fazahub: true, ...initialRoute }, '', `#${initialRoute.tab === 'space' ? 'space' : initialRoute.tab}`)
    setCurrentRoute(initialRoute)

    function onPopState(event) {
      const state = event.state
      if (state?.fazahub) {
        const nextRoute = { tab: state.tab, overlay: state.overlay || null, date: state.date || null }
        const closedOverlay = Boolean(routeRef.current.overlay) && !nextRoute.overlay
        if (!closedOverlay && !nextRoute.overlay && nextRoute.tab !== 'feed') {
          nextRoute.tab = 'feed'
          window.history.replaceState({ fazahub: true, ...nextRoute }, '', '#feed')
        }
        setCurrentRoute(nextRoute)
      } else {
        setCurrentRoute({ tab: tabFromHash(window.location.hash), overlay: null, date: null })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const pushRoute = nextRoute => {
    const normalized = { ...nextRoute, date: nextRoute.date || null, overlay: nextRoute.overlay || null }
    if (routeRef.current.tab === normalized.tab && !normalized.overlay && !routeRef.current.overlay) return
    window.history.pushState({ fazahub: true, ...normalized }, '', `#${normalized.tab}`)
    setCurrentRoute(normalized)
  }

  useEffect(() => {
    loadSnaps()
    loadComments()
    loadMessages()
    const channel = supabase.channel(`couple-snaps-${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_snaps', filter: `couple_id=eq.${couple.id}` }, loadSnaps)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snap_comments', filter: `couple_id=eq.${couple.id}` }, loadComments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_messages', filter: `couple_id=eq.${couple.id}` }, loadMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [couple.id, loadComments, loadMessages, loadSnaps])

  const todaySnaps = useMemo(() => snaps.filter(snap => snap.snap_date === today), [snaps, today])
  const todayUserCount = todaySnaps.filter(snap => snap.user_id === user.id).length
  const streak = useMemo(() => {
    const sharedDates = new Set()
    const participants = new Map()
    snaps.forEach(snap => {
      const ids = participants.get(snap.snap_date) || new Set()
      ids.add(snap.user_id)
      participants.set(snap.snap_date, ids)
    })
    participants.forEach((ids, date) => {
      if (ids.has(couple.partner_1_id) && ids.has(couple.partner_2_id)) sharedDates.add(date)
    })
    const cursor = new Date(`${today}T12:00:00`)
    if (!sharedDates.has(today)) cursor.setDate(cursor.getDate() - 1)
    let count = 0
    while (sharedDates.has(localDate(cursor))) {
      count += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  }, [snaps, couple.partner_1_id, couple.partner_2_id, today])

  useEffect(() => {
    let active = true
    const checkReminder = async () => {
      const reminder = readReminderSettings(user.id)
      const [hour, minute] = reminder.time.split(':').map(Number)
      const now = new Date()
      const isDue = reminder.enabled
        && todayUserCount === 0
        && now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute
      if (active) setReminderDue(isDue)
      if (isDue) await checkLocalReminder(user.id, todayUserCount)
    }
    checkReminder()
    const intervalId = window.setInterval(checkReminder, 60_000)
    window.addEventListener('focus', checkReminder)
    document.addEventListener('visibilitychange', checkReminder)
    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkReminder)
      document.removeEventListener('visibilitychange', checkReminder)
    }
  }, [user.id, todayUserCount])

  function openUpload() {
    pushRoute({ tab: routeRef.current.tab, overlay: 'upload' })
  }

  function closeOverlay() {
    if (routeRef.current.overlay) window.history.back()
  }

  async function deleteSnap(snap) {
    if (!window.confirm('Hapus foto ini dari jurnal? Tindakan ini tidak bisa dibatalkan.')) return
    const { error: deleteError } = await supabase.from('daily_snaps').delete()
      .eq('id', snap.id)
      .eq('user_id', user.id)
    if (deleteError) setError(deleteError.message)
    else {
      setSnaps(current => current.filter(item => item.id !== snap.id))
      setComments(current => current.filter(comment => comment.snap_id !== snap.id))
    }
  }

  async function confirmLeaveRoom() {
    const { error: leaveError } = await supabase.rpc('leave_couple')
    if (leaveError) throw leaveError
    onLeaveRoom()
  }

  const tabs = [
    { id: 'feed', label: 'Beranda', icon: Heart },
    { id: 'calendar', label: 'Kalender', icon: CalendarDays },
    { id: 'chat', label: 'Pesan', icon: MessageCircle },
    { id: 'space', label: 'Ruang kita', icon: Settings }
  ]
  const commentsBySnap = useMemo(() => comments.reduce((grouped, comment) => {
    grouped[comment.snap_id] = [...(grouped[comment.snap_id] || []), comment]
    return grouped
  }, {}), [comments])
  const selectedSnaps = route.date ? snaps.filter(snap => snap.snap_date === route.date) : []

  return (
    <div className="min-h-screen bg-cream sm:py-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-cream sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-line sm:shadow-xl">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-cream/90 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => pushRoute({ tab: 'feed' })} aria-label="FazaHub, ke Beranda"><Brand compact /></button>
            <div className="min-w-0 text-right">
              <p className="truncate text-xs font-bold">{couple.partner_1_name}{couple.partner_2_name ? ` & ${couple.partner_2_name}` : ''}</p>
              <p className="mt-1 text-[10px] text-taupe">{couple.partner_2_id ? `${todaySnaps.length} momen hari ini` : 'Menunggu pasangan bergabung'}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-5 pb-28 pt-6">
          {error && <div role="alert" className="mb-4 rounded-2xl bg-[#FFF1ED] px-4 py-3 text-xs leading-5 text-[#A54D37]">{error}</div>}
          {route.tab === 'feed' && <FeedView
            snaps={todaySnaps}
            partnerName={partnerName}
            userId={user.id}
            commentsBySnap={commentsBySnap}
            commentsLoading={commentsLoading}
            onAddComment={addComment}
            onAdd={openUpload}
            onDelete={deleteSnap}
            loading={loading}
            streak={streak}
            todayUserCount={todayUserCount}
            reminderDue={reminderDue}
          />}
          {route.tab === 'calendar' && <CalendarView snaps={snaps} onSelectDate={date => pushRoute({ tab: 'calendar', overlay: 'day', date })} />}
          {route.tab === 'chat' && <ChatView messages={messages} user={user} partnerName={partnerName} loading={messagesLoading} onSend={sendMessage} />}
          {route.tab === 'space' && <SettingsView
            couple={couple}
            user={user}
            partnerName={partnerName}
            snaps={snaps}
            theme={theme}
            onThemeChange={onThemeChange}
            onSignOut={onSignOut}
            onLeaveRoom={confirmLeaveRoom}
          />}
        </main>
        <nav aria-label="Navigasi utama" className="safe-bottom fixed bottom-3 left-4 right-4 z-30 mx-auto max-w-sm rounded-2xl border border-white/10 bg-zinc-900/80 px-5 pt-2 shadow-2xl backdrop-blur-xl sm:absolute">
          <div className="flex items-center justify-around">
            {tabs.map(item => {
              const Icon = item.icon
              const active = route.tab === item.id
              return <button key={item.id} onClick={() => pushRoute({ tab: item.id })} aria-current={active ? 'page' : undefined} className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${active ? 'text-terracotta' : 'text-[#A1A1AA]'}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} fill={active && item.id === 'feed' ? 'currentColor' : 'none'} /><span className={`text-[10px] ${active ? 'font-extrabold' : 'font-semibold'}`}>{item.label}</span></button>
            })}
          </div>
        </nav>
      </div>
      {route.overlay === 'upload' && <AddSnapModal
        userId={user.id}
        coupleId={couple.id}
        onClose={closeOverlay}
        onSaved={async () => {
          await loadSnaps()
          pushRoute({ tab: 'feed' })
        }}
      />}
      {route.overlay === 'day' && <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => event.target === event.currentTarget && closeOverlay()}>
        <section role="dialog" aria-modal="true" aria-labelledby="memory-date" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-widest text-terracotta">Kenangan</p><h2 id="memory-date" className="mt-1 text-xl font-extrabold">{dateLabel(route.date)}</h2></div>
            <Button onClick={closeOverlay} className="h-10 w-10 rounded-xl bg-white text-taupe" aria-label="Tutup galeri"><X size={18} /></Button>
          </div>
          <div className="space-y-4">{selectedSnaps.map(snap => <SnapCard key={snap.id} snap={snap} partnerName={partnerName} canDelete={snap.user_id === user.id} onDelete={deleteSnap} comments={commentsBySnap[snap.id] || []} commentsLoading={commentsLoading} userId={user.id} onAddComment={addComment} />)}</div>
        </section>
      </div>}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [couple, setCouple] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [coupleLoading, setCoupleLoading] = useState(false)
  const [coupleError, setCoupleError] = useState('')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('fazahub-theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const sessionRef = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090B' : '#FAFAFA')
    try {
      localStorage.setItem('fazahub-theme', theme)
    } catch {
      // Theme still applies for this session if storage is unavailable.
    }
  }, [theme])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false)
      return undefined
    }

    let active = true
    let subscription
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Failed to restore session:', error.message)
      sessionRef.current = data.session
      setSession(data.session)
      setCoupleLoading(Boolean(data.session?.user))
      setAuthLoading(false)
    }).catch(error => {
      if (!active) return
      console.error('Failed to restore session:', error.message)
      setAuthLoading(false)
    })

    const auth = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'TOKEN_REFRESHED') return
      const previousUserId = sessionRef.current?.user?.id
      const nextUserId = nextSession?.user?.id
      if (previousUserId !== nextUserId) {
        setCouple(null)
        setCoupleError('')
        setCoupleLoading(Boolean(nextUserId))
      }
      sessionRef.current = nextSession
      setSession(nextSession)
      if (event === 'SIGNED_OUT') {
        setCouple(null)
        setCoupleLoading(false)
      }
    })
    subscription = auth.data.subscription

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  const loadCouple = useCallback(async (userId, showLoading = false) => {
    if (showLoading) setCoupleLoading(true)
    const { data, error } = await supabase.from('couples').select('*')
      .or(`partner_1_id.eq.${userId},partner_2_id.eq.${userId}`)
      .maybeSingle()
    if (error) {
      console.error('Failed to load couple:', error.message)
      setCoupleError(error.message)
    } else {
      setCouple(data)
      setCoupleError('')
    }
    if (showLoading) setCoupleLoading(false)
    return { data, error }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setCouple(null)
      setCoupleLoading(false)
      return undefined
    }

    let active = true
    setCoupleLoading(true)
    supabase.from('couples').select('*')
      .or(`partner_1_id.eq.${userId},partner_2_id.eq.${userId}`)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Failed to load couple:', error.message)
          setCoupleError(error.message)
        } else {
          setCouple(data)
          setCoupleError('')
        }
        setCoupleLoading(false)
      })
      .catch(error => {
        if (!active) return
        setCoupleError(error.message || 'Ruang belum berhasil dimuat.')
        setCoupleLoading(false)
      })
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id || !couple?.id) return undefined
    const channel = supabase.channel(`couple-membership-${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${couple.id}` }, () => {
        loadCouple(session.user.id, false)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [couple?.id, loadCouple, session?.user?.id])

  if (!isSupabaseConfigured) return <SetupNotice />
  if (authLoading) return <main className="grid min-h-screen place-items-center bg-cream"><Loading /></main>
  if (!session) return <AuthScreen />
  if (coupleLoading) return <main className="grid min-h-screen place-items-center bg-cream"><Loading /></main>
  if (coupleError && !couple) return <main className="grid min-h-screen place-items-center bg-cream px-6"><section className="max-w-md rounded-3xl border border-line bg-white p-6"><h1 className="text-xl font-extrabold">Ruang belum bisa dimuat</h1><p className="mt-2 text-sm text-taupe">{coupleError}</p><Button onClick={() => loadCouple(session.user.id, true)} className="mt-4 bg-terracotta px-4 py-3 text-sm text-white">Coba lagi</Button></section></main>
  if (!couple) return <CoupleSetup user={session.user} onComplete={setCouple} onSignOut={() => supabase.auth.signOut()} />
  return <AppShell
    user={session.user}
    couple={couple}
    theme={theme}
    onThemeChange={setTheme}
    onSignOut={() => supabase.auth.signOut()}
    onLeaveRoom={() => { setCouple(null); setCoupleError('') }}
  />
}
