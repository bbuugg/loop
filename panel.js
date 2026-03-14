// Crawler Panel — step management, run loop, recording

const tabId = chrome.devtools.inspectedWindow.tabId;

// ── State ────────────────────────────────────────────────────────────────────
let steps = [];
let running = false;
let stopRequested = false;
// loopMode is read live from chkLoop.checked
let recording = false;
let port = null;
let logEntries = 0;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const stepsList    = document.getElementById('steps-list');
const stepsCount   = document.getElementById('steps-count');
const logOutput    = document.getElementById('log-output');
const logCount     = document.getElementById('log-count');
const btnRun       = document.getElementById('btn-run');
const chkLoop      = document.getElementById('chk-loop');
const btnRecord    = document.getElementById('btn-record');
const btnClearSteps = document.getElementById('btn-clear-steps');
const btnClearLog  = document.getElementById('btn-clear-log');
const btnExport    = document.getElementById('btn-export');
const btnImport    = document.getElementById('btn-import');
const fileImport   = document.getElementById('file-import');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle   = document.getElementById('modal-title');
const modalFields  = document.getElementById('modal-fields');
const modalOk      = document.getElementById('modal-ok');
const modalCancel  = document.getElementById('modal-cancel');

// ── Step schema ──────────────────────────────────────────────────────────────
const STEP_SCHEMA = {
  navigate:    { label: 'Navigate to URL',   fields: [{ key: 'url',      label: 'URL',              placeholder: 'https://example.com' }] },
  refresh:     { label: 'Refresh Page',      fields: [] },
  waitElement: { label: 'Wait for Element',  fields: [{ key: 'selector', label: 'XPath',     placeholder: '//button[@id="submit"]' }, { key: 'timeout', label: 'Timeout (ms)', placeholder: '10000' }] },
  hover:       { label: 'Hover Element',      fields: [{ key: 'selector', label: 'XPath',     placeholder: '//nav/ul/li[2]' }] },
  click:       { label: 'Click Element',     fields: [{ key: 'selector', label: 'XPath',     placeholder: '//button[text()="Login"]' }] },
  type:        { label: 'Type Text',         fields: [{ key: 'selector', label: 'XPath',     placeholder: '//input[@name="q"]' }, { key: 'text', label: 'Text', placeholder: 'hello world' }] },
  extract:     { label: 'Extract Text',      fields: [{ key: 'selector', label: 'XPath',     placeholder: '//h1' }, { key: 'attribute', label: 'Attribute (optional)', placeholder: 'href' }] },
  waitMs:      { label: 'Wait (ms)',         fields: [{ key: 'ms',       label: 'Milliseconds',     placeholder: '1000' }] },
  screenshot:  { label: 'Screenshot',        fields: [] },
};

function stepSummary(step) {
  switch (step.type) {
    case 'navigate':    return step.url || '';
    case 'refresh':     return '';
    case 'waitElement': return `${step.selector || ''}${step.timeout ? ' / ' + step.timeout + 'ms' : ''}`;
    case 'click':       return step.selector || '';
    case 'type':        return `${step.selector || ''} ← "${step.text || ''}"`;
    case 'extract':     return `${step.selector || ''}${step.attribute ? '[' + step.attribute + ']' : ''}`;
    case 'waitMs':      return `${step.ms || 1000}ms`;
    case 'screenshot':  return '';
    default:            return '';
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────
function renderSteps() {
  stepsList.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-item' + (step.disabled ? ' step-disabled' : '');
    div.dataset.index = i;

    const schema = STEP_SCHEMA[step.type] || { label: step.type, fields: [] };
    const summary = stepSummary(step);

    const nameHtml = step.name ? `<div class="step-name">${escHtml(step.name)}</div>` : '';
    div.innerHTML = `
      <span class="step-num">${i + 1}</span>
      <div class="step-body">
        ${nameHtml}
        <div class="step-type">${schema.label}</div>
        ${summary ? `<div class="step-detail" title="${escHtml(summary)}">${escHtml(summary)}</div>` : ''}
      </div>
      <div class="step-actions">
        <button data-action="run-one" data-index="${i}" title="Run this step">&#9654;</button>
        <button data-action="toggle-disabled" data-index="${i}" title="${step.disabled ? 'Enable' : 'Disable'} step">${step.disabled ? '✓' : '⊘'}</button>
        <button data-action="insert-before" data-index="${i}" title="Insert step before">&#8613;</button>
        <button data-action="insert-after" data-index="${i}" title="Insert step after">&#8615;</button>
        <button data-action="edit" data-index="${i}">Edit</button>
        <button data-action="delete" data-index="${i}">Del</button>
        <button data-action="up" data-index="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button data-action="down" data-index="${i}" ${i === steps.length - 1 ? 'disabled' : ''}>▼</button>
      </div>`;
    stepsList.appendChild(div);
  });
  stepsCount.textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markStep(index, state) {
  const el = stepsList.querySelector(`[data-index="${index}"]`);
  if (!el) return;
  el.classList.remove('running', 'done', 'error');
  if (state) el.classList.add(state);
  if (state === 'running') el.scrollIntoView({ block: 'nearest' });
}

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg, level = 'info') {
  const now = new Date();
  const ts = now.toTimeString().slice(0, 8);
  const line = document.createElement('div');
  line.className = `log-line ${level}`;

  if (level === 'img' && msg.startsWith('data:')) {
    const img = document.createElement('img');
    img.src = msg;
    img.style.cssText = 'max-width:100%;max-height:200px;display:block;margin:4px 0;border:1px solid #3c3c3c;';
    line.innerHTML = `<span class="log-time">${ts}</span>[screenshot]`;
    line.appendChild(img);
  } else {
    line.innerHTML = `<span class="log-time">${ts}</span>${escHtml(String(msg))}`;
  }

  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
  logEntries++;
  logCount.textContent = `${logEntries} entr${logEntries !== 1 ? 'ies' : 'y'}`;
}

// ── Modal ────────────────────────────────────────────────────────────────────
let modalResolve = null;

function openModal(type, existing = {}) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const schema = STEP_SCHEMA[type];
    modalTitle.textContent = schema.label;
    modalFields.innerHTML = '';

    // Name field (always first)
    const nameDiv = document.createElement('div');
    nameDiv.className = 'field';
    nameDiv.innerHTML = `<label>Name (optional)</label><input type="text" name="name" placeholder="e.g. Login click" value="${escHtml(existing.name || '')}">`;
    modalFields.appendChild(nameDiv);

    schema.fields.forEach(f => {
      const div = document.createElement('div');
      div.className = 'field';
      div.innerHTML = `<label>${escHtml(f.label)}</label><input type="text" name="${f.key}" placeholder="${escHtml(f.placeholder || '')}" value="${escHtml(existing[f.key] || '')}">`;
      modalFields.appendChild(div);
    });

    modalOverlay.classList.add('open');
    const first = modalFields.querySelector('input');
    if (first) first.focus();
  });
}

function closeModal(result) {
  modalOverlay.classList.remove('open');
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

modalOk.addEventListener('click', () => {
  const inputs = modalFields.querySelectorAll('input');
  const data = {};
  inputs.forEach(inp => { data[inp.name] = inp.value.trim(); });
  closeModal(data);
});

modalCancel.addEventListener('click', () => closeModal(null));

// Close on Enter in any field
modalFields.addEventListener('keydown', e => {
  if (e.key === 'Enter') modalOk.click();
  if (e.key === 'Escape') modalCancel.click();
});

// ── Step type picker ────────────────────────────────────────────────────────
function pickStepType() {
  return new Promise(resolve => {
    const types = Object.keys(STEP_SCHEMA);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#252526;border:1px solid #454545;border-radius:4px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:180px;';
    box.innerHTML = '<div style="font-size:11px;color:#ccc;margin-bottom:4px;">Choose step type</div>';
    types.forEach(t => {
      const btn = document.createElement('button');
      btn.textContent = STEP_SCHEMA[t].label;
      btn.style.cssText = 'background:#2d2d2d;border:1px solid #454545;color:#ccc;padding:4px 8px;cursor:pointer;border-radius:3px;text-align:left;';
      btn.onclick = () => { document.body.removeChild(overlay); resolve(t); };
      box.appendChild(btn);
    });
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'background:transparent;border:1px solid #454545;color:#888;padding:4px 8px;cursor:pointer;border-radius:3px;margin-top:4px;';
    cancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };
    box.appendChild(cancel);
    overlay.appendChild(box);
    overlay.onclick = e => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } };
    document.body.appendChild(overlay);
  });
}

// ── Add step buttons ─────────────────────────────────────────────────────────
document.getElementById('add-step-bar').addEventListener('click', async e => {
  const type = e.target.dataset.type;
  if (!type) return;
  const data = await openModal(type);
  if (!data) return;
  const step = { type, ...data };
  // coerce numeric fields
  if (step.timeout) step.timeout = parseInt(step.timeout, 10) || 10000;
  if (step.ms)      step.ms      = parseInt(step.ms, 10)      || 1000;
  steps.push(step);
  renderSteps();
});

// ── Step list actions (edit/delete/reorder) ───────────────────────────────────
stepsList.addEventListener('click', async e => {
  const action = e.target.dataset.action;
  const index  = parseInt(e.target.dataset.index, 10);
  if (isNaN(index)) return;

  if (action === 'run-one') {
    if (running) { log('Cannot run a single step while a run is in progress.', 'warn'); return; }
    const step = steps[index];
    const schema = STEP_SCHEMA[step.type] || { label: step.type };
    markStep(index, 'running');
    log(`Running step ${index + 1}: ${schema.label}${stepSummary(step) ? ' — ' + stepSummary(step) : ''}`, 'info');
    try {
      await sendMsg({ type: 'attachDebugger', tabId });
      const res = await sendMsg({ type: 'runStep', tabId, step });
      markStep(index, 'done');
      if (res.result && res.result.value !== undefined) {
        log(`  → ${JSON.stringify(res.result.value)}`, 'data');
      } else if (res.result && res.result.screenshot) {
        log(`data:image/png;base64,${res.result.screenshot}`, 'img');
      } else {
        log(`  → ok`, 'ok');
      }
    } catch (e) {
      markStep(index, 'error');
      log(`  ✗ ${e.message}`, 'err');
    }
    return;
  }

  if (action === 'insert-before' || action === 'insert-after') {
    const insertIndex = action === 'insert-after' ? index + 1 : index;
    // Show a type-picker: reuse add-step-bar types via a quick prompt
    const type = await pickStepType();
    if (!type) return;
    const data = await openModal(type);
    if (!data) return;
    const step = { type, ...data };
    if (step.timeout) step.timeout = parseInt(step.timeout, 10) || 10000;
    if (step.ms)      step.ms      = parseInt(step.ms, 10)      || 1000;
    steps.splice(insertIndex, 0, step);
    renderSteps();
    return;
  }

  if (action === 'toggle-disabled') {
    steps[index].disabled = !steps[index].disabled;
    renderSteps();
    return;
  }

  if (action === 'delete') {
    steps.splice(index, 1);
    renderSteps();
  } else if (action === 'edit') {
    const step = steps[index];
    const data = await openModal(step.type, step);
    if (!data) return;
    const updated = { type: step.type, ...data };
    if (updated.timeout) updated.timeout = parseInt(updated.timeout, 10) || 10000;
    if (updated.ms)      updated.ms      = parseInt(updated.ms, 10)      || 1000;
    steps[index] = updated;
    renderSteps();
  } else if (action === 'up' && index > 0) {
    [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
    renderSteps();
  } else if (action === 'down' && index < steps.length - 1) {
    [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
    renderSteps();
  }
});

// ── Background messaging ─────────────────────────────────────────────────────
function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

// ── Run loop ─────────────────────────────────────────────────────────────────
async function executeSteps() {
  stepsList.querySelectorAll('.step-item').forEach(el => {
    el.classList.remove('running', 'done', 'error');
  });
  try {
    await sendMsg({ type: 'attachDebugger', tabId });
    log('Debugger attached.', 'ok');
  } catch (e) {
    log(`Failed to attach debugger: ${e.message}`, 'err');
    return false;
  }
  for (let i = 0; i < steps.length; i++) {
    if (stopRequested) {
      log('Run stopped by user.', 'warn');
      return false;
    }
    const step = steps[i];
    if (step.disabled) { markStep(i, null); continue; }
    const schema = STEP_SCHEMA[step.type] || { label: step.type };
    markStep(i, 'running');
    log(`Step ${i + 1}: ${schema.label}${stepSummary(step) ? ' — ' + stepSummary(step) : ''}`, 'info');
    try {
      const res = await sendMsg({ type: 'runStep', tabId, step });
      markStep(i, 'done');
      if (res.result && res.result.value !== undefined) {
        log(`  → ${JSON.stringify(res.result.value)}`, 'data');
      } else if (res.result && res.result.screenshot) {
        log(`data:image/png;base64,${res.result.screenshot}`, 'img');
      } else {
        log(`  → ok`, 'ok');
      }
    } catch (e) {
      markStep(i, 'error');
      log(`  ✗ ${e.message}`, 'err');
      log('Run aborted on error.', 'err');
      return false;
    }
  }
  return true;
}

btnRun.addEventListener('click', async () => {
  if (running) {
    stopRequested = true;
    sendMsg({ type: 'stopRun', tabId }).catch(() => {});
    log('Stop requested…', 'warn');
    return;
  }
  if (steps.length === 0) { log('No steps to run.', 'warn'); return; }
  running = true;
  stopRequested = false;
  chkLoop.disabled = true;
  btnRun.textContent = '⏹ Stop';
  btnRun.classList.replace('primary', 'danger');
  log(`Starting run — ${steps.length} step(s) on tab ${tabId}`, 'info');
  if (chkLoop.checked) {
    let iteration = 0;
    while (!stopRequested) {
      iteration++;
      log(`── Loop iteration ${iteration} ──`, 'info');
      const ok = await executeSteps();
      if (!ok) break;
    }
  } else {
    await executeSteps();
  }
  finishRun();
});

function finishRun() {
  running = false;
  stopRequested = false;
  chkLoop.disabled = false;
  btnRun.textContent = '▶ Run';
  btnRun.classList.replace('danger', 'primary');
  log('Run complete.', 'ok');
}

// ── Record ───────────────────────────────────────────────────────────────────
btnRecord.addEventListener('click', async () => {
  if (!recording) {
    // Connect long-lived port so background can push recorded steps back
    port = chrome.runtime.connect({ name: `crawler-panel-${tabId}` });
    port.onMessage.addListener(msg => {
      if (msg.type === 'recordedStep') {
        steps.push(msg.step);
        renderSteps();
        log(`Recorded: ${STEP_SCHEMA[msg.step.type]?.label || msg.step.type} — ${stepSummary(msg.step)}`, 'warn');
      }
    });
    port.onDisconnect.addListener(() => { port = null; });

    try {
      await sendMsg({ type: 'startRecording', tabId });
      recording = true;
      btnRecord.classList.add('recording');
      btnRecord.textContent = '⏹ Stop Rec';
      log('Recording started — click elements in the page to record steps.', 'warn');
    } catch (e) {
      log(`Failed to start recording: ${e.message}`, 'err');
      port.disconnect();
      port = null;
    }
  } else {
    try {
      await sendMsg({ type: 'stopRecording', tabId });
    } catch (_) { /* best effort */ }
    if (port) { port.disconnect(); port = null; }
    recording = false;
    btnRecord.classList.remove('recording');
    btnRecord.textContent = '● Record';
    log('Recording stopped.', 'info');
  }
});

// ── Clear ─────────────────────────────────────────────────────────────────────
btnClearSteps.addEventListener('click', () => {
  steps = [];
  renderSteps();
});

btnClearLog.addEventListener('click', () => {
  logOutput.innerHTML = '';
  logEntries = 0;
  logCount.textContent = '0 entries';
});

// ── Export / Import ───────────────────────────────────────────────────────────
btnExport.addEventListener('click', () => {
  const json = JSON.stringify(steps, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'crawler-steps.json';
  a.click();
  URL.revokeObjectURL(url);
  log('Steps exported.', 'ok');
});

btnImport.addEventListener('click', () => fileImport.click());

fileImport.addEventListener('change', () => {
  const file = fileImport.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Expected an array of steps');
      steps = imported;
      renderSteps();
      log(`Imported ${steps.length} step(s).`, 'ok');
    } catch (err) {
      log(`Import failed: ${err.message}`, 'err');
    }
  };
  reader.readAsText(file);
  fileImport.value = '';
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderSteps();
log(`Crawler ready — inspecting tab ${tabId}`, 'info');
