
import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2
} from 'lucide-react'
import type { ChatMessage } from '../Chat/ChatWindow'
import type { VoiceLanguage } from '../Chat/MessageInput'

interface VoiceModeProps {
  messages: ChatMessage[]
  onSend: (message: string) => void | Promise<void>
  isLoading: boolean
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read audio recording.'))
        return
      }

      const commaIndex = reader.result.indexOf(',')

      if (commaIndex === -1) {
        reject(new Error('Invalid audio recording.'))
        return
      }

      resolve(reader.result.slice(commaIndex + 1))
    }

    reader.onerror = () => reject(new Error('Failed to process audio.'))
    reader.readAsDataURL(blob)
  })
}

function VoiceMode({
  messages,
  onSend,
  isLoading
}: VoiceModeProps): React.JSX.Element {
  const [isActive, setIsActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceLanguage, setVoiceLanguage] =
    useState<VoiceLanguage>('en-US')
  const [error, setError] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const activeRef = useRef(false)
  const onSendRef = useRef(onSend)
  const lastSpokenMessageId = useRef<number | null>(
    messages[messages.length - 1]?.role === 'assistant'
      ? messages[messages.length - 1].id
      : null
  )

  onSendRef.current = onSend

  const releaseMicrophone = (): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setIsListening(false)
  }

  const startRecording = async (): Promise<void> => {
    if (!activeRef.current || recorderRef.current) return

    setError('')

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('Microphone recording is not supported.')
      return
    }

    let stream: MediaStream | undefined

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })

      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ]

      const selectedType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      )

      const recorder = selectedType
        ? new MediaRecorder(stream, { mimeType: selectedType })
        : new MediaRecorder(stream)

      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        setError('Recording failed. Please try again.')
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        })

        releaseMicrophone()

        if (!activeRef.current) return

        if (audioBlob.size === 0) {
          setError('No audio was recorded.')
          return
        }

        setIsTranscribing(true)

        try {
          const audioBase64 = await blobToBase64(audioBlob)
          const mimeType = audioBlob.type.split(';')[0] || 'audio/webm'

          const result = await window.jarvis.transcribeAudio(
            audioBase64,
            mimeType,
            voiceLanguage
          )

          if (!result.ok || !result.transcript?.trim()) {
            throw new Error(
              result.error || 'Could not recognize your speech.'
            )
          }

          if (!activeRef.current) return

          await onSendRef.current(result.transcript.trim())
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Voice processing failed.'
          )
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsListening(true)
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop())

      recorderRef.current = null
      streamRef.current = null
      setIsListening(false)

      setError(
        err instanceof Error
          ? `Microphone error: ${err.message}`
          : 'Could not access microphone.'
      )
    }
  }

  const stopRecording = (): void => {
    const recorder = recorderRef.current

    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }

  const startConversation = (): void => {
    if (activeRef.current) return

    if (!('speechSynthesis' in window)) {
      setError('Speech output is not supported in this app runtime.')
      return
    }

    activeRef.current = true
    setIsActive(true)
    setError('')

    void startRecording()
  }

  const stopConversation = (): void => {
    activeRef.current = false
    setIsActive(false)
    setIsSpeaking(false)

    window.speechSynthesis?.cancel()

    const recorder = recorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      releaseMicrophone()
    }
  }

  // Speak new Gemini replies and restart listening after playback.
  useEffect(() => {
    if (!isActive || isLoading || isTranscribing) return

    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'assistant') return

    if (lastSpokenMessageId.current === lastMessage.id) return

    lastSpokenMessageId.current = lastMessage.id

    window.speechSynthesis.cancel()

   const utterance = new SpeechSynthesisUtterance(lastMessage.content)

utterance.lang = voiceLanguage === 'en-US' ? 'en-US' : 'ur-PK'
utterance.rate = 0.92
utterance.pitch = 1.15
utterance.volume = 1

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)

      if (activeRef.current) {
        void startRecording()
      }
    }

    utterance.onerror = () => {
      setIsSpeaking(false)

      if (activeRef.current) {
        void startRecording()
      }
    }

    window.speechSynthesis.speak(utterance)
  }, [messages, isActive, isLoading, isTranscribing, voiceLanguage])

  // Stop microphone and speech when this screen is closed.
  useEffect(() => {
    return () => {
      activeRef.current = false
      window.speechSynthesis?.cancel()

      const recorder = recorderRef.current

      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }

      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
    }
  }, [])

  const status = !isActive
    ? 'Ready to talk'
    : isListening
      ? 'Listening to you...'
      : isTranscribing
        ? 'Understanding your voice...'
        : isLoading
          ? 'JARVIS is thinking...'
          : isSpeaking
            ? 'JARVIS is speaking...'
            : 'Preparing microphone...'

  return (
    <main className="voice-mode-page">
      <header className="voice-mode-header">
        <div>
          <span className="voice-mode-eyebrow">JARVIS INTERFACE</span>
          <h1>Voice Assistant</h1>
          <p>Have a natural conversation with your AI assistant.</p>
        </div>

        <div className="voice-mode-status">
          <span className={isActive ? 'status-dot online' : 'status-dot'} />
          {isActive ? 'SESSION ACTIVE' : 'SESSION INACTIVE'}
        </div>
      </header>

      <section className="voice-stage">
        <div
          className={`voice-orb ${
            isListening
              ? 'listening'
              : isSpeaking
                ? 'speaking'
                : isLoading || isTranscribing
                  ? 'thinking'
                  : ''
          }`}
        >
          <div className="voice-orb-ring ring-one" />
          <div className="voice-orb-ring ring-two" />

          <div className="voice-orb-core">
            {isListening ? (
              <Mic size={42} />
            ) : isSpeaking ? (
              <Volume2 size={42} />
            ) : (
              <AudioLines size={42} />
            )}
          </div>
        </div>

        <h2>{status}</h2>

        <p className="voice-stage-description">
          {!isActive
            ? 'Start a voice session to speak with JARVIS.'
            : isListening
              ? 'Speak naturally. Press the microphone button when you finish.'
              : isSpeaking
                ? 'Listen to JARVIS. The microphone will restart automatically.'
                : isLoading || isTranscribing
                  ? 'Please wait while JARVIS processes your request.'
                  : 'Getting ready for your next conversation.'}
        </p>

        {error && (
          <p className="voice-mode-error" role="alert">
            {error}
          </p>
        )}

        <div className="voice-controls">
          {!isActive ? (
            <button
              className="voice-start-button"
              onClick={startConversation}
            >
              <Phone size={19} />
              Start Conversation
            </button>
          ) : (
            <>
              <button
                className={`voice-mic-button ${
                  isListening ? 'recording' : ''
                }`}
                onClick={
                  isListening
                    ? stopRecording
                    : !isLoading && !isTranscribing && !isSpeaking
                      ? () => void startRecording()
                      : undefined
                }
                disabled={
                  isLoading || isTranscribing || isSpeaking
                }
                title={isListening ? 'Finish speaking' : 'Start recording'}
              >
                {isListening ? <MicOff size={21} /> : <Mic size={21} />}
              </button>

              <button
                className="voice-stop-button"
                onClick={stopConversation}
              >
                <PhoneOff size={19} />
                End Conversation
              </button>
            </>
          )}
        </div>
      </section>

      <footer className="voice-mode-footer">
        <label htmlFor="voice-mode-language">Conversation language</label>

        <select
          id="voice-mode-language"
          value={voiceLanguage}
          onChange={(event) =>
            setVoiceLanguage(event.target.value as VoiceLanguage)
          }
          disabled={isActive}
        >
          <option value="en-US">English</option>
          <option value="ur-PK">اردو</option>
          <option value="roman-ur">Roman Urdu</option>
        </select>

        <span>
          <Mic size={14} />
          Microphone access required
        </span>
      </footer>
    </main>
  )
}

export default VoiceMode
