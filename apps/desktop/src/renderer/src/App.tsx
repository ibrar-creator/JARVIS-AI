import { useState, type ElementType } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatWindow, { type ChatMessage } from './components/Chat/ChatWindow'
import SystemStatus from './components/Status/SystemStatus'
import { Brain, ListTodo, Settings } from 'lucide-react'

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleNewChat = (): void => {
    if (isLoading) return

    setMessages([])
    setActivePage('chat')
  }

  const handleSendMessage = async (content: string): Promise<void> => {
    const trimmedContent = content.trim()

    if (!trimmedContent || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmedContent
    }

    // Include previous conversation for AI context.
    const conversationHistory = [...messages, userMessage]
      .map(({ role, content }) => ({
        role,
        content
      }))
      .slice(-20)

    setMessages((previous) => [...previous, userMessage])
    setIsLoading(true)

    try {
      const jarvis = window.jarvis
      if (!jarvis || typeof jarvis.sendMessage !== 'function') {
        throw new Error(
          'The JARVIS connection is unavailable. Restart the app to reload its connection.'
        )
      }

      const response = await jarvis.sendMessage(conversationHistory)

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.ok
          ? response.message || 'JARVIS returned an empty response.'
          : response.error || 'Something went wrong.'
      }

      setMessages((previous) => [...previous, assistantMessage])
    } catch (error) {
      console.error('JARVIS chat error:', error)

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content:
            error instanceof Error
              ? `Unable to send your message: ${error.message}`
              : 'Unable to send your message because of an unexpected error. Please try again.'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const pageDetails: Record<string, { title: string; description: string; icon: ElementType }> = {
    tasks: {
      title: 'Task Center',
      description: 'Your automated workflows will appear here.',
      icon: ListTodo
    },
    memory: {
      title: 'JARVIS Memory',
      description: 'Manage the information JARVIS can remember.',
      icon: Brain
    },
    settings: {
      title: 'Settings',
      description: 'Configure your AI model, voice and permissions.',
      icon: Settings
    }
  }

  const currentPage = pageDetails[activePage]
  const PageIcon = currentPage?.icon

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} onNewChat={handleNewChat} />

      <div className="main-panel">
        {activePage === 'chat' ? (
          <ChatWindow messages={messages} onSend={handleSendMessage} isLoading={isLoading} />
        ) : (
          <main className="placeholder-page">
            <div className="placeholder-icon">{PageIcon && <PageIcon size={30} />}</div>

            <h1>{currentPage?.title}</h1>
            <p>{currentPage?.description}</p>

            <span className="coming-soon">COMING IN A FUTURE PHASE</span>
          </main>
        )}

        <footer className="app-footer">
          <SystemStatus />
          <span className="footer-version">JARVIS v1.0.0</span>
        </footer>
      </div>
    </div>
  )
}

export default App
