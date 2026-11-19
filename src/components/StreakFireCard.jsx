import { Flame, Snowflake } from 'lucide-react'

export default function StreakFireCard({ couple, user, today, fallbackStreak }) {
  const count = Number.isInteger(couple.streak_count) ? couple.streak_count : fallbackStreak
  const isPartner1 = user.id === couple.partner_1_id
  const myActiveDate = isPartner1 ? couple.user1_active_date : couple.user2_active_date
  const partnerActiveDate = isPartner1 ? couple.user2_active_date : couple.user1_active_date
  const myName = isPartner1 ? couple.partner_1_name : couple.partner_2_name
  const partnerName = isPartner1 ? couple.partner_2_name : couple.partner_1_name
  const mineActive = myActiveDate === today
  const partnerActive = partnerActiveDate === today
  const freezeCount = Number.isInteger(couple.streak_freeze_count) ? couple.streak_freeze_count : 2

  return (
    <section className="streak-fire-card mb-5 overflow-hidden rounded-[1.75rem] border border-rose-500/20 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.14em] text-rose-500">
            <Flame size={12} fill="currentColor" /> Streak api
          </span>
          <p className="mt-2 text-xs font-semibold text-taupe">Konsisten bareng setiap hari</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-300" title="Streak freeze tersisa">
          <Snowflake size={12} /> {freezeCount} freeze
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-mono text-4xl font-extrabold leading-none tracking-tight text-charcoal">
          {count}<span className="ml-1.5 text-sm font-bold text-taupe">hari</span>
        </p>
        <div className="flex -space-x-2">
          {[{ name: myName || 'Kamu', active: mineActive }, { name: partnerName || 'Pasangan', active: partnerActive }].map((person, index) => (
            <span
              key={`${person.name}-${index}`}
              title={`${person.name}: ${person.active ? 'aktif hari ini' : 'belum aktif hari ini'}`}
              className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-extrabold dark:border-zinc-900 ${person.active ? 'bg-rose-500 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300'}`}
            >
              {person.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-taupe">
        {mineActive && partnerActive ? 'Kalian berdua sudah menjaga api hari ini. 🔥' : mineActive ? 'Kamu sudah aktif, tunggu pasangan menambah momennya.' : 'Simpan satu daily snap hari ini untuk menjaga api kalian.'}
      </p>
    </section>
  )
}
