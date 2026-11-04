import { ElectronAPI } from '@electron-toolkit/preload'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AIResponse = {
  ok: boolean
  message?: string
  error?: string
}

interface JarvisAPI {
  getAppVersion: () => Promise<string>
  sendMessage: (messages: ChatMessage[]) => Promise<AIResponse>
}

declare global {
  interface Window {
    electron: ElectronAPI
    jarvis: JarvisAPI
  }
}