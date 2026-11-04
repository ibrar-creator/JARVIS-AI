import {
  Bot,
  MessageSquare,
  Plus,
  ListTodo,
  Brain,
  Settings,
  PanelLeftClose
} from 'lucide-react'

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
  onNewChat: () => void
}

function Sidebar({
  activePage,
  onNavigate,
  onNewChat
}: SidebarProps): React.JSX.Element {
  const navigation = [
    { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
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