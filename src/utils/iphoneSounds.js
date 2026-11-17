let audioContext = null
let unlockListenersInstalled = false
let activeSound = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextConstructor) return null
  if (!audioContext) audioContext = new AudioContextConstructor()
  return audioContext
}

function unlockAudio() {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') context.resume().catch(() => {})
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  unlockListenersInstalled = false
}

if (typeof window !== 'undefined' && !unlockListenersInstalled) {
  unlockListenersInstalled = true
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
}

function tone(context, frequency, startAt, duration, type, volume = 0.08) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.03)
  const owner = activeSound
  owner?.nodes.add(oscillator)
  oscillator.addEventListener('ended', () => owner?.nodes.delete(oscillator), { once: true })
}

function playMarimbaPhrase(context, offset = 0) {
  const now = context.currentTime + offset
  const phrase = [
    { time: 0, frequency: 659.25 },
    { time: 0.18, frequency: 783.99 },
    { time: 0.36, frequency: 987.77 },
    { time: 0.62, frequency: 783.99 },
    { time: 0.82, frequency: 659.25 }
  ]
  phrase.forEach(note => {
    tone(context, note.frequency, now + note.time, 0.52, 'triangle', 0.055)
    tone(context, note.frequency * 2, now + note.time, 0.34, 'sine', 0.018)
  })
}

function playRingbackPhrase(context, offset = 0) {
  const now = context.currentTime + offset
  ;[523.25, 659.25].forEach(frequency => {
    tone(context, frequency, now, 0.9, 'sine', 0.035)
    tone(context, frequency * 1.5, now, 0.72, 'triangle', 0.012)
  })
}

function startLoop(kind, playPhrase, vibrate = false) {
  stopIphoneRingtone()
  stopIphoneRingback()
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') context.resume().catch(() => {})
  const sound = { kind, timer: null, vibrationTimer: null, nodes: new Set() }
  activeSound = sound
  const play = () => {
    if (activeSound !== sound) return
    playPhrase(context)
    if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([400, 200, 400])
    }
  }
  play()
  sound.timer = window.setInterval(play, kind === 'ringtone' ? 3500 : 4000)
  if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    sound.vibrationTimer = window.setInterval(() => navigator.vibrate([400, 200, 400]), 3500)
  }
}

function stopSound(kind) {
  const sound = activeSound
  if (!sound || sound.kind !== kind) return
  window.clearInterval(sound.timer)
  window.clearInterval(sound.vibrationTimer)
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0)
  sound.nodes.forEach(node => {
    try { node.stop() } catch {}
  })
  sound.nodes.clear()
  activeSound = null
}

export function startIphoneRingtone() {
  startLoop('ringtone', playMarimbaPhrase, true)
}

export function stopIphoneRingtone() {
  stopSound('ringtone')
}

export function startIphoneRingback() {
  startLoop('ringback', playRingbackPhrase)
}

export function stopIphoneRingback() {
  stopSound('ringback')
}

export function playIphoneMessageTone() {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') context.resume().catch(() => {})
  const now = context.currentTime
  ;[932.33, 1244.51, 1661.22].forEach((frequency, index) => {
    const startAt = now + index * 0.14
    tone(context, frequency, startAt, 0.42, 'sine', 0.055)
    tone(context, frequency * 2, startAt, 0.28, 'triangle', 0.012)
  })
}

export async function playIphoneTestSounds() {
  startIphoneRingtone()
  await new Promise(resolve => window.setTimeout(resolve, 3600))
  stopIphoneRingtone()
  playIphoneMessageTone()
}
