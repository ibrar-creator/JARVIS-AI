import { useEffect, useRef, useState } from 'react'
import { Bot, Sparkles, User, Copy, Check, Pencil, X, Send } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import MessageInput, { type VoiceLanguage } from './MessageInput'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  messages: ChatMessage[]
  onSend: (message: string) => void
  onRegenerate: () => Promise<void>
  onEditMessage: (messageId: number, newContent: string) => void
  isLoading: boolean
}

function ChatWindow({
  messages,
  onSend,
  onRegenerate,
  onEditMessage,
  isLoading
}: ChatWindowProps): React.JSX.Element {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('en-US')
  const [voiceOutputError, setVoiceOutputError] = useState<string>()
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const lastSpokenMessageId = useRef<number | null>(null)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    })
  }, [messages, isLoading])

  // Voice output
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'assistant') return
    if (lastSpokenMessageId.current === lastMessage.id) return

    lastSpokenMessageId.current = lastMessage.id

    if (!voiceEnabled || !('speechSynthesis' in window)) return

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

    if (!enabled) {
      window.speechSynthesis?.cancel()
    }
  }

  const handleStartEdit = (message: ChatMessage): void => {
    setEditingMessageId(message.id)
    setEditedContent(message.content)
  }

  const handleCancelEdit = (): void => {
    setEditingMessageId(null)
    setEditedContent('')
  }

  const handleSaveEdit = async (message: ChatMessage): Promise<void> => {
    if (!editedContent.trim() || isLoading) return

    if (editedContent.trim() === message.content.trim()) {
      handleCancelEdit()
      return
    }

    await onEditMessage(message.id, editedContent.trim())

    setEditingMessageId(null)
    setEditedContent('')
  }

  // Copy complete assistant response
  const handleCopy = async (message: ChatMessage): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content)

      setCopiedMessageId(message.id)

      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === message.id ? null : current))
      }, 1800)
    } catch (error) {
      console.error('Could not copy message:', error)
    }
  }

  // Copy individual code block
  const handleCopyCode = async (code: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)

      window.setTimeout(() => {
        setCopiedCode((current) => (current === code ? null : current))
      }, 1800)
    } catch (error) {
      console.error('Could not copy code:', error)
    }
  }

  // Markdown rendering and syntax highlighting
  const markdownComponents: Components = {
    pre({ children }) {
      return <>{children}</>
    },

    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const code = String(children).replace(/\n$/, '')

      if (match) {
        const language = match[1]
        const isCopied = copiedCode === code

        return (
          <div className="code-block-wrapper">
            <div className="code-block-header">
              <span className="code-language">{language}</span>

              <button
                className="code-copy-button"
                onClick={() => void handleCopyCode(code)}
                title="Copy code"
                aria-label="Copy code"
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>{isCopied ? 'Copied' : 'Copy code'}</span>
              </button>
            </div>

            <SyntaxHighlighter
              language={language}
              style={oneDark}
              PreTag="div"
              customStyle={{
                margin: 0,
                padding: '18px',
                background: '#0d1420',
                fontSize: '12px',
                lineHeight: 1.8,
                borderRadius: '0 0 10px 10px'
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'Consolas, Monaco, monospace'
                }
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )
      }

      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      )
    }
  }

  const spokenReplyError =
    voiceEnabled && !('speechSynthesis' in window)
      ? 'Spoken replies are not supported by this app runtime.'
      : voiceOutputError

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-title">
            <span>JARVIS Assistant</span>

            <span className="model-badge">
              <span className="live-dot" />
              GEMINI LIVE
            </span>
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
              Intelligence at your<span> command.</span>
            </h1>

            <p className="welcome-description">
              I'm JARVIS. Your personal AI assistant designed to help you think, work, automate
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
            {messages.map((message, index) => (
              <div key={message.id} className={`message-row ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'assistant' ? <Bot size={19} /> : <User size={18} />}
                </div>

                <div className="message-body">
                  <div className="message-meta">
                    <span className="message-author">
                      {message.role === 'assistant' ? 'JARVIS' : 'YOU'}
                    </span>

                    <span className="message-role-label">
                      {message.role === 'assistant' ? 'AI ASSISTANT' : 'MESSAGE'}
                    </span>
                  </div>

                  <div className="message-content">
                    {editingMessageId === message.id ? (
                      <div className="edit-message-container">
                        <textarea
                          className="edit-message-textarea"
                          value={editedContent}
                          onChange={(event) => setEditedContent(event.target.value)}
                          rows={Math.max(3, editedContent.split('\n').length)}
                          autoFocus
                          disabled={isLoading}
                        />

                        <div className="edit-message-actions">
                          <button
                            className="message-action-button"
                            onClick={handleCancelEdit}
                            disabled={isLoading}
                          >
                            <X size={14} />
                            Cancel
                          </button>

                          <button
                            className="message-action-button edit-save-button"
                            onClick={() => void handleSaveEdit(message)}
                            disabled={isLoading || !editedContent.trim()}
                          >
                            <Send size={14} />
                            Save & Send
                          </button>
                        </div>
                      </div>
                    ) : message.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>

                {message.role === 'assistant' && index === messages.length - 1 && (
                  <div className="message-actions">
                    <button
                      className="message-action-button"
                      onClick={() => void handleCopy(message)}
                      title="Copy response"
                      aria-label="Copy response"
                    >
                      {copiedMessageId === message.id ? <Check size={14} /> : <Copy size={14} />}

                      <span>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      className="message-action-button"
                      onClick={() => void onRegenerate()}
                      disabled={isLoading}
                      title="Regenerate response"
                      aria-label="Regenerate response"
                    >
                      <Sparkles size={14} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                )}

                {message.role === 'user' && !isLoading && (
                  <div className="message-actions">
                    <button
                      className="message-action-button"
                      onClick={() => handleStartEdit(message)}
                      disabled={editingMessageId !== null}
                      title="Edit message"
                    >
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant">
                <div className="message-avatar">
                  <Bot size={19} />
                </div>

                <div className="message-body">
                  <div className="message-meta">
                    <span className="message-author">JARVIS</span>
                    <span className="message-role-label">THINKING</span>
                  </div>

                  <div className="thinking-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={conversationEndRef} />
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
