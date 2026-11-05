# apps-desktop

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Configure the AI

Create `apps/desktop/.env` for development and add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.8-flash
```

For a packaged app, put the same `.env` file in the app's Electron user-data
folder, or set `GEMINI_API_KEY` in the environment before launching the app.
The model setting is optional; the app defaults to `gemini-3.8-flash`.

### Voice assistant

Use the microphone button beside the chat input for speech-to-text, choosing English,
Urdu, or Roman Urdu first. The browser's speech recognition service may require an
internet connection and may transcribe Urdu speech using Urdu script. Turn on the
speaker button to have new JARVIS replies read aloud; spoken output uses the
system's available speech voices.

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
