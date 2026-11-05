import { useEffect, useRef, useState } from 'react'
import { Bot, Sparkles, User } from 'lucide-react'
import MessageInput, { type VoiceLanguage } from './MessageInput'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
  isLoading: boolean
}

function ChatWindow({ messages, onSend, isLoading }: ChatWindowProps): React.JSX.Element {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('en-US')
  const [voiceOutputError, setVoiceOutputError] = useState<string>()
  const lastSpokenMessageId = useRef<number | null>(null)

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') return
    if (lastSpokenMessageId.current === lastMessage.id) return

    lastSpokenMessageId.current = lastMessage.id
    if (!voiceEnabled) return

    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(lastMessage.content)
    utterance.lang =
      /[\u0600-\u06FF]/u.test(lastMessage.content) || voiceLanguage !== 'en-US' ? 'ur-PK' : 'en-US'
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setVoiceOutputError('Could not play the spoken reply. Check your system speech settings.')
      }
    }
    utterance.onstart = () => setVoiceOutputError(undefined)
    window.speechSynthesis.speak(utterance)
  }, [messages, voiceEnabled, voiceLanguage])

  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  const handleVoiceEnabledChange = (enabled: boolean): void => {
    setVoiceEnabled(enabled)
    setVoiceOutputError(undefined)
    if (!enabled) window.speechSynthesis?.cancel()
  }

  const spokenReplyError =
    voiceEnabled && !('speechSynthesis' in window)
      ? 'Spoken replies are not supported by this app runtime.'
      : voiceOutputError

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div>
          <div className="chat-header-title">
            <span>AI Assistant</span>
            <span className="model-badge">LIVE AI</span>
          </div>
          <p>Your personal desktop intelligence</p>
        </div>

        <div className="header-avatar">
          <Bot size={21} />
        </div>
      </header>

      <div className="conversation-area">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-icon">
              <Sparkles size={27} />
            </div>

            <span className="welcome-eyebrow">YOUR PERSONAL AI ASSISTANT</span>

            <h1>
              Intelligence at your
              <span> command.</span>
            </h1>

            <p className="welcome-description">
              I&apos;m JARVIS. Your personal AI assistant designed to help you think, work, automate
              tasks and control your digital workspace.
            </p>

            <div className="suggestion-grid">
              <button
                className="suggestion-card"
                onClick={() => onSend('Introduce yourself, JARVIS.')}
              >
                <Bot size={19} />
                <strong>Meet JARVIS</strong>
                <span>What can you help me with?</span>
              </button>

              <button
                className="suggestion-card"
                onClick={() => onSend('Show me my available tasks.')}
              >
                <Sparkles size={19} />
                <strong>Explore tasks</strong>
                <span>Discover automation possibilities</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message-row ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'assistant' ? <Bot size={19} /> : <User size={19} />}
                </div>

                <div className="message-content">
                  <span className="message-author">
                    {message.role === 'assistant' ? 'JARVIS' : 'YOU'}
                  </span>

                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row assistant">
                <div className="message-avatar">
                  <Bot size={19} />
                </div>

                <div className="message-content">
                  <span className="message-author">JARVIS</span>
                  <p>Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MessageInput
        onSend={onSend}
        voiceEnabled={voiceEnabled}
        onVoiceEnabledChange={handleVoiceEnabledChange}
        voiceLanguage={voiceLanguage}
        onVoiceLanguageChange={setVoiceLanguage}
        voiceOutputError={spokenReplyError}
      />
    </main>
  )
}

export default ChatWindow
