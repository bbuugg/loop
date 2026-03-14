// ── Variables ────────────────────────────────────────────────────────────────

let vars = {};

function interpolate(str) {
  if (!str) return str;
  return String(str).replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
}

function applyVars(step) {
  const s = { ...step };
  for (const key of ['url', 'selector', 'text', 'attribute', 'ms', 'timeout', 'deltaX', 'deltaY']) {
    if (s[key]) s[key] = interpolate(String(s[key]));
  }
  return s;
}

function renderVars() {
  const list = document.getElementById('vars-list');
  list.innerHTML = '';
  Object.entries(vars).forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'var-row';
    row.innerHTML = `
      <span class="var-name">${escHtml(k)}</span>
      <span class="var-eq">=</span>
      <input class="var-val" data-key="${escHtml(k)}" value="${escHtml(String(v))}">
      <button class="var-del" data-key="${escHtml(k)}">✕</button>`;
    list.appendChild(row);
  });
}

function initVars() {
  document.getElementById('btn-add-var').addEventListener('click', () => {
    const name = prompt('Variable name:');
    if (!name || !name.match(/^\w+$/)) return;
    if (vars[name] === undefined) vars[name] = '';
    renderVars();
  });

  document.getElementById('vars-list').addEventListener('input', e => {
    if (e.target.classList.contains('var-val')) {
      vars[e.target.dataset.key] = e.target.value;
    }
  });

  document.getElementById('vars-list').addEventListener('click', e => {
    if (e.target.classList.contains('var-del')) {
      delete vars[e.target.dataset.key];
      renderVars();
    }
  });
}

// ── Safe expression evaluator ─────────────────────────────────────────────────
function evalExpr(expr, scope) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"' || ch === "'") {
      const q = ch; let s = ''; i++;
      while (i < expr.length && expr[i] !== q) {
        s += expr[i] === '\\' ? expr[++i] : expr[i]; i++;
      }
      i++; tokens.push({ t: 'str', v: s }); continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(expr[i+1]) && (tokens.length === 0 || tokens[tokens.length-1].t === 'op'))) {
      let n = ch; i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) { n += expr[i++]; }
      tokens.push({ t: 'num', v: parseFloat(n) }); continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = ''; while (i < expr.length && /[\w$]/.test(expr[i])) { id += expr[i++]; }
      if (id === 'true') tokens.push({ t: 'bool', v: true });
      else if (id === 'false') tokens.push({ t: 'bool', v: false });
      else tokens.push({ t: 'id', v: id });
      continue;
    }
    const two = expr.slice(i, i+2);
    if (['==','!=','<=','>='].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/<>?:'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    i++;
  }
  const vals = tokens.map(tok => {
    if (tok.t === 'id') {
      const v = scope[tok.v];
      const n = parseFloat(v);
      return { t: isNaN(n) ? 'str' : 'num', v: isNaN(n) ? String(v === undefined ? '' : v) : n };
    }
    return tok;
  });
  let vs = [...vals];
  for (let j = 0; j < vs.length; j++) {
    if (vs[j].t === 'op' && (vs[j].v === '*' || vs[j].v === '/')) {
      const l = vs[j-1].v, r = vs[j+1].v;
      const res = vs[j].v === '*' ? l * r : l / r;
      vs.splice(j-1, 3, { t: 'num', v: res }); j -= 2;
    }
  }
  for (let j = 0; j < vs.length; j++) {
    if (vs[j].t === 'op' && (vs[j].v === '+' || vs[j].v === '-')) {
      const l = vs[j-1].v, r = vs[j+1].v;
      const res = vs[j].v === '+' ? (typeof l === 'string' || typeof r === 'string' ? String(l) + String(r) : l + r) : l - r;
      vs.splice(j-1, 3, { t: typeof res === 'string' ? 'str' : 'num', v: res }); j -= 2;
    }
  }
  for (let j = 0; j < vs.length; j++) {
    if (vs[j].t === 'op' && ['==','!=','<','>','<=','>='].includes(vs[j].v)) {
      const l = vs[j-1].v, r = vs[j+1].v, op = vs[j].v;
      const res = op==='=='?l==r:op==='!='?l!=r:op==='<'?l<r:op==='>'?l>r:op==='<='?l<=r:l>=r;
      vs.splice(j-1, 3, { t: 'bool', v: res }); j -= 2;
    }
  }
  for (let j = 0; j < vs.length; j++) {
    if (vs[j].t === 'op' && vs[j].v === '?') {
      const cIdx = j+2;
      if (vs[cIdx] && vs[cIdx].t === 'op' && vs[cIdx].v === ':') {
        const res = vs[j-1].v ? vs[j+1].v : vs[cIdx+1].v;
        const rt = typeof res === 'number' ? 'num' : typeof res === 'boolean' ? 'bool' : 'str';
        vs.splice(j-1, 5, { t: rt, v: res }); j -= 2;
      }
    }
  }
  return vs[0] ? vs[0].v : '';
}
