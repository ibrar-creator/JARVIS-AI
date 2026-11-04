import { ShieldCheck, CircleDot } from 'lucide-react'

function SystemStatus(): React.JSX.Element {
  return (
    <div className="system-status">
      <div className="status-indicator">
        <CircleDot size={14} />
        <span>DESKTOP ONLINE</span>
      </div>

      <div className="status-divider" />

      <div className="security-indicator">
        <ShieldCheck size={15} />
        <span>Protected session</span>
      </div>
    </div>
  )
}

export default SystemStatus