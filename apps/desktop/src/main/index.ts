import dotenv from 'dotenv'
import { app, shell, BrowserWindow, ipcMain, session, type WebContents } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

dotenv.config({
  path: join(__dirname, '../../.env')
})
type StoredMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string
}

type Conversation = {
  id: string
  title: string
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
}

function getConversationsPath(): string {
  return join(app.getPath('userData'), 'conversations.json')
}

async function readConversations(): Promise<Conversation[]> {
  const filePath = getConversationsPath()

  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(data)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed as Conversation[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

async function writeConversations(
  conversations: Conversation[]
): Promise<void> {
  const filePath = getConversationsPath()
  const temporaryPath = `${filePath}.tmp`

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(conversations, null, 2),
    'utf-8'
  )

  await fs.rename(temporaryPath, filePath)
}
function getGeminiApiKey(): string | undefined {
  dotenv.config({ path: join(app.getPath('userData'), '.env') })

  return process.env.GEMINI_API_KEY?.trim() || undefined
}

function isTrustedRenderer(webContents: WebContents): boolean {
  const rendererUrl = webContents.getURL()
  if (!is.dev) return rendererUrl.startsWith('file://')

  const configuredUrl = process.env['ELECTRON_RENDERER_URL']
  if (!configuredUrl) return false

  try {
    return new URL(rendererUrl).origin === new URL(configuredUrl).origin
  } catch {
    return false
  }
}

function getGeminiMessage(payload: unknown): string | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('candidates' in payload) ||
    !Array.isArray(payload.candidates)
  ) {
    return undefined
  }

  const candidate = payload.candidates[0]
  if (typeof candidate !== 'object' || candidate === null || !('content' in candidate)) {
    return undefined
  }
  const content = candidate.content
  if (
    typeof content !== 'object' ||
    content === null ||
    !('parts' in content) ||
    !Array.isArray(content.parts)
  ) {
    return undefined
  }

  const text = content.parts
    .filter(
      (part): part is { text: string } =>
        typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string'
    )
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n')

  return text || undefined
}

function getProviderErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined

  const detail =
    ('error' in payload ? payload.error : undefined) ??
    ('detail' in payload ? payload.detail : undefined) ??
    ('message' in payload ? payload.message : undefined)

  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null && 'message' in detail) {
    return typeof detail.message === 'string' ? detail.message : undefined
  }

  return undefined
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`JARVIS preload failed (${preloadPath}):`, error)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jarvis.desktop')

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestsAudioOnly =
        'mediaTypes' in details &&
        details.mediaTypes?.includes('audio') === true &&
        !details.mediaTypes.includes('video')
      callback(permission === 'media' && requestsAudioOnly && isTrustedRenderer(webContents))
    }
  )

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
// Get all saved conversations
ipcMain.handle('jarvis:get-conversations', async () => {
  try {
    return {
      ok: true,
      conversations: await readConversations()
    }
  } catch (error) {
    console.error('JARVIS: Failed to load conversations:', error)

    return {
      ok: false,
      error: 'Unable to load saved conversations.',
      conversations: []
    }
  }
})

// Save or update a conversation
ipcMain.handle(
  'jarvis:save-conversation',
  async (_event, conversation: unknown) => {
    try {
      if (
        typeof conversation !== 'object' ||
        conversation === null ||
        !('id' in conversation) ||
        typeof conversation.id !== 'string' ||
        conversation.id.length > 100 ||
        !('title' in conversation) ||
        typeof conversation.title !== 'string' ||
        conversation.title.length > 200 ||
        !('messages' in conversation) ||
        !Array.isArray(conversation.messages) ||
        conversation.messages.length > 1000
      ) {
        return {
          ok: false,
          error: 'Invalid conversation data.'
        }
      }

      const messages = conversation.messages as StoredMessage[]

      const validMessages = messages.every(
        (message) =>
          message &&
          typeof message === 'object' &&
          typeof message.id === 'number' &&
          ['user', 'assistant'].includes(message.role) &&
          typeof message.content === 'string' &&
          message.content.length <= 32000
      )

      if (!validMessages) {
        return {
          ok: false,
          error: 'Invalid conversation messages.'
        }
      }

      const conversations = await readConversations()
      const existingIndex = conversations.findIndex(
        (item) => item.id === conversation.id
      )

      const now = Date.now()

      const updatedConversation: Conversation = {
        id: conversation.id,
        title: conversation.title.trim() || 'New conversation',
        messages,
        createdAt:
          existingIndex >= 0 ? conversations[existingIndex].createdAt : now,
        updatedAt: now
      }

      if (existingIndex >= 0) {
        conversations[existingIndex] = updatedConversation
      } else {
        conversations.unshift(updatedConversation)
      }

      await writeConversations(conversations)

      return { ok: true }
    } catch (error) {
      console.error('JARVIS: Failed to save conversation:', error)

      return {
        ok: false,
        error: 'Unable to save conversation.'
      }
    }
  }
)

// Delete a conversation
ipcMain.handle(
  'jarvis:delete-conversation',
  async (_event, id: unknown) => {
    try {
      if (typeof id !== 'string' || id.length > 100) {
        return { ok: false, error: 'Invalid conversation ID.' }
      }

      const conversations = await readConversations()

      const updatedConversations = conversations.filter(
        (conversation) => conversation.id !== id
      )

      await writeConversations(updatedConversations)

      return { ok: true }
    } catch (error) {
      console.error('JARVIS: Failed to delete conversation:', error)

      return {
        ok: false,
        error: 'Unable to delete conversation.'
      }
    }
  }
)
  // Secure IPC test endpoint
  ipcMain.handle('jarvis:get-app-version', () => {
    return app.getVersion()
  })
  ipcMain.handle('jarvis:send-message', async (_event, messages) => {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      return {
        ok: false,
        error:
          'Gemini API key is missing. Add GEMINI_API_KEY to apps/desktop/.env or the app user-data .env file.'
      }
    }

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      return {
        ok: false,
        error: 'Invalid conversation history. Start a new chat and try again.'
      }
    }

    const validMessages = messages.every(
      (message) =>
        message &&
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0 &&
        message.content.length <= 32_000
    )

    if (!validMessages) {
      return {
        ok: false,
        error: 'Invalid message format. Each message must contain 1 to 32,000 characters.'
      }
    }

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      const requestBody = JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                'You are JARVIS, a helpful personal desktop AI assistant. ' +
                'You communicate naturally in English, Urdu, and Roman Urdu. ' +
                'Be clear, practical, respectful, and concise. ' +
                'Never claim to have controlled the computer or performed an action unless a tool actually did it.'
            }
          ]
        },
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        generationConfig: {
          maxOutputTokens: 2048
        }
      })
      let response: Response
      let attempt = 0
      while (true) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-goog-api-key': apiKey,
            'content-type': 'application/json'
          },
          body: requestBody
        })

        if (response.status < 500 || attempt >= 2) break
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
        attempt += 1
      }

      if (!response.ok) {
        const responseBody = await response.text()
        let providerMessage: string | undefined
        try {
          providerMessage = getProviderErrorMessage(JSON.parse(responseBody))
        } catch {
          providerMessage = undefined
        }

        if (response.status === 401) {
          throw new Error(
            'The Gemini API key is invalid. Check your GEMINI_API_KEY in your configuration.'
          )
        }
        if (response.status === 403) {
          throw new Error('This Gemini API key does not have permission to use the selected model.')
        }
        if (response.status === 404) {
          throw new Error(
            providerMessage
              ? `Gemini model "${model}" was not found: ${providerMessage.slice(0, 500)}`
              : `Gemini model "${model}" was not found. Check GEMINI_MODEL in your configuration.`
          )
        }
        if (response.status === 429) {
          throw new Error(
            providerMessage ||
              'Gemini is rate-limiting requests or the API account has reached its usage limit. Check your Google AI account usage and try again.'
          )
        }
        if (response.status >= 500) {
          throw new Error(
            providerMessage
              ? `Gemini returned HTTP ${response.status}: ${providerMessage.slice(0, 500)}`
              : `Gemini is temporarily unavailable (HTTP ${response.status}) after 3 attempts. Check Google AI service status and try again.`
          )
        }

        throw new Error(providerMessage || `The Gemini API returned HTTP ${response.status}.`)
      }

      const message = getGeminiMessage(await response.json())
      if (!message) {
        throw new Error('Gemini returned an empty or invalid response.')
      }

      return {
        ok: true,
        message
      }
    } catch (error) {
      console.error('JARVIS Gemini request failed:', error)

      return {
        ok: false,
        error:
          error instanceof TypeError
            ? 'Could not reach Gemini. Check your internet connection and try again.'
            : error instanceof Error
              ? error.message
              : 'Gemini request failed for an unknown reason.'
      }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
