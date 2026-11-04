import { Bot, Sparkles, User } from 'lucide-react'
import MessageInput from './MessageInput'

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

      <MessageInput onSend={onSend} />
    </main>
  )
}

export default ChatWindow
