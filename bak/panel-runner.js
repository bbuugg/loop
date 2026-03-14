// ── Runner ────────────────────────────────────────────────────────────────────

let running = false;
let stopRequested = false;

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

async function executeSteps() {
  document.getElementById('steps-list').querySelectorAll('.step-item').forEach(el => {
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
      if (step.type === 'setVar') {
        const name = step.varName && step.varName.match(/^\w+$/) ? step.varName : null;
        if (!name) throw new Error('Invalid variable name');
        const expr   = interpolate(step.varExpr || '');
        const result = evalExpr(expr, vars);
        vars[name]   = String(result);
        renderVars();
        markStep(i, 'done');
        log(`  → ${name} = ${vars[name]}`, 'ok');
        continue;
      }
      const resolvedStep = applyVars(step);
      const res = await sendMsg({ type: 'runStep', tabId, step: resolvedStep });
      markStep(i, 'done');
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
      markStep(i, 'error');
      log(`  ✗ ${e.message}`, 'err');
      const onError = step.onError || 'stop';
      if (onError === 'continue') {
        log('  → continuing…', 'warn');
      } else if (onError === 'goto' && step.onErrorGoto) {
        const gotoIdx = steps.findIndex(s => s.id === step.onErrorGoto);
        if (gotoIdx === -1) {
          log(`  → goto target "${step.onErrorGoto}" not found, stopping.`, 'err');
          return false;
        }
        log(`  → jumping to ${step.onErrorGoto}`, 'warn');
        i = gotoIdx - 1;
      } else {
        log('Run aborted on error.', 'err');
        return false;
      }
    }
  }
  return true;
}

function finishRun() {
  running = false;
  stopRequested = false;
  document.getElementById('chk-loop').disabled = false;
  const btnRun = document.getElementById('btn-run');
  btnRun.textContent = '▶ Run';
  btnRun.classList.replace('danger', 'primary');
  btnRun.disabled = false;
  log('Run complete.', 'ok');
}

function initRunner() {
  document.getElementById('btn-run').addEventListener('click', async () => {
    const btnRun = document.getElementById('btn-run');
    const chkLoop = document.getElementById('chk-loop');
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
}
