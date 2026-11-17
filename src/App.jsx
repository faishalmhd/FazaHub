import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, BellOff, CalendarDays, Camera, Check, ChevronLeft, ChevronRight,
  Download, Heart, ImagePlus, LogOut, Plus, Settings, Sparkles, Upload, X
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { exportJournal } from './lib/exportJournal'
import { decodeVapidPublicKey, getPushRegistration } from './lib/webPush'

const moods = [
  { label: 'Bahagia', emoji: '😊' },
  { label: 'Tenang', emoji: '😌' },
  { label: 'Rindu', emoji: '🥺' },
  { label: 'Semangat', emoji: '✨' },
  { label: 'Lelah', emoji: '😴' },
  { label: 'Bersyukur', emoji: '🙏' }
]

const dateLabel = (value, options = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('id-ID', options).format(new Date(`${value}T12:00:00`))

const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function optimizedImage(url, thumbnail = false) {
  if (!url?.includes('/upload/')) return url
  return url.replace('/upload/', thumbnail
    ? '/upload/w_300,c_fill,f_auto,q_auto/'
    : '/upload/w_1080,f_auto,q_auto/')
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
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } })
    setBusy(false)
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Cek email kamu untuk mengonfirmasi akun, lalu masuk.')
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
        <div className="font-['Manrope'] text-[1.35rem] font-extrabold tracking-[-.06em]">Faza<span className="text-terracotta">Hub</span></div>
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
  const [createdCode, setCreatedCode] = useState('')

  async function createCouple(event) {
    event.preventDefault()
    setBusy(true); setError('')
    const inviteCode = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('')
    const { data, error: createError } = await supabase.from('couples').insert({
      invite_code: inviteCode, partner_1_id: user.id, partner_1_name: name.trim()
    }).select().single()
    setBusy(false)
    if (createError) setError(createError.message)
    else { setCreatedCode(data.invite_code); onComplete(data) }
  }

  async function joinCouple(event) {
    event.preventDefault()
    setBusy(true); setError('')
    const { data, error: joinError } = await supabase.rpc('join_couple', {
      p_invite_code: code.trim().toUpperCase(), p_partner_name: name.trim()
    })
    setBusy(false)
    if (joinError) setError(joinError.message)
    else {
      const { data: couple, error: fetchError } = await supabase.from('couples').select('*').eq('id', data).single()
      if (fetchError) setError(fetchError.message)
      else onComplete(couple)
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
          {createdCode && <div className="mt-4 rounded-2xl bg-cream p-4 text-center text-sm">Kode undangan: <strong className="ml-1 tracking-[.15em] text-terracotta">{createdCode}</strong></div>}
          <button onClick={onSignOut} className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-taupe hover:text-charcoal"><LogOut size={14} /> Keluar</button>
        </div>
      </section>
    </main>
  )
}

function SnapCard({ snap, partnerName }) {
  const mood = moods.find(item => item.label === snap.mood)
  const author = partnerName(snap.user_id)
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-soft animate-rise-in">
      <img src={optimizedImage(snap.image_url)} alt={snap.note || `Kenangan ${dateLabel(snap.snap_date)}`} className="aspect-[4/4.5] w-full bg-cream object-cover" loading="lazy" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold">{author} <span className="font-medium text-taupe">berbagi momen</span></div>
            <div className="mt-1 text-xs text-taupe">{dateLabel(snap.snap_date)} · {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(snap.created_at))}</div>
          </div>
          {mood && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-taupe"><span>{mood.emoji}</span>{mood.label}</span>}
        </div>
        {snap.note && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-charcoal">{snap.note}</p>}
      </div>
    </article>
  )
}

function FeedView({ snaps, partnerName, onAdd, loading }) {
  const grouped = useMemo(() => snaps.reduce((groups, snap) => {
    groups[snap.snap_date] = [...(groups[snap.snap_date] || []), snap]
    return groups
  }, {}), [snaps])

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-end justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.17em] text-terracotta">Jurnal kalian</p><h1 className="mt-1 text-2xl font-extrabold">Momen terbaru</h1></div>
        <Button onClick={onAdd} className="h-11 w-11 rounded-2xl bg-terracotta text-white shadow-[0_8px_20px_rgba(224,122,95,.25)]" aria-label="Tambah foto"><Plus size={22} /></Button>
      </div>
      {loading ? <Loading /> : snaps.length === 0 ? <EmptyState onAdd={onAdd} /> : (
        <div className="space-y-7">
          {Object.entries(grouped).map(([date, entries]) => (
            <section key={date}>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-taupe"><span className="h-px flex-1 bg-line" /><span>{dateLabel(date)}</span><span className="h-px flex-1 bg-line" /></div>
              <div className="space-y-4">{entries.map(snap => <SnapCard key={snap.id} snap={snap} partnerName={partnerName} />)}</div>
            </section>
          ))}
        </div>
      )}
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
  const weekdayNames = ['S', 'S', 'R', 'K', 'J', 'S', 'M']
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
                {entries[0] && <><span className="absolute inset-0 bg-black/20" /><span className="absolute inset-0 grid place-items-center text-xs font-bold text-white">{day}</span>{entries.length > 1 && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-white ring-1 ring-black/10" />}</>}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-taupe">Ketuk tanggal dengan foto untuk membuka kenangannya ✨</p>
    </div>
  )
}

function SettingsView({ couple, user, partnerName, snaps, onSignOut }) {
  const [copied, setCopied] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderLoading, setReminderLoading] = useState(true)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderError, setReminderError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 })
  const [exportError, setExportError] = useState('')
  const isPartner1 = couple.partner_1_id === user.id
  const myName = isPartner1 ? couple.partner_1_name : couple.partner_2_name
  const otherName = isPartner1 ? couple.partner_2_name : couple.partner_1_name
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

  useEffect(() => {
    let active = true
    async function checkSubscription() {
      try {
        if (!vapidPublicKey) return
        const registration = await getPushRegistration()
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) return
        const { data, error } = await supabase.from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle()
        if (error) throw error
        if (active) setReminderEnabled(Boolean(data))
      } catch (error) {
        if (active) setReminderError(error.message || 'Status pengingat gagal diperiksa.')
      } finally {
        if (active) setReminderLoading(false)
      }
    }
    checkSubscription()
    return () => { active = false }
  }, [user.id, vapidPublicKey])

  async function toggleReminder() {
    setReminderBusy(true)
    setReminderError('')
    setReminderMessage('')
    try {
      if (!vapidPublicKey) throw new Error('Push belum dikonfigurasi. Tambahkan VITE_VAPID_PUBLIC_KEY dan deploy fungsi pengingat Supabase.')
      const registration = await getPushRegistration()
      let subscription = await registration.pushManager.getSubscription()

      if (reminderEnabled) {
        const endpoint = subscription?.endpoint
        let unsubscribeError
        if (subscription) {
          try {
            await subscription.unsubscribe()
          } catch (error) {
            unsubscribeError = error
          }
        }
        if (endpoint) {
          const { error } = await supabase.from('push_subscriptions').delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint)
          if (error) throw error
        }
        setReminderEnabled(false)
        if (unsubscribeError) throw new Error('Pengingat dinonaktifkan di server, tetapi browser belum menghapus langganannya. Coba aktifkan lalu nonaktifkan lagi.')
        setReminderMessage('Pengingat harian dinonaktifkan.')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan. Aktifkan notifikasi FazaHub di pengaturan browser.')
      let createdSubscription = false
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(vapidPublicKey)
        })
        createdSubscription = true
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        couple_id: couple.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
        timezone,
        reminder_time: '20:00:00',
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' })
      if (error) {
        if (createdSubscription) await subscription.unsubscribe()
        throw error
      }
      setReminderEnabled(true)
      setReminderMessage('Pengingat aktif setiap hari pukul 20.00 waktu lokal, kecuali jika salah satu dari kalian sudah menyimpan foto hari itu.')
    } catch (error) {
      setReminderError(error.message || 'Pengaturan pengingat gagal. Coba lagi.')
    } finally {
      setReminderBusy(false)
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
  return (
    <div className="animate-rise-in pb-6">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-terracotta">Pengaturan</p>
      <h1 className="mt-1 text-2xl font-extrabold">Ruang kalian</h1>
      <div className="mt-5 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><Heart fill="currentColor" size={21} /></div>
          <div><p className="text-sm font-extrabold">{myName} & {otherName || 'pasanganmu'}</p><p className="mt-1 text-xs text-taupe">{otherName ? 'Ruang kalian sudah berdua 🤍' : 'Menunggu pasangan bergabung'}</p></div>
        </div>
        {!otherName && <div className="mt-5 rounded-2xl bg-cream p-4">
          <p className="text-xs font-semibold text-taupe">Bagikan kode ini ke pasanganmu</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xl font-extrabold tracking-[.2em] text-terracotta">{couple.invite_code}</span>
            <Button onClick={copyCode} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-charcoal shadow-sm">{copied ? <Check size={14} /> : <Upload size={14} />}{copied ? 'Tersalin' : 'Salin kode'}</Button>
          </div>
        </div>}
      </div>
      <div className="mt-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-taupe">Akun</p>
        <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm font-semibold">Email</span><span className="truncate text-sm text-taupe">{user.email}</span></div>
      </div>
      <div className="mt-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0EC] text-terracotta"><Bell size={19} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Pengingat harian</p>
            <p className="mt-1 text-xs leading-5 text-taupe">Pukul 20.00 waktu lokal. Kami mengingatkan hanya jika belum ada foto hari ini.</p>
          </div>
        </div>
        <Button onClick={toggleReminder} disabled={reminderBusy || reminderLoading} className={`mt-4 w-full px-4 py-3 text-sm ${reminderEnabled ? 'border border-line bg-white text-charcoal' : 'bg-terracotta text-white'}`}>
          {reminderBusy || reminderLoading ? 'Memeriksa...' : reminderEnabled ? <><BellOff size={16} /> Matikan pengingat</> : <><Bell size={16} /> Aktifkan pengingat</>}
        </Button>
        {!vapidPublicKey && <p className="mt-3 text-xs leading-5 text-taupe">Pengingat push perlu VAPID key dan Edge Function Supabase. Lihat langkah konfigurasi di README.</p>}
        {reminderMessage && <p role="status" className="mt-3 text-xs leading-5 text-[#47785A]">{reminderMessage}</p>}
        {reminderError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{reminderError}</p>}
      </div>
      <div className="mt-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-taupe"><Download size={19} /></div>
          <div><p className="text-sm font-extrabold">Ekspor jurnal</p><p className="mt-1 text-xs leading-5 text-taupe">Unduh foto teroptimasi beserta catatan dan mood dalam satu file ZIP.</p></div>
        </div>
        <Button onClick={downloadJournal} disabled={exportBusy || !snaps.length} className="mt-4 w-full bg-cream px-4 py-3 text-sm text-charcoal">
          <Download size={16} />{exportBusy ? `Menyiapkan ${exportProgress.done}/${exportProgress.total} foto...` : `Unduh ZIP${snaps.length ? ` · ${snaps.length} foto` : ''}`}
        </Button>
        {exportError && <p role="alert" className="mt-3 text-xs leading-5 text-[#A54D37]">{exportError}</p>}
      </div>
      <Button onClick={onSignOut} className="mt-5 w-full border border-[#F2DAD3] bg-white px-5 py-3.5 text-sm text-[#B6533C] hover:bg-[#FFF6F3]"><LogOut size={17} /> Keluar dari akun</Button>
      <p className="mt-7 text-center text-xs text-taupe">FazaHub dibuat untuk dua orang. <Heart className="mx-1 inline text-terracotta" size={12} fill="currentColor" /></p>
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
  const [error, setError] = useState('')
  const inputRef = useRef(null)
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
    if (selected.size > 15 * 1024 * 1024) { setFile(null); setError('Ukuran foto maksimal 15 MB.'); return }
    setError('')
    setFile(selected)
  }

  async function submit(event) {
    event.preventDefault()
    if (!file) { setError('Pilih foto yang ingin disimpan.'); return }
    if (!mood) { setError('Pilih mood untuk momen ini.'); return }
    if (!cloudName || !uploadPreset) { setError('Cloudinary belum dikonfigurasi. Isi cloud name dan unsigned upload preset di .env.'); return }
    setBusy(true); setError('')
    let uploadedImageUrl
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('upload_preset', uploadPreset)
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body })
      const uploaded = await response.json()
      if (!response.ok) throw new Error(uploaded.error?.message || 'Foto gagal diunggah ke Cloudinary.')
      if (!uploaded.secure_url) throw new Error('Cloudinary tidak mengembalikan alamat foto yang aman.')
      uploadedImageUrl = uploaded.secure_url
      const { error: saveError } = await supabase.from('daily_snaps').insert({
        couple_id: coupleId, user_id: userId, snap_date: date, image_url: uploadedImageUrl, mood, note: note.trim() || null
      })
      if (saveError) {
        throw new Error(`Foto sudah terunggah, tetapi catatannya gagal disimpan: ${saveError.message}. Periksa feed sebelum mencoba unggah ulang.`)
      }
      onSaved()
    } catch (uploadError) {
      setError(uploadError.message || 'Momen belum berhasil disimpan. Coba lagi ya.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#211d19]/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <section className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-terracotta">Satu momen kecil</p><h2 className="mt-1 text-xl font-extrabold">Tambah kenangan</h2></div>
          <Button aria-label="Tutup" onClick={onClose} disabled={busy} className="h-10 w-10 rounded-xl bg-white text-taupe"><X size={19} /></Button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input ref={inputRef} type="file" accept="image/*" onChange={chooseFile} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} className={`relative flex w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-dashed ${preview ? 'border-transparent' : 'border-[#E6D9D0] bg-white'} ${preview ? 'aspect-[4/3]' : 'h-40'}`}>
            {preview ? <><img src={preview} alt="Pratinjau foto" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute bottom-3 right-3 rounded-xl bg-black/55 px-3 py-2 text-xs font-bold text-white">Ganti foto</span></> : <span className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-terracotta"><ImagePlus size={22} /></span><span className="mt-3 block text-sm font-bold">Pilih foto dari galeri atau kamera</span><span className="mt-1 block text-xs text-taupe">JPG, PNG, HEIC · maksimal 15 MB</span></span>}
          </button>
          <div>
            <p className="mb-2 text-xs font-bold">Mood hari ini</p>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {moods.map(item => <button type="button" key={item.label} onClick={() => setMood(item.label)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${mood === item.label ? 'border-terracotta bg-[#FFF0EC] text-[#A54D37]' : 'border-line bg-white text-taupe'}`}><span>{item.emoji}</span>{item.label}</button>)}
            </div>
          </div>
          <Field label="Tanggal momen" type="date" value={date} onChange={setDate} required />
          <label className="block"><span className="mb-2 block text-xs font-bold">Catatan kecil <span className="font-medium text-taupe">(opsional)</span></span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={200} rows={3} placeholder="Apa yang ingin kamu ingat dari hari ini?" className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-[#B5AFA6] focus:border-terracotta focus:ring-4 focus:ring-[#E07A5F]/10" /><span className="mt-1 block text-right text-[10px] text-taupe">{note.length}/200</span></label>
          {error && <p role="alert" className="rounded-xl bg-[#FFF1ED] px-4 py-3 text-xs leading-5 text-[#A54D37]">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full bg-terracotta px-5 py-3.5 text-sm text-white hover:bg-[#cf6b52]">{busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" /> Menyimpan momen...</> : <><Sparkles size={17} /> Simpan kenangan</>}</Button>
        </form>
      </section>
    </div>
  )
}

function AppShell({ user, couple, onSignOut }) {
  const [tab, setTab] = useState('feed')
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const isPartner1 = couple.partner_1_id === user.id
  const partnerName = userId => userId === couple.partner_1_id ? couple.partner_1_name : (couple.partner_2_name || 'Pasangan')

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

  useEffect(() => {
    loadSnaps()
    const channel = supabase.channel(`couple-snaps-${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_snaps', filter: `couple_id=eq.${couple.id}` }, loadSnaps)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [couple.id, loadSnaps])

  const filteredSnaps = selectedDate ? snaps.filter(snap => snap.snap_date === selectedDate) : snaps
  const tabs = [
    { id: 'feed', label: 'Beranda', icon: Heart },
    { id: 'calendar', label: 'Kalender', icon: CalendarDays },
    { id: 'settings', label: 'Ruang kita', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-cream sm:py-6">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-cream sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-line sm:shadow-xl">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-cream/90 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Brand compact />
            <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#86B89B]" /><span className="text-[10px] font-bold text-taupe">{couple.partner_2_id ? 'Kalian berdua' : 'Menunggu berdua'}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 px-5 pb-28 pt-6">
          {error && <div role="alert" className="mb-4 rounded-2xl bg-[#FFF1ED] px-4 py-3 text-xs leading-5 text-[#A54D37]">{error}</div>}
          {tab === 'feed' && <FeedView snaps={snaps} partnerName={partnerName} onAdd={() => setModalOpen(true)} loading={loading} />}
          {tab === 'calendar' && (selectedDate
            ? <div>
              <button onClick={() => setSelectedDate('')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-taupe"><ArrowLeft size={16} /> Kembali ke kalender</button>
              <p className="text-xs font-bold uppercase tracking-[.17em] text-terracotta">Kenangan tanggal</p>
              <h1 className="mb-5 mt-1 text-2xl font-extrabold">{dateLabel(selectedDate)}</h1>
              <div className="space-y-4">{filteredSnaps.map(snap => <SnapCard key={snap.id} snap={snap} partnerName={partnerName} />)}</div>
            </div>
            : <CalendarView snaps={snaps} onSelectDate={setSelectedDate} />)}
          {tab === 'settings' && <SettingsView couple={couple} user={user} partnerName={partnerName} snaps={snaps} onSignOut={onSignOut} />}
        </main>
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-white/70 bg-white/85 px-7 pt-2 shadow-[0_-8px_30px_rgba(45,42,38,.06)] backdrop-blur-xl sm:absolute">
          <div className="flex items-center justify-around">
            {tabs.map(item => {
              const Icon = item.icon
              const active = tab === item.id
              return <button key={item.id} onClick={() => { setTab(item.id); setSelectedDate('') }} className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${active ? 'text-terracotta' : 'text-[#A49D93]'}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} fill={active && item.id === 'feed' ? 'currentColor' : 'none'} /><span className={`text-[10px] ${active ? 'font-extrabold' : 'font-semibold'}`}>{item.label}</span></button>
            })}
          </div>
        </nav>
      </div>
      {modalOpen && <AddSnapModal userId={user.id} coupleId={couple.id} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); setTab('feed'); setSelectedDate(''); loadSnaps() }} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [couple, setCouple] = useState(null)
  const [checking, setChecking] = useState(true)
  const [coupleLoading, setCoupleLoading] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecking(false); return undefined }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCouple(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    async function loadCouple() {
      if (!session?.user) { setCouple(null); setCoupleLoading(false); return }
      setCoupleLoading(true)
      const { data, error } = await supabase.from('couples').select('*')
        .or(`partner_1_id.eq.${session.user.id},partner_2_id.eq.${session.user.id}`)
        .maybeSingle()
      if (!active) return
      if (error) console.error('Failed to load couple:', error.message)
      setCouple(data || null)
      setCoupleLoading(false)
    }
    loadCouple()
    return () => { active = false }
  }, [session?.user?.id])

  if (!isSupabaseConfigured) return <SetupNotice />
  if (checking) return <main className="grid min-h-screen place-items-center bg-cream"><Loading /></main>
  if (!session) return <AuthScreen />
  if (coupleLoading) return <main className="grid min-h-screen place-items-center bg-cream"><Loading /></main>
  if (!couple) return <CoupleSetup user={session.user} onComplete={setCouple} onSignOut={() => supabase.auth.signOut()} />
  return <AppShell user={session.user} couple={couple} onSignOut={() => supabase.auth.signOut()} />
}
