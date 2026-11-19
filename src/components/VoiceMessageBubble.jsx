import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

let activeVoiceAudio = null

export function pauseActiveVoiceMessage() {
  if (!activeVoiceAudio) return
  activeVoiceAudio.pause()
  activeVoiceAudio = null
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`
}

export default function VoiceMessageBubble({ audioUrl, audioDuration = 0 }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(audioDuration)
  const [playbackError, setPlaybackError] = useState('')
  const waveform = useRef(Array.from({ length: 28 }, (_, index) => 4 + ((index * 17 + 11) % 17)))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const handleEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
      if (activeVoiceAudio === audio) activeVoiceAudio = null
    }
    const handlePause = () => {
      setPlaying(false)
      if (activeVoiceAudio === audio) activeVoiceAudio = null
    }
    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    return () => {
      audio.pause()
      if (activeVoiceAudio === audio) activeVoiceAudio = null
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
    }
  }, [audioUrl])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    setPlaybackError('')
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (activeVoiceAudio && activeVoiceAudio !== audio) activeVoiceAudio.pause()
    activeVoiceAudio = audio
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      if (activeVoiceAudio === audio) activeVoiceAudio = null
      setPlaybackError('Audio belum dapat diputar. Periksa koneksi lalu coba lagi.')
    }
  }

  function seek(event) {
    const audio = audioRef.current
    const nextTime = Number(event.currentTarget.value)
    if (!audio || !Number.isFinite(nextTime)) return
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  return (
    <div className="flex min-w-52 max-w-64 items-center gap-2">
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? 'Jeda pesan suara' : 'Putar pesan suara'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/10 transition hover:bg-black/15"
      >
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative h-7">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-[2px]" aria-hidden="true">
            {waveform.current.map((height, index) => (
              <span
                key={index}
                className={`w-[3px] rounded-full ${index / waveform.current.length <= progress ? 'bg-current opacity-90' : 'bg-current opacity-35'}`}
                style={{ height }}
              />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(duration, 0.1)}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            onChange={seek}
            aria-label="Posisi pesan suara"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="flex justify-between text-[10px] leading-3 opacity-75">
          <span>{formatDuration(playing ? currentTime : duration)}</span>
          {playbackError && <span role="alert">{playbackError}</span>}
        </div>
      </div>
    </div>
  )
}
