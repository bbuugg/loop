// CDP bridge — service worker

const attachedTabs = new Set();
const abortedTabs = new Set();

function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, result => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return;
  await new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        attachedTabs.add(tabId);
        resolve();
      }
    });
  });
}

async function detachDebugger(tabId) {
  if (!attachedTabs.has(tabId)) return;
  await new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
      resolve();
    });
  });
}

chrome.debugger.onDetach.addListener(({ tabId }) => {
  attachedTabs.delete(tabId);
});

function xpathExpr(xpath) {
  return `document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
}

async function waitForElement(tabId, xpath, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (abortedTabs.has(tabId)) throw new Error('Run aborted by user');
    const result = await sendCommand(tabId, 'Runtime.evaluate', {
      expression: `!!(${xpathExpr(xpath)})`,
      returnByValue: true
    });
    if (result.result.value === true) return { found: true };
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Element not found: ${xpath} (timeout ${timeout}ms)`);
}

async function clickElement(tabId, xpath, timeout = 10000) {
  const start = Date.now();
  while (true) {
    if (abortedTabs.has(tabId)) throw new Error('Run aborted by user');
    const result = await sendCommand(tabId, 'Runtime.evaluate', {
      expression: `(() => {
        const el = ${xpathExpr(xpath)};
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const cx = (r.left + r.width / 2);
        const cy = (r.top + r.height / 2);
        // Check if the element at this point is the target or a descendant
        const top = document.elementFromPoint(cx, cy);
        const blocked = top && !el.contains(top) && top !== el;
        return { x: cx * dpr, y: cy * dpr, blocked, cssX: cx, cssY: cy };
      })()`,
      returnByValue: true
    });
    if (result.result.value) {
      const { x, y, blocked, cssX, cssY } = result.result.value;
      if (blocked) {
        // Overlapping element detected — use JS click which always targets the element directly
        await sendCommand(tabId, 'Runtime.evaluate', {
          expression: `(${xpathExpr(xpath)}).click()`,
          returnByValue: false
        });
      } else {
        for (const type of ['mousePressed', 'mouseReleased']) {
          await sendCommand(tabId, 'Input.dispatchMouseEvent', {
            type, x, y, button: 'left', clickCount: 1
          });
        }
      }
      return;
    }
    if (Date.now() - start >= timeout) throw new Error(`Element not found for click: ${xpath}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function typeText(tabId, xpath, text) {
  await sendCommand(tabId, 'Runtime.evaluate', {
    expression: `(() => { const el = ${xpathExpr(xpath)}; if (el) { el.focus(); el.value = ''; } })()`,
    returnByValue: true
  });
  for (const char of text) {
    await sendCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await sendCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', text: char });
  }
}

async function extractText(tabId, xpath, attribute) {
  const expr = attribute
    ? `(() => { const el = ${xpathExpr(xpath)}; return el ? el.getAttribute(${JSON.stringify(attribute)}) : null; })()`
    : `(() => { const el = ${xpathExpr(xpath)}; return el ? el.textContent.trim() : null; })()`;
  const result = await sendCommand(tabId, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: true
  });
  return result.result.value;
}

async function hoverElement(tabId, xpath, timeout = 10000) {
  const start = Date.now();
  while (true) {
    if (abortedTabs.has(tabId)) throw new Error('Run aborted by user');
    const result = await sendCommand(tabId, 'Runtime.evaluate', {
      expression: `(() => {
        const el = ${xpathExpr(xpath)};
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dpr = window.devicePixelRatio || 1;
        ['mouseover', 'mouseenter', 'mousemove'].forEach(type => {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: type !== 'mouseenter',
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy
          }));
        });
        return { x: cx * dpr, y: cy * dpr };
      })()`,
      returnByValue: true
    });
    if (result.result.value) {
      const { x, y } = result.result.value;
      await sendCommand(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      return;
    }
    if (Date.now() - start >= timeout) throw new Error(`Element not found for hover: ${xpath}`);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function waitForPageLoad(tabId, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await sendCommand(tabId, 'Runtime.evaluate', {
      expression: `document.readyState`,
      returnByValue: true
    });
    if (result.result.value === 'complete') return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Page did not finish loading within ${timeout}ms`);
}

async function takeScreenshot(tabId) {
  const result = await sendCommand(tabId, 'Page.captureScreenshot', { format: 'png' });
  return result.data;
}

async function injectHijack(tabId) {
  await waitForPageLoad(tabId);
  await sendCommand(tabId, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.__loopHijacked) return;
      window.__loopHijacked = true;
      window.open = function(url) { if (url) window.location.href = url; return null; };
      document.addEventListener('click', function loopHijackClick(e) {
        const a = e.target.closest('a[target]');
        if (a && a.target && a.target !== '_self') {
          e.preventDefault();
          e.stopPropagation();
          if (a.href) window.location.href = a.href;
        }
      }, true);
    })()`,
    returnByValue: true
  });
}

async function runStep(tabId, step) {
  // Wait for page to be fully loaded before executing any step
  await waitForPageLoad(tabId);

  switch (step.type) {
    case 'navigate':
      await sendCommand(tabId, 'Page.navigate', { url: step.url });
      if (step.hijackWindows) await injectHijack(tabId);
      return { ok: true };

    case 'refresh':
      await sendCommand(tabId, 'Page.reload', {});
      if (step.hijackWindows) await injectHijack(tabId);
      return { ok: true };

    case 'waitElement':
      return await waitForElement(tabId, step.selector, step.timeout || 10000);

    case 'hover':
      await hoverElement(tabId, step.selector, step.timeout || 10000);
      return { ok: true };

    case 'click':
      await clickElement(tabId, step.selector, step.timeout || 10000);
      return { ok: true };

    case 'type':
      await typeText(tabId, step.selector, step.text);
      return { ok: true };

    case 'extract': {
      const value = await extractText(tabId, step.selector, step.attribute || null);
      return { value };
    }

    case 'scroll': {
      const deltaX = parseInt(step.deltaX) || 0;
      const deltaY = parseInt(step.deltaY) || 0;
      await sendCommand(tabId, 'Runtime.evaluate', {
        expression: `(() => {
          const el = ${step.selector ? xpathExpr(step.selector) : 'document.scrollingElement || document.body'};
          if (!el) return;
          if (typeof el.scrollBy === 'function') {
            el.scrollBy({ left: ${deltaX}, top: ${deltaY}, behavior: 'smooth' });
          } else {
            el.dispatchEvent(new WheelEvent('wheel', { deltaX: ${deltaX}, deltaY: ${deltaY}, bubbles: true }));
          }
        })()`,
        returnByValue: true
      });
      return { ok: true };
    }

    case 'waitMs':
      await new Promise(r => setTimeout(r, step.ms || 1000));
      return { ok: true };

    case 'screenshot': {
      const data = await takeScreenshot(tabId);
      return { screenshot: data };
    }

    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// Recording: port map from panel connections
const recordingPanelPorts = new Map(); // tabId -> port

chrome.runtime.onConnect.addListener(port => {
  const match = port.name.match(/^crawler-panel-(\d+)$/);
  if (!match) return;
  const inspectedTabId = parseInt(match[1], 10);
  recordingPanelPorts.set(inspectedTabId, port);
  port.onDisconnect.addListener(() => {
    recordingPanelPorts.delete(inspectedTabId);
  });
});

// Single unified message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'attachDebugger') {
    ensureAttached(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'detachDebugger') {
    detachDebugger(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'stopRun') {
    abortedTabs.add(msg.tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'runStep') {
    abortedTabs.delete(msg.tabId);
    ensureAttached(msg.tabId)
      .then(() => runStep(msg.tabId, msg.step))
      .then(result => sendResponse({ ok: true, result }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  // Relay recorded steps from content script (isolated world) to panel
  if (msg.type === 'recordedStep' && sender.tab) {
    const port = recordingPanelPorts.get(sender.tab.id);
    if (port) port.postMessage(msg);
    return false;
  }

  // Relay pickedXPath from content script to panel
  if (msg.type === 'pickedXPath' && sender.tab) {
    const port = recordingPanelPorts.get(sender.tab.id);
    if (port) port.postMessage(msg);
    return false;
  }

  if (msg.type === 'startPicking') {
    (async () => {
      try {
        const tabId = msg.tabId;
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
          sendResponse({ error: 'Cannot pick on restricted pages' });
          return;
        }
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'ISOLATED',
          files: ['picker.js'],
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }


  if (msg.type === 'startRecording') {
    (async () => {
      try {
        const tabId = msg.tabId;
        // Verify tab is accessible
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
          sendResponse({ error: 'Cannot record on restricted pages (chrome://, edge://, etc.)' });
          return;
        }
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'ISOLATED',
          func: function installRecorder() {
            if (window.__crawlerRecorder) return;
            window.__crawlerRecorder = true;
            function getXPath(node) {
              if (node.id) return '//*[@id="' + node.id + '"]';
              if (node === document.body) return '/html/body';
              const parent = node.parentNode;
              if (!parent) return '';
              const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
              const idx = siblings.indexOf(node) + 1;
              const part = node.tagName.toLowerCase() + (siblings.length > 1 ? '[' + idx + ']' : '');
              return getXPath(parent) + '/' + part;
            }
            document.addEventListener('click', function crawlerClick(e) {
              const tag = e.target.tagName;
              // Skip clicks on input/textarea/select — those are handled by the input recorder
              if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
              chrome.runtime.sendMessage({ type: 'recordedStep', step: { type: 'click', selector: getXPath(e.target) } });
            }, true);
            // Text input recording: emit a 'type' step on blur/change with the final value
            window.__crawlerLastInputXPath = null;
            window.__crawlerLastInputTimer = null;
            function flushInput(el) {
              const xpath = getXPath(el);
              const tag = el.tagName;
              if (tag === 'SELECT') {
                chrome.runtime.sendMessage({ type: 'recordedStep', step: { type: 'click', selector: xpath } });
              } else {
                const text = el.value;
                if (text) chrome.runtime.sendMessage({ type: 'recordedStep', step: { type: 'type', selector: xpath, text }, replaceKey: xpath });
              }
              window.__crawlerLastInputXPath = null;
            }
            document.addEventListener('input', function crawlerInput(e) {
              const el = e.target;
              const tag = el.tagName;
              if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
              window.__crawlerLastInputXPath = getXPath(el);
              clearTimeout(window.__crawlerLastInputTimer);
              window.__crawlerLastInputTimer = setTimeout(() => flushInput(el), 600);
            }, true);
            document.addEventListener('change', function crawlerChange(e) {
              const el = e.target;
              if (el.tagName !== 'SELECT') return;
              flushInput(el);
            }, true);
            document.addEventListener('blur', function crawlerBlur(e) {
              const el = e.target;
              const tag = el.tagName;
              if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
              clearTimeout(window.__crawlerLastInputTimer);
              if (el.value) flushInput(el);
            }, true);
          }
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === 'stopRecording') {
    (async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: msg.tabId },
          world: 'ISOLATED',
          func: function removeRecorder() {
            window.__crawlerRecorder = false;
            window.__lastHoverXPath = null;
          }
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});
