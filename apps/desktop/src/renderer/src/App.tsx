import { useEffect, useState, type ElementType } from 'react'
import Sidebar, { type SidebarConversation } from './components/Sidebar/Sidebar'
import ChatWindow, { type ChatMessage } from './components/Chat/ChatWindow'
import SystemStatus from './components/Status/SystemStatus'
import { Brain, ListTodo, Settings } from 'lucide-react'

function createConversationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [conversations, setConversations] = useState<SidebarConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

  // Load saved conversations when JARVIS starts.
  useEffect(() => {
    let isMounted = true

    const loadConversations = async (): Promise<void> => {
      try {
        const result = await window.jarvis.getConversations()

        if (!isMounted) return

        if (!result.ok) {
          throw new Error(result.error || 'Could not load chat history.')
        }

        const sortedConversations = [...result.conversations].sort(
          (a, b) => b.updatedAt - a.updatedAt
        )

        setConversations(sortedConversations)

        // Restore the most recently updated conversation.
        if (sortedConversations.length > 0) {
          const latestConversation = sortedConversations[0]

          setActiveConversationId(latestConversation.id)
          setMessages(latestConversation.messages)
        }
      } catch (error) {
        console.error('JARVIS conversation loading error:', error)
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false)
        }
      }
    }

    void loadConversations()

    return () => {
      isMounted = false
    }
  }, [])

  const handleNewChat = (): void => {
    if (isLoading) return

    setMessages([])
    setActiveConversationId(null)
    setActivePage('chat')
  }

  const handleSelectConversation = (id: string): void => {
    if (isLoading) return

    const conversation = conversations.find((item) => item.id === id)

    if (!conversation) return

    setActiveConversationId(conversation.id)
    setMessages(conversation.messages)
    setActivePage('chat')
  }

  const handleDeleteConversation = async (id: string): Promise<void> => {
    const conversation = conversations.find((item) => item.id === id)

    if (!conversation) return

    const confirmed = window.confirm(
      `Delete "${conversation.title}"? This conversation will be permanently deleted.`
    )

    if (!confirmed) return

    try {
      const result = await window.jarvis.deleteConversation(id)

      if (!result.ok) {
        throw new Error(result.error || 'Could not delete conversation.')
      }

      setConversations((previous) => previous.filter((item) => item.id !== id))

      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('JARVIS conversation deletion error:', error)
      window.alert(error instanceof Error ? error.message : 'Could not delete conversation.')
    }
  }

  const persistConversation = async (conversation: SidebarConversation): Promise<void> => {
    const result = await window.jarvis.saveConversation(conversation)

    if (!result.ok) {
      throw new Error(result.error || 'Could not save conversation.')
    }

    setConversations((previous) =>
      [conversation, ...previous.filter((item) => item.id !== conversation.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt
      )
    )
  }

  const handleSendMessage = async (content: string): Promise<void> => {
    const trimmedContent = content.trim()

    if (!trimmedContent || isLoading || isHistoryLoading) return

    const now = Date.now()
    const conversationId = activeConversationId || createConversationId()

    const existingConversation = conversations.find((item) => item.id === conversationId)

    const userMessage: ChatMessage = {
      id: now,
      role: 'user',
      content: trimmedContent
    }

    const updatedMessages = [...messages, userMessage]

    const title = existingConversation?.title || trimmedContent.slice(0, 50) || 'New conversation'

    const createdAt = existingConversation?.createdAt || now

    const userSnapshot: SidebarConversation = {
      id: conversationId,
      title,
      messages: updatedMessages,
      createdAt,
      updatedAt: now
    }

    setActiveConversationId(conversationId)
    setMessages(updatedMessages)
    setActivePage('chat')
    setIsLoading(true)

    try {
      // Save the user's message before requesting Gemini.
      await persistConversation(userSnapshot)

      const conversationHistory = updatedMessages
        .map(({ role, content }) => ({
          role,
          content
        }))
        .slice(-20)

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

      const finalMessages = [...updatedMessages, assistantMessage]

      setMessages(finalMessages)

      // Save the assistant's reply too.
      await persistConversation({
        ...userSnapshot,
        messages: finalMessages,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('JARVIS chat error:', error)

      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content:
          error instanceof Error
            ? `Unable to complete your request: ${error.message}`
            : 'Unable to complete your request. Please try again.'
      }

      const finalMessages = [...updatedMessages, errorMessage]

      setMessages(finalMessages)

      // Keep the conversation even if Gemini or saving encounters an error.
      try {
        await persistConversation({
          ...userSnapshot,
          messages: finalMessages,
          updatedAt: Date.now()
        })
      } catch (saveError) {
        console.error('JARVIS error-message save failed:', saveError)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateResponse = async (): Promise<void> => {
    if (isLoading || isHistoryLoading || messages.length < 2) return

    const lastMessage = messages[messages.length - 1]

    if (lastMessage.role !== 'assistant') return

    const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user')

    if (lastUserIndex === -1) return

    const conversationId = activeConversationId

    if (!conversationId) return

    const conversation = conversations.find((item) => item.id === conversationId)

    if (!conversation) return

    // Keep all messages up to the latest user message.
    const messagesBeforeResponse = messages.slice(
      0,
      lastMessage.role === 'assistant' ? messages.length - 1 : messages.length
    )

    const conversationHistory = messagesBeforeResponse
      .map(({ role, content }) => ({ role, content }))
      .slice(-20)

    setIsLoading(true)

    try {
      const jarvis = window.jarvis

      if (!jarvis || typeof jarvis.sendMessage !== 'function') {
        throw new Error('The JARVIS connection is unavailable.')
      }

      const response = await jarvis.sendMessage(conversationHistory)

      const newAssistantMessage: ChatMessage = {
        id: Date.now(),
        role: 'assistant',
        content: response.ok
          ? response.message || 'JARVIS returned an empty response.'
          : response.error || 'Something went wrong.'
      }

      const updatedMessages = [...messagesBeforeResponse, newAssistantMessage]

      setMessages(updatedMessages)

      await persistConversation({
        ...conversation,
        messages: updatedMessages,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('JARVIS regenerate error:', error)

      const errorMessage: ChatMessage = {
        id: Date.now(),
        role: 'assistant',
        content:
          error instanceof Error
            ? `Unable to regenerate response: ${error.message}`
            : 'Unable to regenerate response. Please try again.'
      }

      const updatedMessages = [...messagesBeforeResponse, errorMessage]

      setMessages(updatedMessages)

      try {
        await persistConversation({
          ...conversation,
          messages: updatedMessages,
          updatedAt: Date.now()
        })
      } catch (saveError) {
        console.error('Regenerated error-message save failed:', saveError)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditMessage = async (
    messageId: number,
    newContent: string
  ): Promise<void> => {
    const trimmedContent = newContent.trim()

    if (!trimmedContent || isLoading || isHistoryLoading) return

    if (!activeConversationId) return

    const conversation = conversations.find(
      (item) => item.id === activeConversationId
    )

    if (!conversation) return

    const messageIndex = messages.findIndex(
      (message) => message.id === messageId && message.role === 'user'
    )

    if (messageIndex === -1) return

    // Keep messages only up to the edited user message.
    const updatedUserMessages = messages
      .slice(0, messageIndex + 1)
      .map((message, index) =>
        index === messageIndex
          ? { ...message, content: trimmedContent }
          : message
      )

    const now = Date.now()

    const updatedConversation: SidebarConversation = {
      ...conversation,
      title:
        messageIndex === 0
          ? trimmedContent.slice(0, 50)
          : conversation.title,
      messages: updatedUserMessages,
      updatedAt: now
    }

    setMessages(updatedUserMessages)
    setIsLoading(true)

    try {
      // Save the edited message before requesting Gemini.
      await persistConversation(updatedConversation)

      const conversationHistory = updatedUserMessages
        .map(({ role, content }) => ({ role, content }))
        .slice(-20)

      const jarvis = window.jarvis

      if (!jarvis || typeof jarvis.sendMessage !== 'function') {
        throw new Error('The JARVIS connection is unavailable.')
      }

      const response = await jarvis.sendMessage(conversationHistory)

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.ok
          ? response.message || 'JARVIS returned an empty response.'
          : response.error || 'Something went wrong.'
      }

      const finalMessages = [...updatedUserMessages, assistantMessage]

      setMessages(finalMessages)

      await persistConversation({
        ...updatedConversation,
        messages: finalMessages,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('JARVIS edit message error:', error)

      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content:
          error instanceof Error
            ? `Unable to process edited message: ${error.message}`
            : 'Unable to process edited message. Please try again.'
      }

      const finalMessages = [...updatedUserMessages, errorMessage]

      setMessages(finalMessages)

      try {
        await persistConversation({
          ...updatedConversation,
          messages: finalMessages,
          updatedAt: Date.now()
        })
      } catch (saveError) {
        console.error('Edited conversation save failed:', saveError)
      }
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
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="main-panel">
        {activePage === 'chat' ? (
          <ChatWindow
            messages={messages}
            onSend={handleSendMessage}
            onRegenerate={handleRegenerateResponse}
             onEditMessage={handleEditMessage}
            isLoading={isLoading || isHistoryLoading}
          />
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
