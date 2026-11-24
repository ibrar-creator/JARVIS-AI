
import { ElectronAPI } from '@electron-toolkit/preload'

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
}

type ChatRequestMessage = {
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
  messages: ChatMessage[]
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

interface JarvisAPI {
  getAppVersion: () => Promise<string>

  sendMessage: (messages: ChatRequestMessage[]) => Promise<AIResponse>
transcribeAudio: (
  audioBase64: string,
  mimeType: string,
  language: string
) => Promise<AudioTranscriptionResponse>
  getConversations: () => Promise<ConversationResult>

  saveConversation: (
    conversation: Conversation
  ) => Promise<OperationResult>

  deleteConversation: (id: string) => Promise<OperationResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    jarvis: JarvisAPI
  }
}
