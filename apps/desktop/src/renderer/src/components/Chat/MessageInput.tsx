import { useState, KeyboardEvent } from 'react'
import { ArrowUp, Mic, Plus } from 'lucide-react'

interface MessageInputProps {
  onSend: (message: string) => void
}

function MessageInput({ onSend }: MessageInputProps): React.JSX.Element {
  const [message, setMessage] = useState('')

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
          <button className="input-tool-button" title="More tools">
            <Plus size={19} />
          </button>

          <div className="input-actions">
            <button
              className="input-tool-button microphone-button"
              title="Voice input coming soon"
              disabled
            >
              <Mic size={19} />
            </button>

            <button
              className="send-button"
              onClick={handleSend}
              disabled={!message.trim()}
              title="Send message"
            >
              <ArrowUp size={19} />
            </button>
          </div>
        </div>
      </div>

      <p className="input-disclaimer">
        JARVIS is currently running in demo mode. AI connection comes next.
      </p>
    </div>
  )
}

export default MessageInput