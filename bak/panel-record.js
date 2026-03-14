// ── Recording ─────────────────────────────────────────────────────────────────

let recording = false;
let port = null;

function initRecord() {
  const btnRecord = document.getElementById('btn-record');

  btnRecord.addEventListener('click', async () => {
    if (!recording) {
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
}
