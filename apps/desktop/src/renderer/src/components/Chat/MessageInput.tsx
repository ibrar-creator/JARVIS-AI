
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Mic, MicOff, Plus, Volume2, VolumeX } from 'lucide-react'

export type VoiceLanguage = 'en-US' | 'ur-PK' | 'roman-ur'

interface MessageInputProps {
  onSend: (message: string) => void
  voiceEnabled: boolean
  onVoiceEnabledChange: (enabled: boolean) => void
  voiceLanguage: VoiceLanguage
  onVoiceLanguageChange: (language: VoiceLanguage) => void
  voiceOutputError?: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read recorded audio.'))
        return
      }

      const commaIndex = reader.result.indexOf(',')

      if (commaIndex === -1) {
        reject(new Error('Invalid audio recording.'))
        return
      }

      resolve(reader.result.slice(commaIndex + 1))
    }

    reader.onerror = () => reject(new Error('Failed to process audio recording.'))

    reader.readAsDataURL(blob)
  })
}

function MessageInput({
  onSend,
  voiceEnabled,
  onVoiceEnabledChange,
  voiceLanguage,
  onVoiceLanguageChange,
  voiceOutputError
}: MessageInputProps): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceInputError, setVoiceInputError] = useState<string>()

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current

      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }

      streamRef.current?.getTracks().forEach((track) => track.stop())

      recorderRef.current = null
      streamRef.current = null
    }
  }, [])

  const handleSend = (): void => {
    const trimmedMessage = message.trim()

    if (!trimmedMessage) return

    onSend(trimmedMessage)
    setMessage('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const startRecording = async (): Promise<void> => {
    setVoiceInputError(undefined)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceInputError('Audio recording is not supported by this app runtime.')
      return
    }

    let stream: MediaStream | undefined

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })

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
        setVoiceInputError('Audio recording failed. Please try again.')
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        })

        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        chunksRef.current = []

        setIsListening(false)

        if (audioBlob.size === 0) {
          setVoiceInputError('No audio was recorded. Please try again.')
          return
        }

        setIsTranscribing(true)
        setVoiceInputError(undefined)

        try {
          const audioBase64 = await blobToBase64(audioBlob)
          const mimeType = audioBlob.type.split(';')[0] || 'audio/webm'

          const result = await window.jarvis.transcribeAudio(
            audioBase64,
            mimeType,
            voiceLanguage
          )

          if (!result.ok || !result.transcript) {
            throw new Error(result.error || 'Could not recognize your speech.')
          }

          setMessage((current) =>
            `${current}${current && !/\s$/.test(current) ? ' ' : ''}${result.transcript}`
          )
        } catch (error) {
          setVoiceInputError(
            error instanceof Error
              ? error.message
              : 'Audio transcription failed. Please try again.'
          )
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsListening(true)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())

      recorderRef.current = null
      streamRef.current = null
      setIsListening(false)

      setVoiceInputError(
        error instanceof Error
          ? `Could not access microphone: ${error.message}`
          : 'Could not access your microphone.'
      )
    }
  }

  const toggleListening = (): void => {
    const recorder = recorderRef.current

    if (recorder && recorder.state === 'recording') {
      recorder.stop()
      return
    }

    if (!isTranscribing) {
      void startRecording()
    }
  }

  const voiceStatus =
    voiceInputError ||
    voiceOutputError ||
    (isTranscribing ? 'Transcribing your voice with Gemini...' : undefined)

  return (
    <div className="message-input-wrapper">
      <div className="message-input-box">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message JARVIS..."
          rows={1}
        />

        <div className="input-toolbar">
          <div className="input-tools">
            <button className="input-tool-button" title="More tools" aria-label="More tools">
              <Plus size={19} />
            </button>

            <label className="voice-language-control">
              <span>Voice</span>
              <select
                value={voiceLanguage}
                onChange={(event) => {
                  const language = event.currentTarget.value

                  if (
                    language === 'en-US' ||
                    language === 'ur-PK' ||
                    language === 'roman-ur'
                  ) {
                    onVoiceLanguageChange(language)
                  }
                }}
                aria-label="Voice input language"
              >
                <option value="en-US">English</option>
                <option value="ur-PK">اردو</option>
                <option value="roman-ur">Roman Urdu</option>
              </select>
            </label>
          </div>

          <div className="input-actions">
            <button
              className={`input-tool-button microphone-button${isListening ? ' is-listening' : ''}`}
              onClick={toggleListening}
              disabled={isTranscribing}
              title={
                isTranscribing
                  ? 'Transcribing audio'
                  : isListening
                    ? 'Stop voice input'
                    : 'Start voice input'
              }
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
            >
              {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>

            <button
              className={`input-tool-button voice-output-button${voiceEnabled ? ' is-enabled' : ''}`}
              onClick={() => onVoiceEnabledChange(!voiceEnabled)}
              title={voiceEnabled ? 'Turn off spoken replies' : 'Turn on spoken replies'}
              aria-label={voiceEnabled ? 'Turn off spoken replies' : 'Turn on spoken replies'}
              aria-pressed={voiceEnabled}
            >
              {voiceEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>

            <button
              className="send-button"
              onClick={handleSend}
              disabled={!message.trim()}
              title="Send message"
              aria-label="Send message"
            >
              <ArrowUp size={19} />
            </button>
          </div>
        </div>
      </div>

      <p className={`input-disclaimer${voiceStatus ? ' voice-error' : ''}`} role="status">
        {voiceStatus ||
          'Voice input: English, Urdu and Roman Urdu. Turn on the speaker for spoken replies.'}
      </p>
    </div>
  )
}

export default MessageInput
