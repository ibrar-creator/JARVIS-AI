import dotenv from 'dotenv'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

dotenv.config({
  path: join(__dirname, '../../.env')
})

function getAnthropicApiKey(): string | undefined {
  dotenv.config({ path: join(app.getPath('userData'), '.env') })

  return process.env.ANTHROPIC_API_KEY?.trim() || undefined
}

function getAnthropicMessage(payload: unknown): string | undefined {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('content' in payload) ||
    !Array.isArray(payload.content)
  ) {
    return undefined
  }

  const text = payload.content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string'
    )
    .map((block) => block.text.trim())
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

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Secure IPC test endpoint
  ipcMain.handle('jarvis:get-app-version', () => {
    return app.getVersion()
  })
  ipcMain.handle('jarvis:send-message', async (_event, messages) => {
    const apiKey = getAnthropicApiKey()
    if (!apiKey) {
      return {
        ok: false,
        error:
          'Anthropic API key is missing. Add ANTHROPIC_API_KEY to apps/desktop/.env or the app user-data .env file.'
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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
          max_tokens: 2048,
          system:
            'You are JARVIS, a helpful personal desktop AI assistant. ' +
            'You communicate naturally in English, Urdu, and Roman Urdu. ' +
            'Be clear, practical, respectful, and concise. ' +
            'Never claim to have controlled the computer or performed an action unless a tool actually did it.',
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      })

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
            'The Anthropic API key is invalid. Check ANTHROPIC_API_KEY in your configuration.'
          )
        }
        if (response.status === 403) {
          throw new Error(
            'This Anthropic API key does not have permission to use the selected model.'
          )
        }
        if (response.status === 404) {
          throw new Error(
            'The Anthropic model was not found. Check ANTHROPIC_MODEL in your configuration.'
          )
        }
        if (response.status === 429) {
          throw new Error(
            providerMessage ||
              'Anthropic is rate-limiting requests or the API account has reached its usage limit. Check your Anthropic account usage and try again.'
          )
        }
        if (response.status === 529) {
          throw new Error('Anthropic is temporarily overloaded. Wait a little and try again.')
        }

        throw new Error(providerMessage || `The Anthropic API returned HTTP ${response.status}.`)
      }

      const message = getAnthropicMessage(await response.json())
      if (!message) {
        throw new Error('Anthropic returned an empty or invalid response.')
      }

      return {
        ok: true,
        message
      }
    } catch (error) {
      console.error('JARVIS Anthropic request failed:', error)

      return {
        ok: false,
        error:
          error instanceof TypeError
            ? 'Could not reach Anthropic. Check your internet connection and try again.'
            : error instanceof Error
              ? error.message
              : 'Anthropic request failed for an unknown reason.'
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
