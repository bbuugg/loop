// ── Logging ──────────────────────────────────────────────────────────────────

let logEntries = 0;

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

  const logOutput = document.getElementById('log-output');
  const logCount  = document.getElementById('log-count');
  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
  logEntries++;
  logCount.textContent = `${logEntries} entr${logEntries !== 1 ? 'ies' : 'y'}`;
}

function initLog() {
  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('log-output').innerHTML = '';
    logEntries = 0;
    document.getElementById('log-count').textContent = '0 entries';
  });
}
