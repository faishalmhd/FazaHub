const SAMPLE_RATE = 44100
const TARGET_PEAK = 0.95

const MARIMBA_PHRASE = [
  { t: 0.0, f: 659.25, d: 0.36 },
  { t: 0.16, f: 783.99, d: 0.34 },
  { t: 0.32, f: 987.77, d: 0.38 },
  { t: 0.5, f: 1318.51, d: 0.48 },
  { t: 0.72, f: 987.77, d: 0.32 },
  { t: 0.9, f: 783.99, d: 0.36 },
  { t: 1.14, f: 659.25, d: 0.34 },
  { t: 1.3, f: 880.0, d: 0.36 },
  { t: 1.46, f: 1174.66, d: 0.44 },
  { t: 1.66, f: 987.77, d: 0.42 },
  { t: 1.88, f: 783.99, d: 0.56 }
]

const TRITONE_PHRASE = [
  { t: 0.0, f: 932.33, d: 0.44 },   // A#5
  { t: 0.13, f: 1244.51, d: 0.46 }, // D#6
  { t: 0.26, f: 1661.22, d: 0.78 }  // G#6
]

const cachedUrls = {
  ringtone: null,
  ringback: null,
  tritone: null
}

let activeLoops = {
  ringtone: null,
  ringback: null
}
let activeMessageAudio = null
let unlockRegistered = false
let offlineUpgradeStarted = false

function triangleWave(phase) {
  const frac = phase - Math.floor(phase)
  return 1 - 4 * Math.abs(frac - 0.5)
}

function softCompress(samples, threshold = 0.65, ratio = 4) {
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i]
    const abs = Math.abs(x)
    if (abs <= threshold) {
      out[i] = x
    } else {
      const excess = abs - threshold
      const compressed = threshold + excess / ratio
      out[i] = Math.sign(x) * compressed
    }
  }
  return out
}

function encodeWav16Bit(samples, sampleRate = SAMPLE_RATE, targetPeak = TARGET_PEAK) {
  let maxAbs = 0
  for (let i = 0; i < samples.length; i += 1) {
    const abs = Math.abs(samples[i])
    if (abs > maxAbs) maxAbs = abs
  }
  const scale = maxAbs > 0 ? targetPeak / maxAbs : 1

  const dataByteLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataByteLength)
  const view = new DataView(buffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataByteLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataByteLength, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = Math.max(-1, Math.min(1, samples[i] * scale))
    const int16 = normalized < 0 ? Math.round(normalized * 32768) : Math.round(normalized * 32767)
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

function synthesizeMarimbaSamples(durationSec = 2.85) {
  const totalSamples = Math.ceil(durationSec * SAMPLE_RATE)
  const buffer = new Float32Array(totalSamples)

  for (const note of MARIMBA_PHRASE) {
    const startIdx = Math.floor(note.t * SAMPLE_RATE)
    const noteSamples = Math.floor(note.d * SAMPLE_RATE)
    const attackSamples = Math.max(1, Math.floor(0.004 * SAMPLE_RATE))

    for (let i = 0; i < noteSamples; i += 1) {
      const idx = startIdx + i
      if (idx >= totalSamples) break
      const t = i / SAMPLE_RATE
      const attack = i < attackSamples ? i / attackSamples : 1
      const env1 = attack * Math.exp(-t * 7.5)
      const env2 = attack * Math.exp(-t * 14.0)
      const env4 = attack * Math.exp(-t * 42.0)

      const fundamental = 0.65 * Math.sin(2 * Math.PI * note.f * t) + 0.35 * triangleWave(note.f * t)
      const harmonic2 = Math.sin(2 * Math.PI * (note.f * 2) * t)
      const harmonic4 = Math.sin(2 * Math.PI * (note.f * 4) * t)

      buffer[idx] += fundamental * 0.72 * env1 + harmonic2 * 0.3 * env2 + harmonic4 * 0.18 * env4
    }
  }

  return softCompress(buffer, 0.72, 4)
}

function synthesizeTritoneSamples(durationSec = 1.1) {
  const totalSamples = Math.ceil(durationSec * SAMPLE_RATE)
  const buffer = new Float32Array(totalSamples)

  for (const note of TRITONE_PHRASE) {
    const startIdx = Math.floor(note.t * SAMPLE_RATE)
    const noteSamples = Math.floor(note.d * SAMPLE_RATE)
    const attackSamples = Math.max(1, Math.floor(0.003 * SAMPLE_RATE))

    for (let i = 0; i < noteSamples; i += 1) {
      const idx = startIdx + i
      if (idx >= totalSamples) break
      const t = i / SAMPLE_RATE
      const attack = i < attackSamples ? i / attackSamples : 1
      const env1 = attack * Math.exp(-t * 6.2)
      const env2 = attack * Math.exp(-t * 12.0)
      const env3 = attack * Math.exp(-t * 28.0)

      const f1 = Math.sin(2 * Math.PI * note.f * t)
      const f2 = Math.sin(2 * Math.PI * (note.f * 2) * t)
      const f3 = Math.sin(2 * Math.PI * (note.f * 3) * t)
      const chime = Math.sin(2 * Math.PI * (note.f * 2.756) * t)

      buffer[idx] += f1 * 0.78 * env1 + f2 * 0.28 * env2 + (f3 * 0.12 + chime * 0.08) * env3
    }
  }

  return softCompress(buffer, 0.7, 4)
}

function synthesizeRingbackSamples(durationSec = 3.0) {
  const totalSamples = Math.ceil(durationSec * SAMPLE_RATE)
  const buffer = new Float32Array(totalSamples)
  const toneDuration = 0.95
  const toneSamples = Math.floor(toneDuration * SAMPLE_RATE)
  const fadeSamples = Math.floor(0.025 * SAMPLE_RATE)

  for (let i = 0; i < toneSamples; i += 1) {
    const t = i / SAMPLE_RATE
    let env = 1
    if (i < fadeSamples) env = i / fadeSamples
    else if (i > toneSamples - fadeSamples) env = (toneSamples - i) / fadeSamples

    const sig =
      Math.sin(2 * Math.PI * 523.25 * t) * 0.5 +
      Math.sin(2 * Math.PI * 659.25 * t) * 0.45 +
      triangleWave(783.99 * t) * 0.12
    buffer[i] = sig * env
  }

  return softCompress(buffer, 0.75, 3)
}

async function renderOfflineWithCompressor(durationSec, scheduleFn) {
  if (typeof window === 'undefined') return null
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!OfflineCtx) return null

  const ctx = new OfflineCtx(1, Math.ceil(durationSec * SAMPLE_RATE), SAMPLE_RATE)
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.setValueAtTime(-14, 0)
  compressor.knee.setValueAtTime(12, 0)
  compressor.ratio.setValueAtTime(4, 0)
  compressor.attack.setValueAtTime(0.002, 0)
  compressor.release.setValueAtTime(0.14, 0)
  compressor.connect(ctx.destination)

  scheduleFn(ctx, compressor)
  const rendered = await ctx.startRendering()
  return encodeWav16Bit(rendered.getChannelData(0), rendered.sampleRate, TARGET_PEAK)
}

function scheduleOfflineNote(ctx, destination, frequency, startAt, duration, type, gainPeak) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

function upgradeSoundsWithOfflineCompressor() {
  if (offlineUpgradeStarted || typeof window === 'undefined') return
  offlineUpgradeStarted = true

  renderOfflineWithCompressor(2.85, (ctx, compressor) => {
    MARIMBA_PHRASE.forEach(note => {
      scheduleOfflineNote(ctx, compressor, note.f, note.t, note.d, 'triangle', 0.65)
      scheduleOfflineNote(ctx, compressor, note.f, note.t, note.d, 'sine', 0.55)
      scheduleOfflineNote(ctx, compressor, note.f * 2, note.t, note.d * 0.6, 'sine', 0.28)
      scheduleOfflineNote(ctx, compressor, note.f * 4, note.t, Math.min(0.1, note.d * 0.25), 'sine', 0.16)
    })
  })
    .then(url => {
      if (url && !activeLoops.ringtone) {
        if (cachedUrls.ringtone) URL.revokeObjectURL(cachedUrls.ringtone)
        cachedUrls.ringtone = url
      }
    })
    .catch(() => {})

  renderOfflineWithCompressor(1.1, (ctx, compressor) => {
    TRITONE_PHRASE.forEach(note => {
      scheduleOfflineNote(ctx, compressor, note.f, note.t, note.d, 'sine', 0.8)
      scheduleOfflineNote(ctx, compressor, note.f * 2, note.t, note.d * 0.65, 'sine', 0.28)
      scheduleOfflineNote(ctx, compressor, note.f * 2.756, note.t, 0.12, 'sine', 0.12)
    })
  })
    .then(url => {
      if (url && !activeMessageAudio) {
        if (cachedUrls.tritone) URL.revokeObjectURL(cachedUrls.tritone)
        cachedUrls.tritone = url
      }
    })
    .catch(() => {})

  renderOfflineWithCompressor(3.0, (ctx, compressor) => {
    scheduleOfflineNote(ctx, compressor, 523.25, 0, 0.95, 'sine', 0.48)
    scheduleOfflineNote(ctx, compressor, 659.25, 0, 0.95, 'sine', 0.44)
    scheduleOfflineNote(ctx, compressor, 783.99, 0, 0.85, 'triangle', 0.12)
  })
    .then(url => {
      if (url && !activeLoops.ringback) {
        if (cachedUrls.ringback) URL.revokeObjectURL(cachedUrls.ringback)
        cachedUrls.ringback = url
      }
    })
    .catch(() => {})
}

function getSoundUrl(kind) {
  if (typeof window === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return null
  if (cachedUrls[kind]) return cachedUrls[kind]

  if (kind === 'ringtone') {
    cachedUrls.ringtone = encodeWav16Bit(synthesizeMarimbaSamples())
  } else if (kind === 'tritone') {
    cachedUrls.tritone = encodeWav16Bit(synthesizeTritoneSamples())
  } else if (kind === 'ringback') {
    cachedUrls.ringback = encodeWav16Bit(synthesizeRingbackSamples())
  }
  upgradeSoundsWithOfflineCompressor()
  return cachedUrls[kind]
}

function primeSoundBuffers() {
  getSoundUrl('ringtone')
  getSoundUrl('tritone')
  getSoundUrl('ringback')
}

function onFirstUserGesture() {
  primeSoundBuffers()
  ;['ringtone', 'ringback'].forEach(kind => {
    const active = activeLoops[kind]
    if (active && active.audio.paused) {
      active.audio.play().catch(() => {})
    }
  })
  window.removeEventListener('pointerdown', onFirstUserGesture)
  window.removeEventListener('keydown', onFirstUserGesture)
  unlockRegistered = false
}

if (typeof window !== 'undefined') {
  primeSoundBuffers()
  if (!unlockRegistered) {
    unlockRegistered = true
    window.addEventListener('pointerdown', onFirstUserGesture, { once: true, passive: true })
    window.addEventListener('keydown', onFirstUserGesture, { once: true })
  }
}

function createAudioElement(url, { loop = false, volume = 1.0 } = {}) {
  const audio = new Audio(url)
  audio.preload = 'auto'
  audio.loop = loop
  audio.volume = volume
  audio.playsInline = true
  return audio
}

function startLoopingAudio(kind, { volume = 1.0, vibrate = false } = {}) {
  stopIphoneRingtone()
  stopIphoneRingback()

  const url = getSoundUrl(kind)
  if (!url) return

  const audio = createAudioElement(url, { loop: true, volume })
  const state = { audio, vibrationTimer: null }
  activeLoops[kind] = state

  const triggerVibration = () => {
    if (activeLoops[kind] !== state) return
    if (vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([500, 250, 500])
      } catch {
        // Ignore vibration permission errors on restricted devices.
      }
    }
  }

  triggerVibration()
  if (vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    state.vibrationTimer = window.setInterval(triggerVibration, 1750)
  }

  const playPromise = audio.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {
      if (!unlockRegistered && typeof window !== 'undefined') {
        unlockRegistered = true
        window.addEventListener('pointerdown', onFirstUserGesture, { once: true, passive: true })
        window.addEventListener('keydown', onFirstUserGesture, { once: true })
      }
    })
  }
}

function stopLoopingAudio(kind) {
  const state = activeLoops[kind]
  if (!state) return
  activeLoops[kind] = null

  if (state.vibrationTimer) {
    window.clearInterval(state.vibrationTimer)
    state.vibrationTimer = null
  }
  if (kind === 'ringtone' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(0)
    } catch {
      // Ignore vibration errors.
    }
  }

  try {
    state.audio.pause()
    state.audio.currentTime = 0
  } catch {
    // Ignore audio element cleanup errors.
  }
}

export function startIphoneRingtone() {
  startLoopingAudio('ringtone', { volume: 1.0, vibrate: true })
}

export function stopIphoneRingtone() {
  stopLoopingAudio('ringtone')
}

export function startIphoneRingback() {
  startLoopingAudio('ringback', { volume: 0.85, vibrate: false })
}

export function stopIphoneRingback() {
  stopLoopingAudio('ringback')
}

export function playIphoneMessageTone() {
  const url = getSoundUrl('tritone')
  if (!url) return

  if (activeMessageAudio) {
    try {
      activeMessageAudio.pause()
      activeMessageAudio.currentTime = 0
    } catch {
      // Ignore previous playback cleanup errors.
    }
  }

  const audio = createAudioElement(url, { loop: false, volume: 1.0 })
  activeMessageAudio = audio
  audio.addEventListener('ended', () => {
    if (activeMessageAudio === audio) activeMessageAudio = null
  }, { once: true })

  const playPromise = audio.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {})
  }
}

export async function playIphoneTestSounds() {
  const ringtoneUrl = getSoundUrl('ringtone')
  const tritoneUrl = getSoundUrl('tritone')
  if (!ringtoneUrl || !tritoneUrl) {
    throw new Error('Perangkat tidak mendukung pemutaran audio HTML5.')
  }

  // Prime message audio within the click gesture so mobile Safari allows delayed playback.
  const prewarmedMessageAudio = createAudioElement(tritoneUrl, { loop: false, volume: 1.0 })
  prewarmedMessageAudio.load()

  startIphoneRingtone()
  await new Promise(resolve => window.setTimeout(resolve, 2900))
  stopIphoneRingtone()
  await new Promise(resolve => window.setTimeout(resolve, 250))

  activeMessageAudio = prewarmedMessageAudio
  prewarmedMessageAudio.volume = 1.0
  prewarmedMessageAudio.currentTime = 0
  prewarmedMessageAudio.addEventListener('ended', () => {
    if (activeMessageAudio === prewarmedMessageAudio) activeMessageAudio = null
  }, { once: true })

  await prewarmedMessageAudio.play().catch(() => {
    playIphoneMessageTone()
  })
}
