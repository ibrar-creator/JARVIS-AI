import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AIResponse = {
  ok: boolean
  message?: string
  error?: string
}

const jarvisApi = {
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('jarvis:get-app-version')
  },

  sendMessage: (messages: ChatMessage[]): Promise<AIResponse> => {
    return ipcRenderer.invoke('jarvis:send-message', messages)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('jarvis', jarvisApi)
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error('Preload bridge error:', error)
  }
} else {
  Object.assign(window, {
    electron: electronAPI,
    jarvis: jarvisApi
  })
}
