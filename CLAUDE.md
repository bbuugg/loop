# Loop — Chrome DevTools Extension

## Project Structure

This repo has two distinct parts:

### 1. Chrome Extension (root-level files)
The actual extension loaded into Chrome:
- `manifest.json` — MV3 manifest; registers `background.js` as service worker and `devtools.html` as the DevTools page
- `background.js` — Service worker; the CDP bridge. Attaches the Chrome debugger to the inspected tab and executes steps via `chrome.debugger.sendCommand`. Also handles recording by injecting a content script via `chrome.scripting.executeScript`, and element picking by injecting `picker.js`.
- `picker.js` — Standalone content script injected on demand for XPath element picking. Highlights hovered elements with an overlay and tooltip, generates a unique XPath on click, then self-cleans and sends the result back via `chrome.runtime.sendMessage`.
- `devtools.html` / `devtools.js` — DevTools page entry; creates the DevTools panel that loads the React app
- `plugin/` — Mirror of the root extension files (backup/alternate copy)
- `bak/` — Older backup of extension files

### 2. React UI (src/)
Built with Vite and rendered inside the DevTools panel iframe:
- `src/App.tsx` — Root component and all runtime logic: step execution loop, variable interpolation, recording state, import/export
- `src/schema.ts` — `Step` type, `STEP_SCHEMA` (maps step types to their form fields), `stepSummary()`
- `src/components/Toolbar.tsx` — Run/Stop/Record/Loop controls and import/export buttons
- `src/components/StepsPanel.tsx` — Step list with per-step actions (edit, delete, move, run, disable)
- `src/components/VarsPanel.tsx` — Variable key/value editor
- `src/components/LogPanel.tsx` — Execution log display
- `src/components/StepModal.tsx` — Modal dialog for adding/editing steps, driven by `STEP_SCHEMA`; fields with `xpath: true` show a 🎯 picker button that triggers element picking on the live page
- `src/components/ui/` — shadcn/ui primitives (button, input, dialog, etc.)

## Architecture

The extension communicates in two directions:

**Panel → Background (messages):**
- `attachDebugger` / `detachDebugger` — manage CDP session on `tabId`
- `runStep` — execute a single step object via CDP
- `startRecording` / `stopRecording` — inject/remove the click-recorder content script
- `startPicking` — inject `picker.js` into the page to start XPath element picking

**Content script → Background → Panel (port):**
- The panel connects a named port (`crawler-panel-{tabId}`)
- Recorded clicks in the content script send `recordedStep` messages to background, which relays them to the panel port
- XPath picker: `startPicking` message injects `picker.js` into the page; user hovers/clicks an element; the XPath is sent back as a `pickedXPath` port message to the panel

**Step execution** (`App.tsx`):
- `setVar` and `ifVar` steps are handled entirely in the panel (no CDP call)
- All other steps are sent to `background.js` via `runStep` message
- Variable interpolation (`{varName}`) is applied before sending steps to background
- `onError` per step controls stop/continue/goto behavior

## Commands

```bash
# Install dependencies
npm install

# Development server (hot reload for the React UI)
npm run dev

# Build the React UI into dist/
npm run build

# Lint
npm run lint

# Preview the production build
npm run preview
```

## Loading the Extension

After `npm run build`, load the repo root as an unpacked extension in `chrome://extensions` (Developer mode). The built UI is served from `dist/` and referenced by `devtools.js`. For active development, run `npm run dev` and reload the extension after changes.

## Adding a New Step Type

1. Add the type's fields to `STEP_SCHEMA` in `src/schema.ts`
2. Add a `case` to `stepSummary()` in `src/schema.ts`
3. Handle the type in `runStep()` in `background.js` (if it needs CDP)
4. Handle it in the `run()` / `runOne()` functions in `src/App.tsx` (if panel-side logic is needed)
