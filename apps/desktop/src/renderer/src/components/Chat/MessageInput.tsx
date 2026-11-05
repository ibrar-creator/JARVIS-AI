import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowUp, Mic, MicOff, Plus, Volume2, VolumeX } from 'lucide-react'

export type VoiceLanguage = 'en-US' | 'ur-PK' | 'roman-ur'

interface RecognitionResult {
  isFinal: boolean
  0: {
    transcript: string
  }
}

interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

interface RecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface MessageInputProps {
  onSend: (message: string) => void
  voiceEnabled: boolean
  onVoiceEnabledChange: (enabled: boolean) => void
  voiceLanguage: VoiceLanguage
  onVoiceLanguageChange: (language: VoiceLanguage) => void
  voiceOutputError?: string
}

function getRecognitionError(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone access was denied. Allow microphone access in your system settings and try again.'
  }
  if (error === 'no-speech') return 'No speech detected. Try speaking closer to the microphone.'
  if (error === 'network')
    return 'Voice recognition needs an internet connection. Check your connection and try again.'
  return `Voice recognition failed (${error}). Try again.`
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
  const [voiceInputError, setVoiceInputError] = useState<string>()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
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

  const toggleListening = (): void => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      setVoiceInputError('Voice input is not supported by this app runtime.')
      return
    }

    setVoiceInputError(undefined)

    const recognition = new Recognition()
    recognition.lang = voiceLanguage === 'en-US' ? 'en-US' : 'ur-PK'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => {
        const result = event.results[index]
        return index >= event.resultIndex && result.isFinal ? result[0].transcript.trim() : ''
      })
        .filter(Boolean)
        .join(' ')

      if (transcript) {
        setMessage(
          (current) => `${current}${current && !/\s$/.test(current) ? ' ' : ''}${transcript}`
        )
      }
    }
    recognition.onerror = (event) => {
      setVoiceInputError(getRecognitionError(event.error))
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch (error) {
      recognitionRef.current = null
      setIsListening(false)
      setVoiceInputError(
        error instanceof Error
          ? `Could not start voice input: ${error.message}`
          : 'Could not start voice input.'
      )
    }
  }

  const voiceStatus = voiceInputError || voiceOutputError

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
                  if (language === 'en-US' || language === 'ur-PK' || language === 'roman-ur') {
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
              title={isListening ? 'Stop voice input' : 'Start voice input'}
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
