export type Vars = Record<string, string>;

export function generateId(): string {
  return crypto.randomUUID();
}

export interface Step {
  type: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  onError?: 'stop' | 'continue' | 'goto';
  onErrorGoto?: string;
  // navigate
  url?: string;
  hijackWindows?: boolean;
  // element
  selector?: string;
  timeout?: string;
  // type
  text?: string;
  // extract
  attribute?: string;
  saveAs?: string;
  // setVar
  varName?: string;
  varExpr?: string;
  // scroll
  deltaX?: string;
  deltaY?: string;
  // waitMs
  ms?: string;
  // screenshot
  filename?: string;
  // ifVar
  condExpr?: string;
  condAction?: 'stop' | 'goto';
  condGoto?: string;
  // loop
  loopVar?: string;
  loopList?: string;
  loopSteps?: Step[];
  loopCount?: string;
  loopGoto?: string;
  [key: string]: any;
}

export interface LogEntry {
  text: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  time: string;
}

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'checkbox' | 'select' | 'step-select';
  options?: string[];
  xpath?: true;
  default?: string;
}

export interface SchemaDef {
  label: string;
  fields: FieldDef[];
}

export const STEP_SCHEMA: Record<string, SchemaDef> = {
  navigate:    { label: 'Navigate to URL',   fields: [{ key: 'url', label: 'URL', placeholder: 'https://example.com' }, { key: 'hijackWindows', label: 'Hijack new windows', type: 'checkbox' }] },
  refresh:     { label: 'Refresh Page',      fields: [{ key: 'hijackWindows', label: 'Hijack new windows', type: 'checkbox' }] },
  waitElement: { label: 'Wait for Element',  fields: [{ key: 'selector', label: 'XPath', xpath: true, placeholder: '//button[@id="submit"]' }, { key: 'timeout', label: 'Timeout (ms)', placeholder: '10000' }] },
  hover:       { label: 'Hover Element',     fields: [{ key: 'selector', label: 'XPath', xpath: true, placeholder: '//nav/ul/li[2]' }] },
  click:       { label: 'Click Element',     fields: [{ key: 'selector', label: 'XPath', xpath: true, placeholder: '//button[text()="Login"]' }] },
  type:        { label: 'Type Text',         fields: [{ key: 'selector', label: 'XPath', xpath: true, placeholder: '//input[@name="q"]' }, { key: 'text', label: 'Text', placeholder: 'hello world', default: 'hello world' }] },
  extract:     { label: 'Extract Text',      fields: [{ key: 'selector', label: 'XPath', xpath: true, placeholder: '//h1' }, { key: 'attribute', label: 'Attribute (optional)', placeholder: 'href' }, { key: 'saveAs', label: 'Save as variable (optional)', placeholder: 'page' }] },
  setVar:      { label: 'Set Variable',      fields: [{ key: 'varName', label: 'Variable name', placeholder: 'page' }, { key: 'varExpr', label: 'Value or expression', placeholder: 'page + 1' }] },
  scroll:      { label: 'Scroll',            fields: [{ key: 'selector', label: 'XPath (optional)', placeholder: '//div[@class="list"]' }, { key: 'deltaX', label: 'Delta X (px)', placeholder: '0', default: '0' }, { key: 'deltaY', label: 'Delta Y (px)', placeholder: '300', default: '300' }] },
  waitMs:      { label: 'Wait (ms)',         fields: [{ key: 'ms', label: 'Milliseconds', placeholder: '1000', default: '1000' }] },
  screenshot:  { label: 'Screenshot',        fields: [{ key: 'filename', label: 'Filename (optional)', placeholder: 'screenshot.png' }] },
  ifVar:       { label: 'If Variable',        fields: [{ key: 'condExpr', label: 'Condition (JS expression)', placeholder: 'page >= 10' }, { key: 'condAction', label: 'Action if true', type: 'select', options: ['stop', 'goto'] }, { key: 'condGoto', label: 'Go to step (if goto)', type: 'step-select' }] },
};

export function stepSummary(step: Step): string {
  switch (step.type) {
    case 'navigate':    return (step.url || '') + (step.hijackWindows ? ' [hijack]' : '');
    case 'refresh':     return step.hijackWindows ? '[hijack]' : '';
    case 'waitElement': return step.selector || '';
    case 'hover':       return step.selector || '';
    case 'click':       return step.selector || '';
    case 'type':        return `${step.selector || ''} ← "${step.text || ''}"`;
    case 'extract':     return `${step.selector || ''}${step.saveAs ? ' → ' + step.saveAs : ''}`;
    case 'setVar':      return `${step.varName || ''} = ${step.varExpr || ''}`;
    case 'scroll':      return `${step.selector ? step.selector + ' ' : ''}Δ(${step.deltaX||0}, ${step.deltaY||0})`;
    case 'waitMs':      return `${step.ms || ''}ms`;
    case 'screenshot':  return step.filename || '';
    case 'ifVar':      return `if (${step.condExpr || ''}) → ${step.condAction || 'stop'}${step.condGoto ? ' ' + step.condGoto : ''}`;
    default:            return '';
  }
}
