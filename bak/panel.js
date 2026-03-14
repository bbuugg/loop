// ── Panel entry point ────────────────────────────────────────────────────────
// Modules loaded via panel.html <script> tags (in order):
//   panel-schema.js  — STEP_SCHEMA, stepSummary, escHtml
//   panel-log.js     — log()
//   panel-vars.js    — vars, interpolate, applyVars, evalExpr, renderVars
//   panel-modal.js   — openModal, closeModal, pickStepType
//   panel-steps.js   — steps, renderSteps, markStep
//   panel-runner.js  — executeSteps, finishRun, sendMsg
//   panel-record.js  — recording
//   panel-io.js      — export/import
//   panel.js         — tabId, init

const tabId = chrome.devtools.inspectedWindow.tabId;

document.addEventListener('DOMContentLoaded', () => {
  initLog();
  initVars();
  initModal();
  initSteps();
  initRunner();
  initRecord();
  initIO();
  renderSteps();
  renderVars();
  log(`Loop ready — inspecting tab ${tabId}`, 'info');
});
