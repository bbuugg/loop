// ── Modal ────────────────────────────────────────────────────────────────────

let modalResolve = null;

function openModal(type, existing = {}) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const schema = STEP_SCHEMA[type];
    const modalTitle  = document.getElementById('modal-title');
    const modalFields = document.getElementById('modal-fields');
    const modalOverlay = document.getElementById('modal-overlay');
    modalTitle.textContent = schema.label;
    modalFields.innerHTML = '';

    // Name field (always first)
    const nameDiv = document.createElement('div');
    nameDiv.className = 'field';
    nameDiv.innerHTML = `<label>Name (optional)</label><input type="text" name="name" placeholder="e.g. Login click" value="${escHtml(existing.name || '')}">` ;
    modalFields.appendChild(nameDiv);

    schema.fields.forEach(f => {
      const div = document.createElement('div');
      div.className = 'field';
      if (f.type === 'checkbox') {
        div.innerHTML = `<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="${f.key}" ${existing[f.key] === 'true' || existing[f.key] === true ? 'checked' : ''}> ${escHtml(f.label)}</label>`;
      } else {
        div.innerHTML = `<label>${escHtml(f.label)}</label><input type="text" name="${f.key}" placeholder="${escHtml(f.placeholder || '')}" value="${escHtml(existing[f.key] || '')}">`;
      }
      modalFields.appendChild(div);
    });

    // On-error action
    const errDiv = document.createElement('div');
    errDiv.className = 'field';
    const otherSteps = steps.filter(s => s.id && s.id !== existing.id);
    const gotoOptions = otherSteps.map(s =>
      `<option value="${escHtml(s.id)}" ${existing.onErrorGoto === s.id ? 'selected' : ''}>${escHtml(s.id)}${s.name ? ' — ' + s.name : ''}</option>`
    ).join('');
    errDiv.innerHTML = `
      <label>On error</label>
      <select name="onError">
        <option value="stop" ${(!existing.onError || existing.onError === 'stop') ? 'selected' : ''}>Stop</option>
        <option value="continue" ${existing.onError === 'continue' ? 'selected' : ''}>Continue</option>
        <option value="goto" ${existing.onError === 'goto' ? 'selected' : ''}>Go to step…</option>
      </select>
      <select name="onErrorGoto" style="margin-top:4px" ${existing.onError !== 'goto' ? 'disabled' : ''}>
        <option value="">— select step —</option>
        ${gotoOptions}
      </select>`;
    errDiv.querySelector('select[name=onError]').addEventListener('change', function() {
      errDiv.querySelector('select[name=onErrorGoto]').disabled = this.value !== 'goto';
    });
    modalFields.appendChild(errDiv);

    modalOverlay.classList.add('open');
    const first = modalFields.querySelector('input');
    if (first) first.focus();
  });
}

function closeModal(result) {
  document.getElementById('modal-overlay').classList.remove('open');
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

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

function initModal() {
  document.getElementById('modal-ok').addEventListener('click', () => {
    const data = {};
    document.getElementById('modal-fields').querySelectorAll('input').forEach(inp => {
      if (inp.type === 'checkbox') data[inp.name] = inp.checked;
      else data[inp.name] = inp.value.trim();
    });
    document.getElementById('modal-fields').querySelectorAll('select').forEach(sel => { data[sel.name] = sel.value; });
    closeModal(data);
  });

  document.getElementById('modal-cancel').addEventListener('click', () => closeModal(null));

  document.getElementById('modal-fields').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('modal-ok').click();
    if (e.key === 'Escape') document.getElementById('modal-cancel').click();
  });
}
