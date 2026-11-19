import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Bell, CalendarDays, Camera, Check, ChevronLeft, ChevronRight,
  Download, Heart, ImagePlus, LogOut, MessageCircle, MessageSquare, Mic, MicOff, Pause, Phone, PhoneOff, Plus, Send, Settings, Sparkles, Trash2, Upload, Video, VideoOff, Volume2, X
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { uploadAudioToCloudinary, uploadImage, optimizedImage } from './lib/cloudinary'
import { exportJournal } from './lib/exportJournal'
import { compressImage } from './utils/compressImage'
import { checkLocalReminder, downloadCalendarAlarm, readReminderSettings, saveReminderSettings, showTestReminder } from './utils/reminder'
import { readMessageNotificationSettings, requestMessageNotificationPermission, saveMessageNotificationSettings, showIncomingMessageNotification } from './utils/messageNotifications'
import { playIphoneMessageTone, playIphoneTestSounds, startIphoneRingback, startIphoneRingtone, stopIphoneRingback, stopIphoneRingtone } from './utils/iphoneSounds'
import VoiceRecorderBar from './components/VoiceRecorderBar'
import VoiceMessageBubble, { pauseActiveVoiceMessage } from './components/VoiceMessageBubble'

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
  const [messageNotifications, setMessageNotifications] = useState(() => readMessageNotificationSettings(user.id))
  const [messageNotificationError, setMessageNotificationError] = useState('')
  const [messageNotificationBusy, setMessageNotificationBusy] = useState(false)
  const [soundTestBusy, setSoundTestBusy] = useState(false)
  const [soundTestError, setSoundTestError] = useState('')
  const [notificationPermission, setNotificationPermission] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported')
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

  async function toggleMessageNotifications() {
    if (messageNotificationBusy) return
    setMessageNotificationBusy(true)
    setMessageNotificationError('')
    try {
      const next = { enabled: !messageNotifications.enabled }
      if (next.enabled) {
        setNotificationPermission(await requestMessageNotificationPermission())
      }
      saveMessageNotificationSettings(user.id, next)
      setMessageNotifications(next)
    } catch (error) {
      setMessageNotificationError(error.message || 'Notifikasi pesan gagal diaktifkan.')
    } finally {
      setMessageNotificationBusy(false)
    }
  }

  async function testIphoneSounds() {
    if (soundTestBusy) return
    setSoundTestBusy(true)
    setSoundTestError('')
    try {
      await playIphoneTestSounds()
    } catch (error) {
      setSoundTestError(error.message || 'Nada dering tidak dapat diputar di browser ini.')
    } finally {
      setSoundTestBusy(false)
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
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-taupe"><MessageCircle size={19} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Notifikasi pesan baru</p>
            <p className="mt-1 text-xs leading-5 text-taupe">Beri tahu saat pasangan mengirim pesan ketika FazaHub sedang berjalan.</p>
          </div>
        </div>
        <Button type="button" onClick={toggleMessageNotifications} disabled={messageNotificationBusy || notificationPermission === 'unsupported'} aria-pressed={messageNotifications.enabled} className={`mt-4 w-full px-4 py-3 text-sm ${messageNotifications.enabled ? 'border border-line bg-white text-charcoal' : 'bg-terracotta text-white'}`}>
          <Bell size={16} />{messageNotificationBusy ? 'Memeriksa izin...' : messageNotifications.enabled ? 'Notifikasi pesan aktif · Matikan' : 'Aktifkan notifikasi pesan'}
        </Button>
        {notificationPermission === 'denied' && <p className="mt-3 text-[11px] leading-5 text-taupe">Izin saat ini diblokir oleh browser. Ubah izin notifikasi FazaHub di pengaturan browser atau perangkat, lalu aktifkan kembali di sini.</p>}
        {notificationPermission === 'unsupported' && <p className="mt-3 text-[11px] leading-5 text-taupe">Browser ini belum mendukung notifikasi web.</p>}
        <p className="mt-3 text-[11px] leading-5 text-taupe">Notifikasi pesan memerlukan izin dan koneksi FazaHub tetap berjalan di browser atau PWA. Nada suara hanya dapat diputar jika browser masih menjalankan aplikasi dan mengizinkan audio. Pesan tidak menampilkan isi chat pada layar kunci.</p>
        {messageNotificationError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{messageNotificationError}</p>}
        <Button type="button" onClick={testIphoneSounds} disabled={soundTestBusy} className="mt-3 w-full border border-line bg-white px-4 py-2.5 text-xs text-charcoal">
          <Volume2 size={15} />{soundTestBusy ? 'Memutar suara dering & pesan...' : 'Tes Suara Dering & Pesan'}
        </Button>
        {soundTestError && <p role="alert" className="mt-2 text-xs leading-5 text-[#A54D37]">{soundTestError}</p>}
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
          <input ref={cameraInputRef} type="file" accept="image/*" onChange={chooseFile} className="hidden" />
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

function chatDateDividerLabel(isoString) {
  const msgDateObj = new Date(isoString)
  const msgDay = localDate(msgDateObj)
  const todayDay = localDate()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayDay = localDate(yesterdayDate)
  if (msgDay === todayDay) return 'Hari ini'
  if (msgDay === yesterdayDay) return 'Kemarin'
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(msgDateObj)
}

function ChatView({
  messages,
  user,
  partnerName,
  partnerDisplayName,
  partnerId,
  realtimeReady,
  callDisabled,
  onStartVoiceCall,
  onStartVideoCall,
  onBack,
  loading,
  onSend,
  keyboardOpen = false
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageToView, setImageToView] = useState('')
  const bottomRef = useRef(null)
  const imageInputRef = useRef(null)
  const textareaRef = useRef(null)
  const hasScrolledInitialRef = useRef(false)
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  const displayName = partnerDisplayName || 'Pasangan'
  const initial = displayName.slice(0, 1).toUpperCase()
  const canSend = Boolean((draft.trim() || selectedImage) && !busy)
  const canSendTextOrPhoto = Boolean(draft.trim() || selectedImage)

  useEffect(() => {
    if (!selectedImage) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(selectedImage)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedImage])

  useEffect(() => {
    if (loading) return
    const behavior = hasScrolledInitialRef.current ? 'smooth' : 'auto'
    hasScrolledInitialRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [messages, loading, keyboardOpen])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 96 // ~4 lines (20px * 4 + 16px padding)
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [draft])

  async function submit(event) {
    event.preventDefault()
    const body = draft.trim()
    if ((!body && !selectedImage) || busy) return
    setBusy(true)
    setError('')
    setUploadProgress(0)
    try {
      let imageUrl = null
      if (selectedImage) {
        if (!cloudName || !uploadPreset) throw new Error('Cloudinary belum dikonfigurasi untuk mengirim foto.')
        const compressedImage = await compressImage(selectedImage)
        imageUrl = await uploadImage(compressedImage, cloudName, uploadPreset, setUploadProgress)
      }
      await onSend(body, imageUrl)
      setDraft('')
      setSelectedImage(null)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (sendError) {
      setError(sendError.message || 'Pesan gagal dikirim. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function submitVoiceNote(blob, duration) {
    setBusy(true)
    setError('')
    try {
      const audioUrl = await uploadAudioToCloudinary(blob)
      await onSend('', null, audioUrl, duration)
    } finally {
      setBusy(false)
    }
  }

  function chooseImage(event) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name)) {
      setError('Pilih file gambar ya.')
      return
    }
    if (file.size > 20 * 1024 * 1024) { setError('Ukuran foto maksimal 20 MB sebelum kompresi.'); return }
    setError('')
    setSelectedImage(file)
  }

  return (
    <section className={`flex flex-col overflow-hidden bg-cream ${keyboardOpen ? 'h-[100dvh]' : 'h-[calc(100dvh-5rem)]'} sm:h-full`}>
      <header className="chat-header sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 border-b px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali ke Beranda"
            className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-charcoal transition hover:bg-cream active:scale-95"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="chat-avatar relative grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-extrabold">
            {initial}
            <span
              aria-hidden="true"
              className={`chat-avatar-status absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ${partnerId ? (realtimeReady ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-zinc-500'}`}
            />
          </div>
          <div className="min-w-0">
            <h1 className="chat-partner-name truncate text-sm font-semibold leading-tight">{displayName}</h1>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-taupe">
              {partnerId ? (realtimeReady ? 'Terhubung · Ruang berdua' : 'Menghubungkan...') : 'Menunggu pasangan'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onStartVoiceCall}
            disabled={callDisabled}
            aria-label="Panggilan suara"
            title={partnerId ? (realtimeReady ? 'Panggilan suara' : 'Menghubungkan...') : 'Pasangan belum bergabung'}
            className="chat-call-button grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 disabled:opacity-40"
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            onClick={onStartVideoCall}
            disabled={callDisabled}
            aria-label="Panggilan video"
            title={partnerId ? (realtimeReady ? 'Panggilan video' : 'Menghubungkan...') : 'Pasangan belum bergabung'}
            className="chat-call-button grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 disabled:opacity-40"
          >
            <Video size={18} />
          </button>
        </div>
      </header>

      <div aria-live="polite" className="chat-scroll-area flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
        {loading ? <Loading /> : messages.length === 0
          ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-taupe"><MessageCircle size={21} /></span>
                <p className="mt-3 text-sm font-bold">Mulai obrolan kalian</p>
                <p className="mt-1 text-xs text-taupe">Kirim pesan pertama, atau ceritakan foto hari ini.</p>
              </div>
            </div>
          )
          : messages.map((message, index) => {
            const mine = message.user_id === user.id
            const currentDay = localDate(new Date(message.created_at))
            const prevDay = index > 0 ? localDate(new Date(messages[index - 1].created_at)) : null
            const showDateDivider = currentDay !== prevDay
            const sameSenderAsPrev = index > 0 && !showDateDivider && messages[index - 1].user_id === message.user_id

            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full border border-line bg-white/90 px-3 py-1 text-[11px] font-semibold text-taupe shadow-sm backdrop-blur-sm">
                      {chatDateDividerLabel(message.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${sameSenderAsPrev ? '' : 'mt-1.5'}`}>
                  <article className={`max-w-[80%] px-3.5 py-2 shadow-sm ${mine ? 'chat-bubble-mine rounded-2xl rounded-br-sm' : 'chat-bubble-partner rounded-2xl rounded-bl-sm'}`}>
                    {!mine && !sameSenderAsPrev && <p className="mb-0.5 text-[10px] font-bold text-rose-400">{partnerName(message.user_id)}</p>}
                    {message.image_url && (
                      <button type="button" onClick={() => setImageToView(message.image_url)} className="mb-1.5 block overflow-hidden rounded-xl" aria-label="Buka foto">
                        <img src={optimizedImage(message.image_url, true)} alt="Foto dalam pesan" loading="lazy" className="max-h-64 w-full min-w-36 object-cover" />
                      </button>
                    )}
                    {message.audio_url && <VoiceMessageBubble audioUrl={message.audio_url} audioDuration={message.audio_duration} />}
                    {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>}
                    <time className={`mt-1 block text-right font-mono text-[9px] ${mine ? 'text-white/75' : 'text-taupe'}`}>
                      {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at))}
                    </time>
                  </article>
                </div>
              </div>
            )
          })}
        <div ref={bottomRef} className="h-1" />
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-line bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <input ref={imageInputRef} type="file" accept="image/*" onChange={chooseImage} className="hidden" />
        {selectedImage && (
          <div className="mb-2.5 flex items-center gap-3 rounded-2xl border border-line bg-cream p-2">
            <img src={previewUrl} alt="Pratinjau foto yang akan dikirim" className="h-12 w-12 rounded-xl object-cover" />
            <p className="min-w-0 flex-1 truncate text-xs text-taupe">{selectedImage.name}</p>
            <button type="button" onClick={() => setSelectedImage(null)} aria-label="Hapus foto pilihan" className="grid h-8 w-8 place-items-center rounded-full text-taupe hover:bg-white"><X size={16} /></button>
          </div>
        )}
        <VoiceRecorderBar disabled={busy} onSendAudio={submitVoiceNote}>
          {recorder => {
            const showRecorderControls = recorder.recording || recorder.pendingAudio || recorder.sending
            return (
              <>
                {showRecorderControls ? (
                  <div className="flex min-h-12 items-center gap-3 rounded-[26px] border border-line bg-cream px-3 py-1.5">
                    <button
                      type="button"
                      onClick={recorder.cancelRecording}
                      disabled={recorder.sending}
                      aria-label="Hapus pesan suara"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-40"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-charcoal">
                      {recorder.recording && <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />}
                      <span className="font-mono tabular-nums">
                        {recorder.formatDuration(recorder.elapsedSeconds || recorder.pendingAudio?.duration || 0)}
                      </span>
                      <span className="truncate text-xs text-taupe">
                        {recorder.recording ? 'Merekam pesan suara...' : recorder.sending ? 'Mengirim pesan suara...' : 'Siap dikirim'}
                      </span>
                      {recorder.recording && <Pause size={15} className="ml-auto shrink-0 text-rose-500" />}
                    </div>
                    <button
                      type="button"
                      onClick={recorder.sendRecording}
                      disabled={recorder.sending || busy}
                      aria-label="Kirim pesan suara"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                    >
                      {recorder.sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send size={17} />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 rounded-[26px] border border-line bg-cream px-2 py-1.5 focus-within:border-rose-500/50">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={busy}
                      aria-label="Lampirkan foto"
                      title="Lampirkan foto"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-charcoal transition hover:text-terracotta active:scale-95 disabled:opacity-40"
                    >
                      <Plus size={19} />
                    </button>
                    <label htmlFor="couple-chat-message" className="sr-only">Tulis pesan</label>
                    <textarea
                      ref={textareaRef}
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
                      className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-5 outline-none placeholder:text-taupe"
                    />
                    {canSendTextOrPhoto ? (
                      <button
                        type="submit"
                        disabled={!canSend}
                        aria-label={busy ? 'Mengirim pesan' : 'Kirim pesan'}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${canSend ? 'bg-rose-500 text-white shadow-sm' : 'bg-white/60 text-taupe opacity-40'}`}
                      >
                        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send size={16} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={recorder.startRecording}
                        disabled={busy}
                        aria-label="Rekam pesan suara"
                        title="Rekam pesan suara"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500 text-white shadow-sm transition active:scale-95 disabled:opacity-40"
                      >
                        <Mic size={17} />
                      </button>
                    )}
                  </div>
                )}
                {busy && selectedImage && <p aria-live="polite" className="mt-1.5 text-center text-[11px] text-taupe">{uploadProgress ? `Mengirim foto · ${uploadProgress}%` : 'Mengoptimalkan foto...'}</p>}
                {error && <p role="alert" className="mt-1.5 text-xs text-rose-400">{error}</p>}
                {recorder.error && <p role="alert" className="mt-1.5 text-xs text-rose-400">{recorder.error}</p>}
              </>
            )
          }}
        </VoiceRecorderBar>
      </form>

      {imageToView && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 p-4" role="dialog" aria-modal="true" aria-label="Foto dalam pesan" onClick={() => setImageToView('')}>
          <button type="button" onClick={() => setImageToView('')} aria-label="Tutup foto" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"><X size={20} /></button>
          <img src={optimizedImage(imageToView)} alt="Foto dalam pesan" className="max-h-full max-w-full rounded-xl object-contain" onClick={event => event.stopPropagation()} />
        </div>
      )}
    </section>
  )
}

function useVideoCall({ user, couple }) {
  const [call, setCall] = useState({ phase: 'idle', callType: 'video', error: '', notice: '', relayMode: 'STUN', connectedAt: null, localStream: null, remoteStream: null })
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [realtimeReady, setRealtimeReady] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [, setRemoteTrackTick] = useState(0)
  const channelRef = useRef(null)
  const callRef = useRef(call)
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const callErrorTimerRef = useRef(null)
  const iceRecoveryTimerRef = useRef(null)
  const iceRestartInProgressRef = useRef(false)
  const pendingCandidatesRef = useRef([])
  const connectedAtRef = useRef(null)
  const readyRef = useRef(false)
  const signalHandlerRef = useRef(null)
  const callErrorHandlerRef = useRef(null)
  const videoTransceiverRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localVideoRef = useRef(null)
  const [localVideoTrack, setLocalVideoTrack] = useState(null)
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null)
  const partnerId = user.id === couple.partner_1_id ? couple.partner_2_id : couple.partner_1_id
  const partnerDisplayName = user.id === couple.partner_1_id ? couple.partner_2_name : couple.partner_1_name

  function updateCall(nextCall) {
    const updated = typeof nextCall === 'function' ? nextCall(callRef.current) : nextCall
    callRef.current = updated
    setCall(updated)
  }

  function releaseCall(message = '') {
    window.clearTimeout(callErrorTimerRef.current)
    callErrorTimerRef.current = null
    window.clearTimeout(iceRecoveryTimerRef.current)
    iceRecoveryTimerRef.current = null
    iceRestartInProgressRef.current = false
    pendingCandidatesRef.current = []
    connectedAtRef.current = null
    setDurationSeconds(0)
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    videoTransceiverRef.current = null
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    setLocalVideoTrack(null)
    setRemoteVideoTrack(null)
    updateCall({ phase: 'idle', callId: null, callType: 'video', error: message, notice: '', connectedAt: null, localStream: null, remoteStream: null })
  }

  useEffect(() => {
    if (call.phase === 'incoming') {
      startIphoneRingtone()
      stopIphoneRingback()
    } else if (call.phase === 'calling') {
      stopIphoneRingtone()
      startIphoneRingback()
    } else {
      stopIphoneRingtone()
      stopIphoneRingback()
    }
    return () => {
      stopIphoneRingtone()
      stopIphoneRingback()
    }
  }, [call.callId, call.phase])

  function showCallError(error, callId = callRef.current.callId) {
    if (!callId || callRef.current.callId !== callId) return
    const name = error?.name || 'Error'
    const message = error?.message || ''
    let displayMessage
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      displayMessage = 'Izin kamera/mikrofon ditolak. Izinkan akses di pengaturan browser, lalu coba lagi.'
    } else if (name === 'NotReadableError') {
      displayMessage = 'Kamera atau mikrofon sedang dipakai aplikasi/tab lain. Tutup aplikasi tersebut, lalu coba lagi.'
    } else if (name === 'NotFoundError') {
      displayMessage = 'Kamera atau mikrofon tidak ditemukan. Periksa perangkat, lalu coba lagi.'
    } else if (name === 'AbortError') {
      displayMessage = 'Akses kamera/mikrofon terhenti. Periksa perangkat lalu coba lagi.'
    } else if (name === 'OverconstrainedError') {
      displayMessage = 'Kamera tidak mendukung pengaturan yang diminta. Periksa perangkat lalu coba lagi.'
    } else if (name === 'OperationError' || /channel|realtime|sinyal/i.test(message)) {
      displayMessage = 'Gagal terhubung ke server sinyal. Periksa koneksi internet dan Realtime Supabase.'
    } else if (name === 'NetworkError') {
      displayMessage = 'Koneksi jaringan WebRTC gagal setelah mencoba menyambungkan ulang. Periksa jaringan atau server relay.'
    } else {
      displayMessage = message ? `Panggilan gagal (${name}): ${message}` : `Panggilan gagal (${name}). Coba lagi.`
    }

    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    videoTransceiverRef.current = null
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    updateCall(state => state.callId === callId
      ? { ...state, phase: 'error', error: displayMessage, localStream: null, remoteStream: null }
      : state)
    window.clearTimeout(callErrorTimerRef.current)
    callErrorTimerRef.current = window.setTimeout(() => {
      if (callRef.current.callId === callId) releaseCall()
    }, 4000)
  }
  callErrorHandlerRef.current = showCallError

  const sendSignal = useCallback(async (kind, callId, data = null, callType = null) => {
    const channel = channelRef.current
    if (!channel || !readyRef.current) throw new Error('Koneksi panggilan belum siap. Coba lagi sebentar.')
    const status = await channel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        from: user.id,
        callId,
        kind,
        ...(callType ? { callType } : {}),
        data,
        createdAt: Date.now()
      }
    })
    if (status !== 'ok') throw new Error('Sinyal panggilan gagal dikirim. Periksa koneksi lalu coba lagi.')
  }, [user.id])

  function markConnected(callId) {
    if (callRef.current.callId !== callId || connectedAtRef.current) return
    const connectedAt = Date.now()
    connectedAtRef.current = connectedAt
    updateCall(state => state.callId === callId ? { ...state, phase: 'active', connectedAt, error: '' } : state)
  }

  const requestIceServers = useCallback(async () => {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
    const appendIceServers = entries => {
      if (!Array.isArray(entries)) return
      entries.forEach(server => {
        try {
          if (!server || !(typeof server.urls === 'string' || Array.isArray(server.urls))) return
          const urls = (Array.isArray(server.urls) ? server.urls : [server.urls])
            .map(url => String(url).trim())
            .filter(url => {
              const match = url.match(/^(stun|stuns|turn|turns):(.+)$/i)
              if (!match) return false
              const address = match[2].replace(/^\/\//, '').split(/[?#]/)[0]
              const parsed = new URL(`https://${address}`)
              return Boolean(parsed.hostname) && parsed.pathname === '/' && !parsed.username && !parsed.password
            })
          if (!urls.length) return
          if ((server.username != null && typeof server.username !== 'string')
            || (server.credential != null && typeof server.credential !== 'string')) return
          iceServers.push({
            urls,
            ...(server.username ? { username: server.username } : {}),
            ...(server.credential ? { credential: server.credential } : {})
          })
        } catch (error) {
          console.warn('FazaHub ignored an invalid ICE server entry.', error)
        }
      })
    }
    const relayNotice = () => iceServers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      return urls.some(url => /^turns?:/i.test(url))
    }) ? '' : 'Server relay tidak tersedia; mencoba koneksi langsung.'
    const relayMode = () => relayNotice() ? 'STUN' : 'TURN aktif'
    const configuredTurnUrl = String(import.meta.env.VITE_TURN_URL || '').trim()
    if (/^https:\/\//i.test(configuredTurnUrl)) {
      try {
        const apiUrl = new URL(configuredTurnUrl)
        if (apiUrl.protocol !== 'https:') throw new Error('TURN credential endpoint must use HTTPS.')
        const response = await fetch(apiUrl.href)
        if (!response.ok) throw new Error(`TURN API returned HTTP ${response.status}.`)
        const result = await response.json()
        const providedServers = Array.isArray(result) ? result : result.iceServers
        if (!Array.isArray(providedServers)) throw new Error('TURN API response does not contain an iceServers array.')
        appendIceServers(providedServers)
      } catch (error) {
        console.warn('FazaHub configured TURN API unavailable; using remaining ICE servers.', error)
      }
    } else {
      const turnUrls = configuredTurnUrl.split(',').map(url => url.trim()).filter(Boolean)
      const turnUsername = String(import.meta.env.VITE_TURN_USERNAME || '').trim()
      const turnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL || '').trim()
      if (turnUrls.length && turnUsername && turnCredential) appendIceServers([{ urls: turnUrls, username: turnUsername, credential: turnCredential }])
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) return { iceServers, notice: relayNotice(), relayMode: relayMode() }

      const response = await fetch('/api/turn-credentials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) return { iceServers, notice: relayNotice(), relayMode: relayMode() }
      const result = await response.json()
      if (!Array.isArray(result.iceServers) || !result.iceServers.length) {
        return { iceServers, notice: relayNotice(), relayMode: relayMode() }
      }
      appendIceServers(result.iceServers)
      return { iceServers, notice: relayNotice(), relayMode: relayMode() }
    } catch (error) {
      console.warn('FazaHub TURN credentials unavailable; using configured ICE servers.', error)
      return { iceServers, notice: relayNotice(), relayMode: relayMode() }
    }
  }, [])

  async function requestMediaStream(callType = 'video') {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Panggilan memerlukan koneksi HTTPS dan browser yang mendukung mikrofon/kamera.')
    }
    if (callType === 'audio') {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      return { stream, notice: '' }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' }
      })
      stream.getVideoTracks().forEach(track => {
        track.enabled = true
      })
      return { stream, notice: '' }
    } catch (error) {
      if (error?.name !== 'NotReadableError' && error?.name !== 'NotFoundError') throw error
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      return { stream, notice: 'Kamera sibuk atau tidak tersedia, melanjutkan dengan suara.' }
    }
  }

  const makePeerConnection = useCallback((callId, stream, iceServers, callType = 'video') => {
    const peerConnection = new RTCPeerConnection({ iceServers })
    peerConnectionRef.current = peerConnection
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
    if (callType === 'video' && !stream.getVideoTracks().length) {
      peerConnection.addTransceiver('video', { direction: 'sendrecv' })
    }
    videoTransceiverRef.current = peerConnection.getTransceivers()
      .find(transceiver => transceiver.receiver?.track?.kind === 'video') || null

    const restartIce = async () => {
      if (callRef.current.callId !== callId || peerConnectionRef.current !== peerConnection
        || iceRestartInProgressRef.current) return
      iceRestartInProgressRef.current = true
      try {
        peerConnection.restartIce()
        const restartOffer = await peerConnection.createOffer({ iceRestart: true })
        await peerConnection.setLocalDescription(restartOffer)
        await sendSignal('ice-restart-offer', callId, peerConnection.localDescription.toJSON())
        window.clearTimeout(iceRecoveryTimerRef.current)
        iceRecoveryTimerRef.current = window.setTimeout(() => {
          const state = peerConnection.iceConnectionState
          if (peerConnectionRef.current === peerConnection && state !== 'connected' && state !== 'completed') {
            callErrorHandlerRef.current?.(new DOMException(`ICE restart ended in ${state}.`, 'NetworkError'), callId)
          }
        }, 8000)
      } catch (error) {
        callErrorHandlerRef.current?.(error, callId)
      }
    }

    peerConnection.onicecandidate = event => {
      if (!event.candidate) return
      const current = callRef.current
      if (current.callId !== callId) return
      const candidate = event.candidate.toJSON()
      if (!current.signalReady) {
        updateCall(state => ({ ...state, pendingLocalCandidates: [...(state.pendingLocalCandidates || []), candidate] }))
        return
      }
      sendSignal('candidate', callId, candidate).catch(error => {
        callErrorHandlerRef.current?.(error, callId)
      })
    }
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState
      if (state === 'connected' || state === 'completed') {
        markConnected(callId)
        window.clearTimeout(iceRecoveryTimerRef.current)
        iceRecoveryTimerRef.current = null
        iceRestartInProgressRef.current = false
      } else if (state === 'disconnected') {
        if (iceRecoveryTimerRef.current || iceRestartInProgressRef.current) return
        iceRecoveryTimerRef.current = window.setTimeout(() => {
          iceRecoveryTimerRef.current = null
          if (peerConnection.iceConnectionState === 'disconnected') restartIce()
        }, 8000)
      } else if (state === 'failed') {
        window.clearTimeout(iceRecoveryTimerRef.current)
        iceRecoveryTimerRef.current = null
        restartIce()
      }
    }
    peerConnection.ontrack = event => {
      const remoteStream = remoteStreamRef.current || new MediaStream()
      const tracksToAdd = event.streams?.[0]?.getTracks()?.length ? event.streams[0].getTracks() : [event.track]
      tracksToAdd.forEach(track => {
        if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
          remoteStream.addTrack(track)
        }
      })
      if (!remoteStream.getTracks().some(existing => existing.id === event.track.id)) {
        remoteStream.addTrack(event.track)
      }
      remoteStreamRef.current = remoteStream
      const snapshotStream = new MediaStream(remoteStream.getTracks())
      if (event.track.kind === 'video') setRemoteVideoTrack(event.track)
      updateCall(state => state.callId === callId
        ? {
            ...state,
            remoteStream: snapshotStream,
            ...(event.track.kind === 'video' ? { callType: 'video' } : {})
          }
        : state)
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== snapshotStream) {
          remoteVideoRef.current.srcObject = snapshotStream
        }
        remoteVideoRef.current.play().catch(() => {})
      }
      event.track.onunmute = () => {
        setRemoteTrackTick(tick => tick + 1)
        updateCall(state => state.callId === callId
          ? {
              ...state,
              remoteStream: new MediaStream(remoteStream.getTracks()),
              ...(event.track.kind === 'video' ? { callType: 'video' } : {})
            }
          : state)
        remoteVideoRef.current?.play().catch(() => {})
      }
      event.track.onended = () => {
        setRemoteTrackTick(tick => tick + 1)
      }
    }
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        markConnected(callId)
      } else if (peerConnection.connectionState === 'failed'
        && peerConnection.iceConnectionState !== 'failed'
        && peerConnection.iceConnectionState !== 'disconnected'
        && !iceRecoveryTimerRef.current) {
        iceRecoveryTimerRef.current = window.setTimeout(() => {
          iceRecoveryTimerRef.current = null
          if (peerConnection.connectionState === 'failed') restartIce()
        }, 8000)
      }
    }
    return peerConnection
  }, [sendSignal])

  async function flushRemoteCandidates(peerConnection) {
    const candidates = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    const remoteUfrags = peerConnection.remoteDescription?.sdp.match(/^a=ice-ufrag:(.+)$/gm)?.map(line => line.slice('a=ice-ufrag:'.length)) || []
    for (const candidate of candidates) {
      if (candidate.usernameFragment && remoteUfrags.length && !remoteUfrags.includes(candidate.usernameFragment)) continue
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn('FazaHub skipped an ICE candidate that could not be applied.', error)
      }
    }
  }

  async function flushLocalCandidates(callId) {
    const current = callRef.current
    const candidates = current.pendingLocalCandidates || []
    updateCall(state => ({ ...state, signalReady: true, pendingLocalCandidates: [] }))
    for (const candidate of candidates) {
      await sendSignal('candidate', callId, candidate)
    }
  }

  const handleSignal = useCallback(async signal => {
    if (!signal || signal.from === user.id || signal.from !== partnerId
      || typeof signal.callId !== 'string' || typeof signal.kind !== 'string'
      || !Number.isFinite(signal.createdAt) || Date.now() - signal.createdAt > 15_000) return
    const current = callRef.current

    if (signal.kind === 'offer') {
      if (current.phase !== 'idle') {
        await sendSignal('busy', signal.callId)
        return
      }
      pendingCandidatesRef.current = []
      connectedAtRef.current = null
      setDurationSeconds(0)
      const incomingCallType = signal.callType || signal.data?.callType || (signal.data?.sdp?.includes('m=video') ? 'video' : 'audio')
      updateCall({
        phase: 'incoming',
        callId: signal.callId,
        callType: incomingCallType === 'audio' ? 'audio' : 'video',
        offer: { type: signal.data.type, sdp: signal.data.sdp },
        pendingRemoteCandidates: [],
        pendingLocalCandidates: [],
        signalReady: false,
        localStream: null,
        remoteStream: null,
        error: ''
      })
      return
    }
    if (signal.callId !== current.callId) return

    if (signal.kind === 'answer' && current.peerConnection) {
      await current.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: signal.data.type, sdp: signal.data.sdp }))
      await flushRemoteCandidates(current.peerConnection)
      const answerCallType = signal.callType || signal.data?.callType
      updateCall(state => ({
        ...state,
        phase: 'connecting',
        ...(answerCallType === 'video' ? { callType: 'video' } : {})
      }))
    } else if (signal.kind === 'ice-restart-offer' && current.peerConnection) {
      const peerConnection = current.peerConnection
      const offerCollision = peerConnection.signalingState !== 'stable'
      const polite = user.id > partnerId
      if (offerCollision && !polite) return
      if (offerCollision) await peerConnection.setLocalDescription({ type: 'rollback' })
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: signal.data.type, sdp: signal.data.sdp }))
      await flushRemoteCandidates(peerConnection)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      await sendSignal('ice-restart-answer', signal.callId, peerConnection.localDescription.toJSON())
    } else if (signal.kind === 'ice-restart-answer' && current.peerConnection) {
      await current.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: signal.data.type, sdp: signal.data.sdp }))
      await flushRemoteCandidates(current.peerConnection)
      iceRestartInProgressRef.current = false
    } else if (signal.kind === 'candidate' && signal.data) {
      const remoteDescription = current.peerConnection?.remoteDescription
      const remoteUfrags = remoteDescription?.sdp.match(/^a=ice-ufrag:(.+)$/gm)?.map(line => line.slice('a=ice-ufrag:'.length)) || []
      const candidateMatchesRemote = !signal.data.usernameFragment || remoteUfrags.includes(signal.data.usernameFragment)
      if (remoteDescription && candidateMatchesRemote) {
        await current.peerConnection.addIceCandidate(new RTCIceCandidate(signal.data))
      } else {
        pendingCandidatesRef.current.push(signal.data)
      }
    } else if (signal.kind === 'busy') {
      showCallError(new Error(`${partnerDisplayName || 'Pasangan'} sedang menerima panggilan lain.`), signal.callId)
    } else if (signal.kind === 'reject') {
      showCallError(new Error(`${partnerDisplayName || 'Pasangan'} belum bisa menerima panggilan.`), signal.callId)
    } else if (signal.kind === 'hangup') {
      showCallError(new Error('Pasangan mengakhiri panggilan.'), signal.callId)
    }
  }, [partnerDisplayName, partnerId, sendSignal, user.id])

  signalHandlerRef.current = signal => handleSignal(signal)

  useEffect(() => {
    let active = true
    const channel = supabase.channel(`couple:${couple.id}:calls`, { config: { private: true } })
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        signalHandlerRef.current?.(payload).catch(error => {
          if (!active) return
          if (callRef.current.phase !== 'idle') callErrorHandlerRef.current?.(error)
          else setConnectionError(error.message || 'Sinyal panggilan gagal diproses.')
        })
      })
      .subscribe(status => {
        if (!active) return
        const connected = status === 'SUBSCRIBED'
        readyRef.current = connected
        setRealtimeReady(connected)
        if (connected) setConnectionError('')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const error = new Error('Gagal terhubung ke server sinyal Supabase. Periksa koneksi Realtime dan kebijakan SQL.')
          if (callRef.current.phase !== 'idle') callErrorHandlerRef.current?.(error)
          else setConnectionError(error.message)
        }
      })
    channelRef.current = channel

    return () => {
      active = false
      readyRef.current = false
      channelRef.current = null
      window.clearTimeout(callErrorTimerRef.current)
      window.clearTimeout(iceRecoveryTimerRef.current)
      iceRecoveryTimerRef.current = null
      iceRestartInProgressRef.current = false
      pendingCandidatesRef.current = []
      connectedAtRef.current = null
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
      videoTransceiverRef.current = null
      localStreamRef.current?.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
      supabase.removeChannel(channel)
    }
  }, [couple.id])

  useEffect(() => {
    if (remoteVideoRef.current) {
      const stream = call.remoteStream || remoteStreamRef.current || null
      if (remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream
      }
      if (stream) remoteVideoRef.current.play().catch(() => {})
    }
    if (localVideoRef.current) {
      const stream = call.localStream || localStreamRef.current || null
      if (localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream
      }
      if (stream) localVideoRef.current.play().catch(() => {})
    }
    if (remoteAudioRef.current) {
      const stream = call.remoteStream || remoteStreamRef.current || null
      if (remoteAudioRef.current.srcObject !== stream) {
        remoteAudioRef.current.srcObject = stream
      }
      if (stream) remoteAudioRef.current.play().catch(() => {})
    }
  }, [call.localStream, call.remoteStream, call.videoDisabled, call.phase, call.callType, localVideoTrack, remoteVideoTrack])

  useEffect(() => {
    if (!call.connectedAt) return undefined
    const updateDuration = () => setDurationSeconds(Math.floor((Date.now() - call.connectedAt) / 1000))
    updateDuration()
    const timerId = window.setInterval(updateDuration, 1000)
    return () => window.clearInterval(timerId)
  }, [call.connectedAt])

  async function startCall(requestedType = 'video') {
    if (!partnerId || callRef.current.phase !== 'idle') return
    const callType = requestedType === 'audio' ? 'audio' : 'video'
    setConnectionError('')
    const callId = crypto.randomUUID()
    pendingCandidatesRef.current = []
    connectedAtRef.current = null
    setDurationSeconds(0)
    updateCall({ phase: 'preparing', callId, callType, pendingRemoteCandidates: [], pendingLocalCandidates: [], signalReady: false, connectedAt: null, error: '' })
    try {
      const { iceServers, notice: iceNotice, relayMode } = await requestIceServers()
      if (callRef.current.callId !== callId || callRef.current.phase === 'error') return
      const { stream: localStream, notice: mediaNotice } = await requestMediaStream(callType)
      if (callRef.current.callId !== callId || callRef.current.phase === 'error') {
        localStream.getTracks().forEach(track => track.stop())
        return
      }
      localStreamRef.current = localStream
      setLocalVideoTrack(localStream.getVideoTracks()[0] || null)
      const peerConnection = makePeerConnection(callId, localStream, iceServers, callType)
      updateCall(state => ({
        ...state,
        peerConnection,
        localStream,
        callType,
        videoDisabled: localStream.getVideoTracks().length === 0,
        notice: [iceNotice, mediaNotice].filter(Boolean).join(' '),
        relayMode
      }))
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      await sendSignal('offer', callId, { ...peerConnection.localDescription.toJSON(), callType }, callType)
      await flushLocalCandidates(callId)
      updateCall(state => ({ ...state, phase: 'calling' }))
    } catch (error) {
      showCallError(error, callId)
    }
  }

  async function acceptCall() {
    const current = callRef.current
    if (current.phase !== 'incoming') return
    const callId = current.callId
    const callType = current.callType || 'video'
    connectedAtRef.current = null
    setDurationSeconds(0)
    updateCall(state => ({ ...state, phase: 'preparing', connectedAt: null, error: '' }))
    try {
      const { iceServers, notice: iceNotice, relayMode } = await requestIceServers()
      if (callRef.current.callId !== callId || callRef.current.phase === 'error') return
      const { stream: localStream, notice: mediaNotice } = await requestMediaStream(callType)
      if (callRef.current.callId !== callId || callRef.current.phase === 'error') {
        localStream.getTracks().forEach(track => track.stop())
        return
      }
      localStreamRef.current = localStream
      setLocalVideoTrack(localStream.getVideoTracks()[0] || null)
      const peerConnection = makePeerConnection(callId, localStream, iceServers, callType)
      updateCall(state => ({
        ...state,
        peerConnection,
        localStream,
        callType,
        videoDisabled: localStream.getVideoTracks().length === 0,
        notice: [iceNotice, mediaNotice].filter(Boolean).join(' '),
        relayMode
      }))
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: current.offer.type, sdp: current.offer.sdp }))
      await flushRemoteCandidates(peerConnection)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      await sendSignal('answer', callId, { ...peerConnection.localDescription.toJSON(), callType }, callType)
      await flushLocalCandidates(callId)
      updateCall(state => ({ ...state, phase: 'connecting' }))
    } catch (error) {
      showCallError(error, callId)
    }
  }

  async function endCall(kind = 'hangup') {
    const current = callRef.current
    if (current.callId && (current.phase === 'incoming' || peerConnectionRef.current)) {
      try { await sendSignal(kind, current.callId) } catch (error) { setConnectionError(error.message) }
    }
    releaseCall()
  }

  async function toggleVideo() {
    const stream = localStreamRef.current
    const callId = callRef.current.callId
    const videoTracks = stream?.getVideoTracks() || []
    if (videoTracks.length) {
      const enable = !videoTracks.some(track => track.enabled)
      videoTracks.forEach(track => { track.enabled = enable })
      setLocalVideoTrack(videoTracks[0] || null)
      updateCall(state => ({ ...state, videoDisabled: !enable, error: '' }))
      return
    }

    let cameraTrack
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser ini tidak mendukung akses kamera.')
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' }
      })
      cameraTrack = cameraStream.getVideoTracks()[0]
      if (cameraTrack) cameraTrack.enabled = true
      const transceiver = videoTransceiverRef.current
      if (!cameraTrack || !transceiver || callRef.current.callId !== callId || localStreamRef.current !== stream) {
        cameraStream.getTracks().forEach(track => track.stop())
        throw new Error('Kamera belum dapat ditambahkan ke panggilan. Akhiri lalu mulai ulang panggilan.')
      }

      await transceiver.sender.replaceTrack(cameraTrack)
      if (callRef.current.callId !== callId || localStreamRef.current !== stream) {
        await transceiver.sender.replaceTrack(null)
        cameraTrack.stop()
        return
      }
      localStreamRef.current.addTrack(cameraTrack)
      const refreshedLocalStream = new MediaStream(localStreamRef.current.getTracks())
      localStreamRef.current = refreshedLocalStream
      setLocalVideoTrack(cameraTrack)
      cameraTrack.onended = () => {
        setLocalVideoTrack(null)
        updateCall(state => state.callId === callId
          ? { ...state, videoDisabled: true, notice: 'Kamera terputus. Panggilan suara tetap aktif.' }
          : state)
      }
      updateCall(state => ({ ...state, localStream: refreshedLocalStream, callType: 'video', videoDisabled: false, error: '', notice: '' }))
    } catch (error) {
      cameraTrack?.stop()
      const name = error?.name || 'Error'
      const message = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
        ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.'
        : error?.name === 'NotReadableError'
          ? 'Kamera sedang dipakai aplikasi/tab lain. Tutup aplikasi tersebut, lalu coba lagi.'
          : error?.name === 'NotFoundError'
            ? 'Kamera tidak ditemukan. Periksa perangkat, lalu coba lagi.'
            : error?.message || `Kamera gagal diaktifkan (${name}).`
      updateCall(state => ({ ...state, error: message }))
    }
  }

  function toggleTrack(type) {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = type === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks()
    if (!tracks.length) return
    const enabled = tracks.some(track => !track.enabled)
    tracks.forEach(track => { track.enabled = enabled })
    updateCall(state => ({ ...state, [type === 'audio' ? 'muted' : 'videoDisabled']: !enabled }))
  }

  return {
    call,
    durationSeconds,
    realtimeReady,
    connectionError,
    partnerId,
    partnerDisplayName,
    localVideoTrack,
    remoteVideoTrack,
    remoteVideoRef,
    remoteAudioRef,
    localVideoRef,
    startCall,
    acceptCall,
    endCall,
    toggleVideo,
    toggleTrack
  }
}

function VideoCallOverlay({ callCtrl }) {
  const {
    call,
    durationSeconds,
    partnerDisplayName,
    remoteVideoRef,
    remoteAudioRef,
    localVideoRef,
    acceptCall,
    endCall,
    toggleVideo,
    toggleTrack
  } = callCtrl

  if (call.phase === 'idle') return null

  const isIncoming = call.phase === 'incoming'
  const isError = call.phase === 'error'
  const hasRemoteVideo = (call.remoteStream?.getVideoTracks().length || 0) > 0
  const isVideoScreen = call.callType === 'video' || hasRemoteVideo
  const localCamActive = Boolean(
    call.localStream?.getVideoTracks().some(track => track.enabled && track.readyState === 'live') && !call.videoDisabled
  )
  const remoteVideoActive = Boolean(
    call.remoteStream?.getVideoTracks().some(track => track.readyState === 'live')
  )
  const partnerInitial = (partnerDisplayName || 'P').slice(0, 1).toUpperCase()
  const callStatus = call.phase === 'preparing' ? (isVideoScreen ? 'Menyiapkan kamera dan koneksi...' : 'Menyiapkan mikrofon dan koneksi...')
    : call.phase === 'calling' ? `Memanggil ${partnerDisplayName || 'pasangan'}...`
      : call.phase === 'active' ? `Terhubung · ${String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:${String(durationSeconds % 60).padStart(2, '0')}`
        : isError ? 'Panggilan berhenti'
          : isIncoming ? `${partnerDisplayName || 'Pasangan'} menelepon...`
            : 'Menghubungkan panggilan...'

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white" role="dialog" aria-modal="true" aria-label={isVideoScreen ? 'Panggilan video' : 'Panggilan suara'}>
      {isError ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div role="alert" className="max-w-sm">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-950 text-rose-300"><PhoneOff size={26} /></div>
            <p className="mt-4 text-base font-semibold leading-6 text-rose-100">{call.error}</p>
            <p className="mt-2 text-xs text-zinc-400">Menutup panggilan sebentar lagi...</p>
          </div>
        </div>
      ) : isIncoming ? (
        <div className="flex flex-1 flex-col items-center justify-between px-6 pb-12 pt-[max(3rem,env(safe-area-inset-top))]">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-zinc-200">
              {call.callType === 'video' ? <Video size={13} /> : <Phone size={13} />}
              {call.callType === 'video' ? 'Panggilan video masuk' : 'Panggilan suara masuk'}
            </span>
          </div>
          <div className="text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-zinc-900 text-3xl font-extrabold text-rose-300 shadow-2xl">
              {partnerInitial}
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">{partnerDisplayName || 'Pasangan'}</h2>
            <p className="mt-1.5 text-sm text-zinc-400">dari {partnerDisplayName || 'pasanganmu'}</p>
          </div>
          <div className="safe-bottom flex items-center justify-center gap-10">
            <button type="button" onClick={() => endCall('reject')} aria-label="Tolak panggilan" className="grid h-16 w-16 place-items-center rounded-full bg-rose-600 text-white shadow-xl transition active:scale-95"><PhoneOff size={24} /></button>
            <button type="button" onClick={acceptCall} aria-label="Terima panggilan" className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-xl transition active:scale-95"><Phone size={24} /></button>
          </div>
        </div>
      ) : isVideoScreen ? (
        <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden bg-black">
          <div className="absolute inset-0 w-full h-full">
            <video
              ref={(el) => {
                remoteVideoRef.current = el
                const stream = call.remoteStream
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream
                  el.play().catch(() => {})
                }
              }}
              autoPlay
              playsInline
              webkit-playsinline="true"
              className="w-full h-full object-cover"
            />
          </div>

          {!remoteVideoActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
              <div className="rounded-2xl border border-white/15 bg-black/55 px-4 py-3 text-center">
                <Video size={22} className="mx-auto mb-1.5 text-zinc-300" />
                <p className="text-xs font-semibold text-zinc-200">Menunggu kamera pasangan...</p>
              </div>
            </div>
          )}

          <header className="pointer-events-none relative z-20 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0 rounded-2xl bg-black/45 px-3 py-2 backdrop-blur-sm">
              <p className="truncate text-sm font-bold drop-shadow">{partnerDisplayName || 'Pasangan'}</p>
              <p aria-live="polite" className="mt-0.5 text-xs text-zinc-200 drop-shadow">{callStatus}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${localCamActive ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                Cam: {localCamActive ? 'Aktif' : 'Mati'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${remoteVideoActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                Video Pasangan: {remoteVideoActive ? 'Aktif' : 'Menunggu'}
              </span>
              <span className="rounded-full border border-white/10 bg-black/45 px-2 py-0.5 font-mono text-[9px] text-zinc-300">
                {call.relayMode || 'STUN'}
              </span>
            </div>
          </header>

          <div className="absolute right-4 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-20 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl bg-zinc-900">
            {call.localStream && !call.videoDisabled && call.localStream.getVideoTracks().length > 0 ? (
              <video
                ref={(el) => {
                  localVideoRef.current = el
                  const stream = call.localStream
                  if (el && stream && el.srcObject !== stream) {
                    el.srcObject = stream
                    el.play().catch(() => {})
                  }
                }}
                autoPlay
                playsInline
                webkit-playsinline="true"
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-zinc-400">
                <VideoOff size={20} />
              </div>
            )}
          </div>

          {(call.error || call.notice) && (
            <div className="pointer-events-none absolute inset-x-4 bottom-24 z-20 flex justify-center">
              <p role={call.error ? 'alert' : 'status'} className="rounded-xl bg-black/65 px-3 py-2 text-center text-xs text-zinc-100 backdrop-blur-sm">
                {call.error || call.notice}
              </p>
            </div>
          )}

          <footer className="safe-bottom absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 px-4 pb-6 pt-3">
            <button type="button" onClick={() => toggleTrack('audio')} disabled={!call.localStream?.getAudioTracks().length} aria-label={call.muted ? 'Aktifkan mikrofon' : 'Matikan mikrofon'} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-zinc-900/80 text-white backdrop-blur-md disabled:opacity-40">{call.muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
            <button type="button" onClick={toggleVideo} disabled={!call.localStream || isError} aria-label={call.videoDisabled || !call.localStream?.getVideoTracks().length ? 'Aktifkan kamera' : 'Matikan kamera'} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-zinc-900/80 text-white backdrop-blur-md disabled:opacity-40">{call.videoDisabled || !call.localStream?.getVideoTracks().length ? <VideoOff size={20} /> : <Video size={20} />}</button>
            <button type="button" onClick={() => endCall()} aria-label="Akhiri panggilan" className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-xl"><PhoneOff size={22} /></button>
          </footer>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-between px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
          <audio
            ref={(el) => {
              remoteAudioRef.current = el
              const stream = call.remoteStream
              if (el && stream && el.srcObject !== stream) {
                el.srcObject = stream
                el.play().catch(() => {})
              }
            }}
            autoPlay
            playsInline
            className="hidden"
          />
          <header className="text-center">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[10px] text-zinc-300">
              Suara · {call.relayMode || 'STUN'}
            </span>
          </header>
          <div className="text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-zinc-900 text-3xl font-extrabold text-rose-300 shadow-2xl">
              {partnerInitial}
            </div>
            <h2 className="mt-5 text-2xl font-extrabold">{partnerDisplayName || 'Pasangan'}</h2>
            <p aria-live="polite" className="mt-2 text-sm text-zinc-400">{callStatus}</p>
            {(call.error || call.notice) && <p className="mt-3 text-xs text-rose-300">{call.error || call.notice}</p>}
          </div>
          <footer className="safe-bottom flex items-center justify-center gap-4">
            <button type="button" onClick={() => toggleTrack('audio')} disabled={!call.localStream?.getAudioTracks().length} aria-label={call.muted ? 'Aktifkan mikrofon' : 'Matikan mikrofon'} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-zinc-900 text-white disabled:opacity-40">{call.muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
            <button type="button" onClick={() => endCall()} aria-label="Akhiri panggilan" className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-xl"><PhoneOff size={22} /></button>
          </footer>
        </div>
      )}
    </div>
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
        .select('id,couple_id,user_id,body,image_url,audio_url,audio_duration,created_at')
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

  const handleNewMessage = useCallback(payload => {
    const message = payload.new
    if (!message) return
    if (message.user_id !== user.id) {
      playIphoneMessageTone()
    }
    if (message.user_id !== user.id && !(document.visibilityState === 'visible' && routeRef.current.tab === 'chat')) {
      const senderName = message.user_id === couple.partner_1_id ? couple.partner_1_name : couple.partner_2_name || 'Pasangan'
      showIncomingMessageNotification(user.id, couple.id, senderName).catch(notificationError => {
        console.error('FazaHub message notification failed:', notificationError)
      })
    }
    loadMessages()
  }, [couple.id, couple.partner_1_id, couple.partner_1_name, couple.partner_2_name, loadMessages, user.id])

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

  async function sendMessage(body, imageUrl = null, audioUrl = null, audioDuration = null) {
    const { data, error: insertError } = await supabase.from('couple_messages')
      .insert({
        couple_id: couple.id,
        user_id: user.id,
        body,
        image_url: imageUrl,
        audio_url: audioUrl,
        audio_duration: audioDuration
      })
      .select('id,couple_id,user_id,body,image_url,audio_url,audio_duration,created_at')
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'couple_messages', filter: `couple_id=eq.${couple.id}` }, handleNewMessage)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [couple.id, handleNewMessage, loadComments, loadMessages, loadSnaps])

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
  const callCtrl = useVideoCall({ user, couple })
  useEffect(() => {
    if (callCtrl.call.phase === 'incoming') pauseActiveVoiceMessage()
  }, [callCtrl.call.phase])
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const baselineHeightRef = useRef(typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return undefined
    const handleResize = () => {
      const currentHeight = vv.height
      if (currentHeight > baselineHeightRef.current) {
        baselineHeightRef.current = currentHeight
      }
      setKeyboardOpen(baselineHeightRef.current - currentHeight > 140)
    }
    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  const commentsBySnap = useMemo(() => comments.reduce((grouped, comment) => {
    grouped[comment.snap_id] = [...(grouped[comment.snap_id] || []), comment]
    return grouped
  }, {}), [comments])
  const selectedSnaps = route.date ? snaps.filter(snap => snap.snap_date === route.date) : []
  const isChatTab = route.tab === 'chat'
  const callDisabled = !callCtrl.partnerId || !callCtrl.realtimeReady || callCtrl.call.phase !== 'idle'
  const idleCallError = callCtrl.call.phase === 'idle' ? (callCtrl.connectionError || callCtrl.call.error) : ''

  return (
    <div className={`bg-cream ${isChatTab ? 'h-[100dvh] overflow-hidden sm:h-auto sm:min-h-screen sm:py-6' : 'min-h-screen sm:py-6'}`}>
      <div className={`relative mx-auto flex max-w-md flex-col bg-cream sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-line sm:shadow-xl ${isChatTab ? 'h-full sm:h-[calc(100vh-3rem)]' : 'min-h-screen sm:min-h-[calc(100vh-3rem)]'}`}>
        {!isChatTab && (
          <header className="sticky top-0 z-20 border-b border-line/80 bg-cream/90 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => pushRoute({ tab: 'feed' })} aria-label="FazaHub, ke Beranda"><Brand compact /></button>
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-bold">{couple.partner_1_name}{couple.partner_2_name ? ` & ${couple.partner_2_name}` : ''}</p>
                <p className="mt-1 text-[10px] text-taupe">{couple.partner_2_id ? `${todaySnaps.length} momen hari ini` : 'Menunggu pasangan bergabung'}</p>
              </div>
              <button
                type="button"
                onClick={() => callCtrl.startCall('video')}
                disabled={callDisabled}
                aria-label="Mulai panggilan video"
                title={callCtrl.partnerId ? (callCtrl.realtimeReady ? 'Panggilan video' : 'Menghubungkan panggilan...') : 'Pasangan belum bergabung'}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-terracotta disabled:opacity-40"
              >
                <Video size={18} />
              </button>
            </div>
          </header>
        )}
        {idleCallError && (
          <p role="alert" className="absolute right-4 top-16 z-40 max-w-[calc(100vw-2rem)] rounded-xl bg-[#FFF1ED] px-3 py-2 text-xs text-[#A54D37] shadow-md">
            {idleCallError}
          </p>
        )}
        <main className={isChatTab ? `flex min-h-0 flex-1 flex-col ${keyboardOpen ? 'pb-0' : 'pb-[5rem]'}` : 'flex-1 px-5 pb-28 pt-6'}>
          {error && <div role="alert" className={`rounded-2xl bg-[#FFF1ED] px-4 py-3 text-xs leading-5 text-[#A54D37] ${isChatTab ? 'mx-4 mt-2' : 'mb-4'}`}>{error}</div>}
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
          {isChatTab && <ChatView
            messages={messages}
            user={user}
            partnerName={partnerName}
            partnerDisplayName={callCtrl.partnerDisplayName}
            partnerId={callCtrl.partnerId}
            realtimeReady={callCtrl.realtimeReady}
            callDisabled={callDisabled}
            onStartVoiceCall={() => callCtrl.startCall('audio')}
            onStartVideoCall={() => callCtrl.startCall('video')}
            onBack={() => pushRoute({ tab: 'feed' })}
            loading={messagesLoading}
            onSend={sendMessage}
            keyboardOpen={keyboardOpen}
          />}
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
        {!(isChatTab && keyboardOpen) && (
          <nav aria-label="Navigasi utama" className="safe-bottom fixed bottom-3 left-4 right-4 z-30 mx-auto max-w-sm rounded-2xl border border-white/10 bg-zinc-900/80 px-5 pt-2 shadow-2xl backdrop-blur-xl sm:absolute">
            <div className="flex items-center justify-around">
              {tabs.map(item => {
                const Icon = item.icon
                const active = route.tab === item.id
                return <button key={item.id} onClick={() => pushRoute({ tab: item.id })} aria-current={active ? 'page' : undefined} className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${active ? 'text-terracotta' : 'text-[#A1A1AA]'}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} fill={active && item.id === 'feed' ? 'currentColor' : 'none'} /><span className={`text-[10px] ${active ? 'font-extrabold' : 'font-semibold'}`}>{item.label}</span></button>
              })}
            </div>
          </nav>
        )}
      </div>
      <VideoCallOverlay callCtrl={callCtrl} />
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
