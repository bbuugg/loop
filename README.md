# Loop — Chrome DevTools Panel Extension

A Chrome extension that adds a **Loop** panel inside DevTools (F12). Build, record, and replay automation step sequences on any webpage.

---

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the folder
5. Open any webpage, press **F12**, and click the **Loop** tab

> The extension requires access to the debugger API. Chrome will show a banner at the top of the page while the debugger is attached — this is normal.

---

## Interface Overview

```
[ ▶ Run ] [ ☐ Loop ] [ ● Record ] [ Clear Steps ] [ Clear Log ] [ Export JSON ] [ Import JSON ]
─────────────────────────────────────────────────────────────────────────────────────────────
  Steps Panel (left)                          │  Log Panel (right)
  ─────────────────────────────────────────  │  ────────────────────────────────────────────
  1  Navigate to URL                          │  12:00:01  Debugger attached.
     https://example.com                      │  12:00:01  Step 1: Navigate to URL
  2  Hover Element                            │  12:00:02    → ok
     //nav/ul/li[2]                           │  12:00:02  Step 2: Hover Element
  3  Click Element                            │  12:00:03    → ok
     //*[@id="btn-login"]                     │  12:00:03  Run complete.
```

---

## Step Types

| Type | Description |
|------|-------------|
| **Navigate to URL** | Navigate the inspected tab to a specified URL |
| **Refresh** | Reload the current page |
| **Wait for Element** | Wait until an XPath element appears in the DOM (configurable timeout) |
| **Hover Element** | Move the mouse to an element and dispatch `mouseover`/`mouseenter`/`mousemove` events |
| **Click Element** | Click an element using CDP mouse events |
| **Type Text** | Focus an input element and type text character by character |
| **Extract** | Extract an element's text content or a specific attribute value. Optionally save the result to a variable via **Save as variable** field |
| **Set Variable** | Set or update a global variable by name. Accepts a literal value or a JavaScript expression (e.g. `page + 1`) |
| **Scroll** | Scroll a page or element by a given pixel delta (X and Y) |
| **Wait ms** | Pause execution for a fixed number of milliseconds |
| **Screenshot** | Capture a PNG screenshot, displayed inline in the log |

All element-targeting steps use **XPath** selectors.

---

## Adding Steps Manually

1. Click any step type button in the **Add Step** bar at the bottom of the steps panel
2. A modal dialog opens — fill in the required fields:
   - **Name** (optional): a label shown in the step list for easy identification
   - Type-specific fields (URL, XPath, text, timeout, etc.)
   - For XPath fields, click the **🎯** button to pick an element directly on the page (see [XPath Picker](#xpath-picker) below)
3. Click **OK** to add the step

### XPath Examples

```
//*[@id="login-btn"]          — element with id="login-btn"
//button[text()="Submit"]     — button with exact text
//nav/ul/li[2]/a              — second nav item link
//*[@class="menu-item"]       — element with class
```

---

## XPath Picker

For any step that requires an XPath selector, you can pick the element visually instead of typing it manually:

1. Open the step modal (add or edit a step with an XPath field)
2. Click the **🎯** button next to the XPath input
3. The DevTools panel minimizes and the page enters pick mode — elements highlight as you hover
4. Click the target element — its XPath is automatically generated and filled into the field
5. Press **Escape** to cancel picking without selecting

> The picker generates a precise XPath that uniquely identifies the element using its tag, id, class, or positional index.

---

## Recording Steps

1. Click **● Record** to start recording
2. Click elements on the inspected page — each click automatically generates a **Click** step
3. Click **⏹ Stop Rec** to stop recording

Recorded steps are appended to the current step list and can be edited or reordered.

> Recording does not work on restricted pages (`chrome://`, `edge://`, `chrome-extension://`).

---

## Running Steps

### Single Run
- Click **▶ Run** to execute all enabled steps in order
- The button changes to **⏹ Stop** while running — click it to abort immediately
- Each step shows a status indicator: running (blue), done (green), error (red)
- Results and errors are shown in the log panel on the right

### Loop Mode
- Check the **Loop** checkbox before clicking **▶ Run**
- Steps repeat indefinitely until an error occurs or **⏹ Stop** is clicked
- Each iteration is numbered in the log: `── Loop iteration 1 ──`

### Single Step Execution
- Click the **▶** button on any individual step to run just that step
- Useful for testing or debugging a specific action

### Execution Behavior
- Before each step, the extension waits for `document.readyState === 'complete'`
- **Hover** and **Click** steps automatically wait up to 10 seconds for the target element to appear before acting
- **Wait for Element** steps wait up to the configured timeout (default 10 seconds)
- If a step errors, execution stops and the step is marked red

---

## Managing Steps

| Button | Action |
|--------|--------|
| **▶** | Run this step individually |
| **⊘** | Disable/enable the step (disabled steps are skipped during run) |
| **Edit** | Open the step's modal to edit its fields |
| **Del** | Delete the step |
| **▲ / ▼** | Move the step up or down in the list |
| **⇑** | Insert a new step before this one |
| **⇓** | Insert a new step after this one |

Disabled steps are shown at reduced opacity and are skipped during Run and Loop.

---

## Export & Import

### Export
- Click **Export JSON** to download the current step list as a `.json` file

### Import
- Click **Import JSON** and select a previously exported file
- The imported steps replace the current step list

### JSON Format

```json
[
  {
    "type": "navigate",
    "name": "Go to homepage",
    "url": "https://example.com"
  },
  {
    "type": "hover",
    "selector": "//nav/ul/li[2]"
  },
  {
    "type": "click",
    "name": "Open menu",
    "selector": "//*[@id=\"menu-btn\"]"
  },
  {
    "type": "waitElement",
    "selector": "//*[@id=\"dropdown\"]",
    "timeout": 5000
  },
  {
    "type": "extract",
    "selector": "//h1",
    "attribute": ""
  },
  {
    "type": "waitMs",
    "ms": 1000
  },
  {
    "type": "screenshot"
  }
]
```

Supported fields per type:

| Type | Fields |
|------|--------|
| `navigate` | `url` |
| `refresh` | *(none)* |
| `waitElement` | `selector`, `timeout` (ms, default 10000) |
| `hover` | `selector` |
| `click` | `selector` |
| `type` | `selector`, `text` |
| `extract` | `selector`, `attribute` (empty = text content), `saveAs` (variable name) |
| `setVar` | `varName`, `varExpr` |
| `scroll` | `selector` (optional), `deltaX`, `deltaY` |
| `waitMs` | `ms` |
| `screenshot` | *(none)* |

All steps optionally accept a `name` string, a `disabled` boolean, an `onError` string (`stop`, `continue`, or `goto`), and an `onErrorGoto` step ID.

---

## Variables

The **Variables panel** (between the steps list and log) lets you define global variables that can be referenced in any step field using `{varName}` syntax.

### Defining Variables

- Click **+** in the Variables panel header and enter a variable name (letters, digits, underscores only)
- Edit the value directly in the input field
- Click **✕** to delete a variable

### Using Variables in Steps

Any step field supports `{varName}` substitution:

```
Navigate URL:  https://example.com/page/{page}
Type text:     {username}
XPath:         //li[{index}]
```

### Set Variable Step

Use **Set Var** to update a variable during execution:

| Field | Example | Description |
|-------|---------|-------------|
| Variable name | `page` | Name of the variable to set |
| Value or expression | `1` | Set to a literal value |
| Value or expression | `page + 1` | Increment current value |
| Value or expression | `"https://example.com/" + page` | String concatenation |
| Value or expression | `page > 5 ? "done" : "continue"` | Conditional |

Expressions are evaluated as JavaScript. All current variable names are available directly in the expression scope.

### Extract to Variable

The **Extract** step has a **Save as variable** field. When filled, the extracted value is stored in that variable after execution:

```json
{
  "type": "extract",
  "selector": "//span[@class=\"page-num\"]",
  "saveAs": "page"
}
```

### Variables in Export/Import

Variables are saved alongside steps in the exported JSON:

```json
{
  "steps": [ ... ],
  "vars": {
    "page": "1",
    "username": "admin"
  }
}
```

---

## Troubleshooting

**"Failed to start recording"**
The page may be restricted (`chrome://`, `edge://`) or the extension needs reloading. Go to `chrome://extensions` → Loop → click the reload icon.

**"Element not found"**
The XPath did not match any element within the timeout. Verify the XPath in browser DevTools console:
```js
document.evaluate('//your/xpath', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
```

**Debugger banner appears on page**
This is expected — Chrome shows a warning whenever a DevTools extension attaches the debugger. It disappears when you close DevTools or the run finishes.

**Steps run but nothing happens**
Some sites use React/Vue synthetic events and may not respond to CDP mouse events. Try adding a **Wait for Element** step before the interaction, or check if the XPath points to the correct element.
