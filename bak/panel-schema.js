// ── Step schema & helpers ────────────────────────────────────────────────────

const STEP_SCHEMA = {
  navigate:    { label: 'Navigate to URL',   fields: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }, { key: 'hijackWindows', label: 'Hijack new windows', type: 'checkbox' }] },
  refresh:     { label: 'Refresh Page',      fields: [{ key: 'hijackWindows', label: 'Hijack new windows', type: 'checkbox' }] },
  waitElement: { label: 'Wait for Element',  fields: [{ key: 'selector', label: 'XPath',     placeholder: '//button[@id="submit"]' }, { key: 'timeout', label: 'Timeout (ms)', placeholder: '10000' }] },
  hover:       { label: 'Hover Element',     fields: [{ key: 'selector', label: 'XPath',     placeholder: '//nav/ul/li[2]' }] },
  click:       { label: 'Click Element',     fields: [{ key: 'selector', label: 'XPath',     placeholder: '//button[text()="Login"]' }] },
  type:        { label: 'Type Text',         fields: [{ key: 'selector', label: 'XPath',     placeholder: '//input[@name="q"]' }, { key: 'text', label: 'Text', placeholder: 'hello world' }] },
  extract:     { label: 'Extract Text',      fields: [{ key: 'selector', label: 'XPath',     placeholder: '//h1' }, { key: 'attribute', label: 'Attribute (optional)', placeholder: 'href' }, { key: 'saveAs', label: 'Save as variable (optional)', placeholder: 'page' }] },
  setVar:      { label: 'Set Variable',      fields: [{ key: 'varName', label: 'Variable name', placeholder: 'page' }, { key: 'varExpr', label: 'Value or expression', placeholder: 'page + 1' }] },
  scroll:      { label: 'Scroll',            fields: [{ key: 'selector', label: 'XPath (optional)', placeholder: '//div[@class="list"]' }, { key: 'deltaX', label: 'Delta X (px)', placeholder: '0' }, { key: 'deltaY', label: 'Delta Y (px)', placeholder: '300' }] },
  waitMs:      { label: 'Wait (ms)',         fields: [{ key: 'ms',       label: 'Milliseconds',     placeholder: '1000' }] },
  screenshot:  { label: 'Screenshot',        fields: [] },
};

function stepSummary(step) {
  switch (step.type) {
    case 'refresh':     return '';
    case 'waitElement': return `${step.selector || ''}${step.timeout ? ' / ' + step.timeout + 'ms' : ''}`;
    case 'setVar':      return `${step.varName} = ${step.varExpr || ''}`;
    case 'hover':       return step.selector || '';
    case 'click':       return step.selector || '';
    case 'scroll':      return `${step.selector ? step.selector + ' ' : ''}dx:${step.deltaX||0} dy:${step.deltaY||0}`;
    case 'type':        return `${step.selector || ''} ← "${step.text || ''}"`;
    case 'extract':     return `${step.selector || ''}${step.attribute ? '[' + step.attribute + ']' : ''}`;
    case 'navigate':    return (step.url || '') + (step.hijackWindows ? ' [hijack]' : '');
    case 'waitMs':      return `${step.ms || 1000}ms`;
    case 'screenshot':  return '';
    default:            return '';
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
