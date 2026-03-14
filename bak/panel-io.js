// ── Export / Import ───────────────────────────────────────────────────────────

function initIO() {
  document.getElementById('btn-export').addEventListener('click', () => {
    const json = JSON.stringify({ steps, vars }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'loop-steps.json';
    a.click();
    URL.revokeObjectURL(url);
    log('Steps exported.', 'ok');
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          steps = imported;
        } else if (imported && Array.isArray(imported.steps)) {
          steps = imported.steps;
          if (imported.vars && typeof imported.vars === 'object') {
            vars = imported.vars;
            renderVars();
          }
        } else {
          throw new Error('Expected an array of steps or {steps, vars} object');
        }
        renderSteps();
        log(`Imported ${steps.length} step(s).`, 'ok');
      } catch (err) {
        log(`Import failed: ${err.message}`, 'err');
      }
    };
    reader.readAsText(file);
    document.getElementById('file-import').value = '';
  });
}
