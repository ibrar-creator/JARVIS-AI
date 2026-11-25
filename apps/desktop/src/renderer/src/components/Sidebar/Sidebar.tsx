
import {
  Bot,
  MessageSquare,
  Plus,
  ListTodo,
  Brain,
  Settings,
  PanelLeftClose,
  Trash2,
  AudioLines
} from 'lucide-react'

export interface SidebarConversation {
  id: string
  title: string
  messages: {
    id: number
    role: 'user' | 'assistant'
    content: string
  }[]
  createdAt: number
  updatedAt: number
}

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
  onNewChat: () => void
  conversations: SidebarConversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
}

function Sidebar({
  activePage,
  onNavigate,
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation
}: SidebarProps): React.JSX.Element {
  const navigation = [
    { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
    { id: 'voice', label: 'Voice Mode', icon: AudioLines },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Bot size={23} />
        </div>

        <div className="brand-details">
          <h2>JARVIS</h2>
          <span>PERSONAL AI AGENT</span>
        </div>

        <button className="icon-button collapse-button" title="Sidebar">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button className="new-chat-button" onClick={onNewChat}>
        <Plus size={18} />
        <span>New conversation</span>
      </button>

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="sidebar-navigation">
        {navigation.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-section-label">CHAT HISTORY</div>

      <div className="chat-history-list">
        {conversations.length === 0 ? (
          <p className="chat-history-empty">Your conversations will appear here.</p>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`history-item ${
                activeConversationId === conversation.id ? 'active' : ''
              }`}
            >
              <button
                className="history-select-button"
                onClick={() => onSelectConversation(conversation.id)}
                title={conversation.title}
              >
                <MessageSquare size={16} />
                <span>{conversation.title}</span>
              </button>

              <button
                className="history-delete-button"
                onClick={() => onDeleteConversation(conversation.id)}
                title="Delete conversation"
                aria-label={`Delete ${conversation.title}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="user-avatar">J</div>

          <div className="user-details">
            <strong>Local Workspace</strong>
            <span>Personal environment</span>
          </div>

          <div className="online-dot" />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
