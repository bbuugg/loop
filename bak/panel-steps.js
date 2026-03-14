// ── Steps state & rendering ──────────────────────────────────────────────────

let steps = [];

function reassignIds() {
  steps.forEach((step, i) => { step.id = `step-${i + 1}`; });
}

function renderSteps() {
  reassignIds();
  const stepsList  = document.getElementById('steps-list');
  const stepsCount = document.getElementById('steps-count');
  stepsList.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-item' + (step.disabled ? ' step-disabled' : '');
    div.dataset.index = i;

    const schema  = STEP_SCHEMA[step.type] || { label: step.type, fields: [] };
    const summary = stepSummary(step);
    const nameHtml = step.name ? `<div class="step-name">${escHtml(step.name)}</div>` : '';
    const idHtml   = `<div class="step-id">${escHtml(step.id)}</div>`;
    const onErrHtml = step.onError === 'goto' && step.onErrorGoto
      ? `<div class="step-onerror">on error → ${escHtml(step.onErrorGoto)}</div>`
      : step.onError === 'continue'
      ? `<div class="step-onerror">on error → continue</div>`
      : '';

    div.innerHTML = `
      <span class="step-num" title="${escHtml(step.id)}">${i + 1}</span>
      <div class="step-body">
        ${nameHtml}
        <div class="step-type">${schema.label} <span class="step-id">${escHtml(step.id)}</span></div>
        ${summary ? `<div class="step-detail" title="${escHtml(summary)}">${escHtml(summary)}</div>` : ''}
        ${onErrHtml}
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

function markStep(index, state) {
  const stepsList = document.getElementById('steps-list');
  const el = stepsList.querySelector(`[data-index="${index}"]`);
  if (!el) return;
  el.classList.remove('running', 'done', 'error');
  if (state) el.classList.add(state);
  if (state === 'running') el.scrollIntoView({ block: 'nearest' });
}

function initSteps() {
  document.getElementById('steps-list').addEventListener('click', async e => {
    const action = e.target.dataset.action;
    const index  = parseInt(e.target.dataset.index, 10);
    if (isNaN(index)) return;

    if (action === 'run-one') {
      if (running) { log('Cannot run a single step while a run is in progress.', 'warn'); return; }
      const step   = steps[index];
      const schema = STEP_SCHEMA[step.type] || { label: step.type };
      markStep(index, 'running');
      log(`Running step ${index + 1}: ${schema.label}${stepSummary(step) ? ' — ' + stepSummary(step) : ''}`, 'info');
      try {
        if (step.type === 'setVar') {
          const name = step.varName && step.varName.match(/^\w+$/) ? step.varName : null;
          if (!name) throw new Error('Invalid variable name');
          const expr   = interpolate(step.varExpr || '');
          const result = evalExpr(expr, vars);
          vars[name]   = String(result);
          renderVars();
          markStep(index, 'done');
          log(`  → ${name} = ${vars[name]}`, 'ok');
          return;
        }
        await sendMsg({ type: 'attachDebugger', tabId });
        const res = await sendMsg({ type: 'runStep', tabId, step: applyVars(step) });
        markStep(index, 'done');
        if (res.result && res.result.value !== undefined) {
          log(`  → ${JSON.stringify(res.result.value)}`, 'data');
          if (step.saveAs && step.saveAs.match(/^\w+$/)) {
            vars[step.saveAs] = String(res.result.value);
            renderVars();
            log(`  → saved to {${step.saveAs}}`, 'ok');
          }
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
      const insertIndex = action === 'insert-before' ? index : index + 1;
      const type = await pickStepType();
      if (!type) return;
      const data = await openModal(type);
      if (!data) return;
      const step = { type, ...data };
      if (step.timeout) step.timeout = parseInt(step.timeout, 10) || 10000;
      if (step.ms)      step.ms      = parseInt(step.ms, 10)      || 1000;
      if (!step.onError || step.onError === 'stop') { delete step.onError; delete step.onErrorGoto; }
      if (step.onError !== 'goto') delete step.onErrorGoto;
      steps.splice(insertIndex, 0, step);
      renderSteps();
      return;
    }

    if (action === 'toggle-disabled') {
      steps[index].disabled = !steps[index].disabled;
      renderSteps();
    } else if (action === 'delete') {
      steps.splice(index, 1);
      renderSteps();
    } else if (action === 'edit') {
      const step = steps[index];
      const data = await openModal(step.type, step);
      if (!data) return;
      const updated = { type: step.type, id: step.id, ...data };
      if (updated.timeout) updated.timeout = parseInt(updated.timeout, 10) || 10000;
      if (updated.ms)      updated.ms      = parseInt(updated.ms, 10)      || 1000;
      if (!updated.onError || updated.onError === 'stop') { delete updated.onError; delete updated.onErrorGoto; }
      if (updated.onError !== 'goto') delete updated.onErrorGoto;
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

  document.getElementById('add-step-bar').addEventListener('click', async e => {
    const type = e.target.dataset.type;
    if (!type) return;
    const data = await openModal(type);
    if (!data) return;
    const step = { type, ...data };
    if (step.timeout) step.timeout = parseInt(step.timeout, 10) || 10000;
    if (step.ms)      step.ms      = parseInt(step.ms, 10)      || 1000;
    if (!step.onError || step.onError === 'stop') { delete step.onError; delete step.onErrorGoto; }
    if (step.onError !== 'goto') delete step.onErrorGoto;
    steps.push(step);
    renderSteps();
  });

  document.getElementById('btn-clear-steps').addEventListener('click', () => {
    steps = [];
    renderSteps();
  });
}
