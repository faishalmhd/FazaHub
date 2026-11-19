import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Send, Trash2 } from 'lucide-react'

const MAX_RECORDING_SECONDS = 120
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop())
}

export default function VoiceRecorderBar({ disabled, onSendAudio, children }) {
  const [recording, setRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pendingAudio, setPendingAudio] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const startTimeRef = useRef(0)
  const timerRef = useRef(null)
  const actionRef = useRef('keep')
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)
  const sendAudioRef = useRef(onSendAudio)

  sendAudioRef.current = onSendAudio

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      window.clearInterval(timerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      stopTracks(streamRef.current)
      recorderRef.current = null
      streamRef.current = null
    }
  }, [])

  function releaseMicrophone() {
    window.clearInterval(timerRef.current)
    timerRef.current = null
    stopTracks(streamRef.current)
    streamRef.current = null
  }

  async function sendPendingAudio(audio) {
    if (!audio || sending || disabled) return
    setSending(true)
    setError('')
    try {
      await sendAudioRef.current(audio.blob, audio.duration)
      if (mountedRef.current) setPendingAudio(null)
    } catch (sendError) {
      if (mountedRef.current) setError(sendError.message || 'Pesan suara gagal dikirim. Coba lagi.')
    } finally {
      if (mountedRef.current) setSending(false)
    }
  }

  function stopRecording(action = 'keep') {
    actionRef.current = action
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    releaseMicrophone()
    if (action === 'discard' && mountedRef.current) {
      setPendingAudio(null)
      setRecording(false)
    }
  }

  async function startRecording() {
    if (disabled || recording || sending) return
    setError('')
    setElapsedSeconds(0)
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Browser ini tidak mendukung perekaman suara.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        stopTracks(stream)
        return
      }

      streamRef.current = stream
      const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported?.(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      actionRef.current = 'keep'

      recorder.addEventListener('dataavailable', event => {
        if (event.data?.size) chunksRef.current.push(event.data)
      })
      recorder.addEventListener('error', event => {
        actionRef.current = 'discard'
        chunksRef.current = []
        releaseMicrophone()
        recorderRef.current = null
        if (mountedRef.current) {
          setRecording(false)
          setError(event.error?.message || 'Perekaman suara terhenti. Coba lagi.')
        }
      }, { once: true })
      recorder.addEventListener('stop', () => {
        const action = actionRef.current
        const duration = Math.max(1, Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startTimeRef.current) / 1000)))
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/mp4' })
        chunksRef.current = []
        recorderRef.current = null
        releaseMicrophone()
        if (!mountedRef.current) return

        setRecording(false)
        if (action === 'discard') {
          setPendingAudio(null)
          setError('')
          return
        }
        if (!blob.size) {
          setPendingAudio(null)
          setError('Rekaman suara kosong. Coba rekam lagi.')
          return
        }
        const audio = { blob, duration }
        setPendingAudio(audio)
        if (action === 'send') sendPendingAudio(audio)
      }, { once: true })

      startTimeRef.current = Date.now()
      recorder.start(250)
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        const seconds = Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - startTimeRef.current) / 1000))
        setElapsedSeconds(seconds)
        if (seconds >= MAX_RECORDING_SECONDS) stopRecording('keep')
      }, 250)
    } catch (recordError) {
      releaseMicrophone()
      recorderRef.current = null
      if (mountedRef.current) {
        setRecording(false)
        setError(recordError.message || 'Mikrofon tidak dapat diakses.')
      }
    }
  }

  function cancelRecording() {
    requestIdRef.current += 1
    if (recording) {
      stopRecording('discard')
    } else {
      setPendingAudio(null)
      setElapsedSeconds(0)
      setError('')
    }
  }

  function sendRecording() {
    if (recording) {
      stopRecording('send')
    } else if (pendingAudio) {
      sendPendingAudio(pendingAudio)
    }
  }

  return children({
    recording,
    elapsedSeconds,
    pendingAudio,
    sending,
    error,
    startRecording,
    cancelRecording,
    sendRecording,
    formatDuration
  })
}
