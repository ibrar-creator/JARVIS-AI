
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type StoredMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
}

type AIResponse = {
  ok: boolean
  message?: string
  error?: string
}
type AudioTranscriptionResponse = {
  ok: boolean
  transcript?: string
  error?: string
}
type Conversation = {
  id: string
  title: string
 messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}

type ConversationResult = {
  ok: boolean
  conversations: Conversation[]
  error?: string
}

type OperationResult = {
  ok: boolean
  error?: string
}

const jarvisApi = {
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('jarvis:get-app-version')
  },

  sendMessage: (messages: ChatMessage[]): Promise<AIResponse> => {
    return ipcRenderer.invoke('jarvis:send-message', messages)
  },
transcribeAudio: (
  audioBase64: string,
  mimeType: string,
  language: string
): Promise<AudioTranscriptionResponse> => {
  return ipcRenderer.invoke(
    'jarvis:transcribe-audio',
    audioBase64,
    mimeType,
    language
  )
},
  getConversations: (): Promise<ConversationResult> => {
    return ipcRenderer.invoke('jarvis:get-conversations')
  },

  saveConversation: (
    conversation: Conversation
  ): Promise<OperationResult> => {
    return ipcRenderer.invoke('jarvis:save-conversation', conversation)
  },

  deleteConversation: (id: string): Promise<OperationResult> => {
    return ipcRenderer.invoke('jarvis:delete-conversation', id)
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
