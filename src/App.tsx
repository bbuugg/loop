import { useState, useCallback, useRef, useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { STEP_SCHEMA, stepSummary, generateId, type Step, type Vars, type LogEntry } from './schema';
import Toolbar from './components/Toolbar';
import StepsPanel from './components/StepsPanel';
import VarsPanel from './components/VarsPanel';
import LogPanel from './components/LogPanel';
import StepModal from './components/StepModal';


function sendMsg(msg: object): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: any) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
  });
}

function ts() { return new Date().toTimeString().slice(0, 8); }

function interpolate(str: string, vars: Vars): string {
  if (!str) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
}

function applyVars(step: Step, vars: Vars): Step {
  const s = { ...step };
  for (const key of ['url','selector','text','attribute','ms','timeout','deltaX','deltaY'] as const) {
    if ((s as any)[key]) (s as any)[key] = interpolate(String((s as any)[key]), vars);
  }
  return s;
}

function sandboxTransform(iframe: HTMLIFrameElement, raw: string, transform: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    function handler(e: MessageEvent) {
      if (!e.data || e.data.id !== id) return;
      window.removeEventListener('message', handler);
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error));
    }
    window.addEventListener('message', handler);
    iframe.contentWindow!.postMessage({ id, value: raw, transform }, '*');
    setTimeout(() => { window.removeEventListener('message', handler); reject(new Error('Transform timeout')); }, 5000);
  });
}

function evalExpr(expr: string, vars: Vars): string {
  try {
    const keys = Object.keys(vars);
    const vals = keys.map(k => vars[k]);
    // eslint-disable-next-line no-new-func
    return String(new Function(...keys, `return (${expr})`)(...vals));
  } catch { return expr; }
}

export default function App() {
  const [tabId, setTabId]           = useState<number>(0);
  const [steps, setSteps]           = useState<Step[]>([]);
  const [vars, setVars]             = useState<Vars>({});
  const [logs, setLogs]             = useState<LogEntry[]>([{ text: 'Loop ready', level: 'info', time: ts() }]);

  useEffect(() => {
    function refreshTabId() {
      chrome.runtime.sendMessage({ type: 'getActiveTab' }, res => {
        if (res?.tabId) setTabId(res.tabId);
      });
    }
    refreshTabId();
    chrome.tabs.onActivated.addListener(refreshTabId);
    return () => chrome.tabs.onActivated.removeListener(refreshTabId);
  }, []);

  // Reconnect port when tabId changes
  useEffect(() => {
    if (!tabId) return;
    portRef.current?.disconnect();
    portRef.current = null;
  }, [tabId]);
  const [running, setRunning]       = useState(false);
  const [loop, setLoop]             = useState(false);
  const [recording, setRecording]   = useState(false);
  const [stepStates, setStepStates] = useState<Record<string, 'running'|'done'|'error'|'skip'|null>>({});
  const [modal, setModal]           = useState<{ step?: Step; path?: number[]; insertPath?: { path: number[]; branch?: 'children'|'elseChildren' } } | null>(null);
  const stopRef = useRef(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const sandboxRef = useRef<HTMLIFrameElement | null>(null);
  const loopRef = useRef(false);
  loopRef.current = loop;
  const pickXPathCallbackRef = useRef<((xpath: string | null) => void) | null>(null);

  const addLog = useCallback((text: string, level: LogEntry['level'] = 'info') => {
    setLogs(prev => [...prev, { text, level, time: ts() }]);
  }, []);

  // ── Tree helpers ──
  // path = [i, j, k, ...] — indices into children at each level
  // branch = 'children' | 'elseChildren' for ifVar
  function getAtPath(tree: Step[], path: number[]): Step {
    let arr = tree;
    for (let d = 0; d < path.length - 1; d++) {
      const s = arr[path[d]];
      arr = (s as any).__branch === 'else' ? (s.elseChildren || []) : (s.children || []);
    }
    return arr[path[path.length - 1]];
  }

  function updateTree(tree: Step[], path: number[], branch: 'children'|'elseChildren', updater: (arr: Step[]) => Step[]): Step[] {
    if (path.length === 0) return updater(tree);
    return tree.map((s, i) => {
      if (i !== path[0]) return s;
      if (path.length === 1) {
        const arr = branch === 'elseChildren' ? (s.elseChildren || []) : (s.children || []);
        return branch === 'elseChildren'
          ? { ...s, elseChildren: updater(arr) }
          : { ...s, children: updater(arr) };
      }
      return { ...s, children: updateTree(s.children || [], path.slice(1), branch, updater) };
    });
  }

  // ── Steps ──
  function addStep(type: string, parentPath?: number[], branch?: 'children'|'elseChildren') {
    const newStep: Step = { type, id: generateId(), ...(STEP_SCHEMA[type]?.isContainer ? { children: [] } : {}), ...(type === 'ifVar' ? { elseChildren: [] } : {}) };
    setSteps(prev => updateTree(prev, parentPath || [], branch || 'children', arr => [...arr, newStep]));
  }

  function editStep(path: number[]) {
    const step = getAtPath(steps, path);
    setModal({ step: { ...step }, path });
  }

  function saveStep(step: Step) {
    const m = modal!;
    if (m.path !== undefined) {
      const p = m.path;
      setSteps(prev => updateTree(prev, p.slice(0, -1), 'children', arr =>
        arr.map((s, i) => i === p[p.length - 1] ? step : s)
      ));
    } else if (m.insertPath !== undefined) {
      const { path, branch } = m.insertPath;
      setSteps(prev => updateTree(prev, path.slice(0, -1), branch || 'children', arr => {
        const a = [...arr];
        a.splice(path[path.length - 1], 0, step);
        return a;
      }));
    } else {
      setSteps(prev => [...prev, step]);
    }
    setModal(null);
  }

  function insertStep(path: number[], type: string, branch?: 'children'|'elseChildren') {
    const newStep: Step = { type, id: generateId(), ...(STEP_SCHEMA[type]?.isContainer ? { children: [] } : {}), ...(type === 'ifVar' ? { elseChildren: [] } : {}) };
    setSteps(prev => updateTree(prev, path.slice(0, -1), branch || 'children', arr => {
      const a = [...arr];
      a.splice(path[path.length - 1], 0, newStep);
      return a;
    }));
  }

  function deleteStep(path: number[]) {
    setSteps(prev => updateTree(prev, path.slice(0, -1), 'children', arr =>
      arr.filter((_, i) => i !== path[path.length - 1])
    ));
  }

  function duplicateStep(path: number[]) {
    setSteps(prev => updateTree(prev, path.slice(0, -1), 'children', arr => {
      const a = [...arr];
      const idx = path[path.length - 1];
      a.splice(idx + 1, 0, { ...a[idx], id: generateId() });
      return a;
    }));
  }

  function toggleDisabled(path: number[]) {
    setSteps(prev => updateTree(prev, path.slice(0, -1), 'children', arr =>
      arr.map((s, i) => i === path[path.length - 1] ? { ...s, disabled: !s.disabled } : s)
    ));
  }

  function reorderSteps(parentPath: number[], branch: 'children'|'elseChildren', newArr: Step[]) {
    if (parentPath.length === 0) {
      setSteps(newArr);
    } else {
      setSteps(prev => updateTree(prev, parentPath, branch, () => newArr));
    }
  }

  // ── Run ──
  async function runSteps(stepsArr: Step[]): Promise<'stop'|'done'> {
    for (let i = 0; i < stepsArr.length; i++) {
      if (stopRef.current) { addLog('Stopped.', 'warn'); return 'stop'; }
      const step = stepsArr[i];
      const sid = step.id || `step-${i}`;
      if (step.disabled) { setStepStates(p => ({ ...p, [sid]: 'skip' })); continue; }
      setStepStates(p => ({ ...p, [sid]: 'running' }));
      const schema = STEP_SCHEMA[step.type] || { label: step.type };
      addLog(`${schema.label}${stepSummary(step) ? ' — ' + stepSummary(step) : ''}`, 'info');
      try {
        if (step.type === 'setVar') {
          const name = step.varName?.match(/^\\w+$/) ? step.varName : null;
          if (!name) throw new Error('Invalid variable name');
          const result = evalExpr(interpolate(step.varExpr || '', vars), vars);
          setVars(prev => ({ ...prev, [name]: String(result) }));
          addLog(`${name} = ${result}`, 'ok');
        } else if (step.type === 'loop') {
          addLog('Loop start.', 'info');
          while (true) {
            if (stopRef.current) break;
            const res = await runSteps(step.children || []);
            if (res === 'stop') break;
            if (step.loopExitExpr) {
              const expr = interpolate(step.loopExitExpr, vars);
              const result = evalExpr(expr, vars);
              if (result === 'true' || result === true as any) { addLog('Loop exit condition met.', 'warn'); break; }
            }
          }
        } else if (step.type === 'ifVar') {
          const expr = interpolate(step.condExpr || 'false', vars);
          const result = evalExpr(expr, vars);
          addLog(`if (${expr}) = ${result}`, 'info');
          if (result === 'true' || result === true as any) {
            const res = await runSteps(step.children || []);
            if (res === 'stop') return 'stop';
          } else {
            const res = await runSteps(step.elseChildren || []);
            if (res === 'stop') return 'stop';
          }
        } else {
          const res = await sendMsg({ type: 'runStep', tabId, step: applyVars(step, vars) });
          if (step.type === 'extract' && step.saveAs && res?.result?.value != null) {
            const raw = String(res.result.value);
            let final = raw;
            if (step.transform && sandboxRef.current) {
              final = await sandboxTransform(sandboxRef.current, raw, step.transform);
            }
            setVars(prev => ({ ...prev, [step.saveAs!]: final }));
            addLog(`${step.saveAs} = ${final}`, 'ok');
          }
          if (step.type === 'screenshot' && res?.result?.screenshot) {
            const filename = applyVars(step, vars).filename || 'screenshot.png';
            const a = document.createElement('a');
            a.href = `data:image/png;base64,${res.result.screenshot}`;
            a.download = filename;
            a.click();
            addLog(`Screenshot saved: ${filename}`, 'ok');
          }
        }
        setStepStates(p => ({ ...p, [sid]: 'done' }));
      } catch (e: any) {
        addLog(`Error: ${e.message}`, 'err');
        setStepStates(p => ({ ...p, [sid]: 'error' }));
        if ((step.onError || 'stop') === 'stop') return 'stop';
      }
    }
    return 'done';
  }

  async function run() {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    setStepStates({});
    try {
      await sendMsg({ type: 'attachDebugger', tabId });
      addLog('Debugger attached.', 'ok');
    } catch (e: any) {
      addLog(`Failed to attach: ${e.message}`, 'err');
      setRunning(false);
      return;
    }
    await runSteps(steps);
    try { await sendMsg({ type: 'detachDebugger', tabId }); } catch {}
    if (loopRef.current && !stopRef.current) {
      addLog('Loop — restarting.', 'warn');
      setTimeout(() => { if (!stopRef.current) run(); }, 500);
      return;
    }
    setRunning(false);
    addLog('Done.', 'ok');
  }

  function stop() {
    stopRef.current = true;
    setRunning(false);
  }

  // ── Port message handler ──
  function handlePortMessage(msg: any) {
    if (msg.type === 'recordedStep') {
      const newStep = { ...msg.step, id: msg.step.id || generateId() };
      if (msg.replaceKey) {
        setSteps(prev => {
          const idx = [...prev].reverse().findIndex(s => s.type === newStep.type && (s as any)._replaceKey === msg.replaceKey);
          if (idx !== -1) {
            const realIdx = prev.length - 1 - idx;
            const updated = [...prev];
            updated[realIdx] = { ...newStep, _replaceKey: msg.replaceKey };
            return updated;
          }
          return [...prev, { ...newStep, _replaceKey: msg.replaceKey }];
        });
      } else {
        setSteps(prev => [...prev, newStep]);
      }
      addLog(`Recorded: ${STEP_SCHEMA[msg.step.type]?.label || msg.step.type}`, 'warn');
    }
    if (msg.type === 'pickedXPath') {
      const cb = pickXPathCallbackRef.current;
      pickXPathCallbackRef.current = null;
      if (cb) cb(msg.xpath);
    }
  }

  function getOrCreatePort(): chrome.runtime.Port {
    if (portRef.current) return portRef.current;
    const p = chrome.runtime.connect({ name: `crawler-panel-${tabId}` });
    portRef.current = p;
    p.onMessage.addListener(handlePortMessage);
    p.onDisconnect.addListener(() => { portRef.current = null; });
    return p;
  }

  // ── Record ──
  async function toggleRecord() {
    if (!recording) {
      const p = getOrCreatePort();
      try {
        await sendMsg({ type: 'startRecording', tabId });
        setRecording(true);
        addLog('Recording started.', 'warn');
      } catch (e: any) {
        addLog(`Failed to start recording: ${e.message}`, 'err');
        p.disconnect();
        portRef.current = null;
      }
    } else {
      try { await sendMsg({ type: 'stopRecording', tabId }); } catch {}
      portRef.current?.disconnect();
      portRef.current = null;
      setRecording(false);
      addLog('Recording stopped.', 'info');
    }
  }

  // ── XPath Picker ──
  async function startPickXPath(callback: (xpath: string | null) => void) {
    const wasRecording = recording;
    if (wasRecording) {
      try { await sendMsg({ type: 'stopRecording', tabId }); } catch {}
      setRecording(false);
    }
    try {
      getOrCreatePort();
      pickXPathCallbackRef.current = (xpath) => {
        callback(xpath);
        if (wasRecording) {
          sendMsg({ type: 'startRecording', tabId })
            .then(() => setRecording(true))
            .catch(() => {});
        }
      };
      await sendMsg({ type: 'startPicking', tabId });
      addLog('Click an element on the page to pick its XPath. Press ESC to cancel.', 'info');
    } catch (e: any) {
      pickXPathCallbackRef.current = null;
      if (wasRecording) {
        sendMsg({ type: 'startRecording', tabId })
          .then(() => setRecording(true))
          .catch(() => {});
      }
      addLog(`Picker failed: ${e.message}`, 'err');
    }
  }

  // ── Run one ──
  async function runOne(path: number[]) {
    const step = getAtPath(steps, path);
    if (!step) return;
    const sid = step.id!;
    setStepStates(p => ({ ...p, [sid]: 'running' }));
    try {
      await sendMsg({ type: 'attachDebugger', tabId });
      if (step.type === 'setVar') {
        const name = step.varName?.match(/^\w+$/) ? step.varName : null;
        if (!name) throw new Error('Invalid variable name');
        const result = evalExpr(interpolate(step.varExpr || '', vars), vars);
        setVars(prev => ({ ...prev, [name]: String(result) }));
      } else {
        const res = await sendMsg({ type: 'runStep', tabId, step: applyVars(step, vars) });
        if (step.type === 'extract' && step.saveAs && res?.result?.value != null) {
          const raw = String(res.result.value);
          let final = raw;
          if (step.transform && sandboxRef.current) {
            final = await sandboxTransform(sandboxRef.current, raw, step.transform);
          }
          setVars(prev => ({ ...prev, [step.saveAs!]: final }));
          addLog(`${step.saveAs} = ${final}`, 'ok');
        }
        if (step.type === 'screenshot' && res?.result?.screenshot) {
          const filename = applyVars(step, vars).filename || 'screenshot.png';
          const a = document.createElement('a');
          a.href = `data:image/png;base64,${res.result.screenshot}`;
          a.download = filename;
          a.click();
          addLog(`Screenshot saved: ${filename}`, 'ok');
        }
      }
      setStepStates(p => ({ ...p, [sid]: 'done' }));
      addLog(`Step ok`, 'ok');
    } catch (e: any) {
      setStepStates(p => ({ ...p, [sid]: 'error' }));
      addLog(`Step error: ${e.message}`, 'err');
    }
  }

  // ── IO ──
  function exportJSON() {
    const clean = steps.map(({ _replaceKey, ...s }) => s);
    const data = JSON.stringify({ steps: clean, vars }, null, 2);
    const a = document.createElement('a');
    a.href = `data:application/json,${encodeURIComponent(data)}`;
    a.download = 'loop-steps.json';
    a.click();
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { steps: s, vars: v } = JSON.parse(e.target!.result as string);
        if (Array.isArray(s)) setSteps(s.map((st: Step) => st.id ? st : { ...st, id: generateId() }));
        if (v && typeof v === 'object') setVars(v);
        addLog('Imported.', 'ok');
      } catch { addLog('Import failed.', 'err'); }
    };
    reader.readAsText(file);
  }

  // ── Saved configs ──
  type SavedConfig = { id: string; name: string; steps: Step[]; vars: Vars };
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>(() => {
    // loaded async below
    return [];
  });

  useEffect(() => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get('savedConfigs', res => {
      if (Array.isArray(res.savedConfigs)) setSavedConfigs(res.savedConfigs);
    });
  }, []);

  function persistConfigs(configs: SavedConfig[]) {
    setSavedConfigs(configs);
    if (chrome?.storage?.local) chrome.storage.local.set({ savedConfigs: configs });
  }

  function saveConfig(name: string) {
    const clean = steps.map(({ _replaceKey, ...s }) => s);
    const existing = savedConfigs.find(c => c.name === name);
    if (existing) {
      persistConfigs(savedConfigs.map(c => c.id === existing.id ? { ...c, steps: clean, vars } : c));
    } else {
      persistConfigs([...savedConfigs, { id: generateId(), name, steps: clean, vars }]);
    }
  }

  function loadConfig(id: string) {
    const cfg = savedConfigs.find(c => c.id === id);
    if (!cfg) return;
    setSteps(cfg.steps.map(s => s.id ? s : { ...s, id: generateId() }));
    setVars(cfg.vars);
    addLog(`Loaded: ${cfg.name}`, 'ok');
  }

  function deleteConfig(id: string) {
    persistConfigs(savedConfigs.filter(c => c.id !== id));
  }

  function exportConfig(id: string) {
    const cfg = savedConfigs.find(c => c.id === id);
    if (!cfg) return;
    const data = JSON.stringify({ steps: cfg.steps, vars: cfg.vars }, null, 2);
    const a = document.createElement('a');
    a.href = `data:application/json,${encodeURIComponent(data)}`;
    a.download = `${cfg.name}.json`;
    a.click();
  }

  function importConfig(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const { steps: s, vars: v } = JSON.parse(e.target!.result as string);
        const name = file.name.replace(/\.json$/i, '');
        const newSteps = Array.isArray(s) ? s.map((st: Step) => st.id ? st : { ...st, id: generateId() }) : [];
        const newVars = v && typeof v === 'object' ? v : {};
        const existing = savedConfigs.find(c => c.name === name);
        if (existing) {
          persistConfigs(savedConfigs.map(c => c.id === existing.id ? { ...c, steps: newSteps, vars: newVars } : c));
        } else {
          persistConfigs([...savedConfigs, { id: generateId(), name, steps: newSteps, vars: newVars }]);
        }
        addLog(`Imported config: ${name}`, 'ok');
      } catch { addLog('Import failed.', 'err'); }
    };
    reader.readAsText(file);
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen overflow-hidden text-[11px]">
        <Toolbar
          running={running} recording={recording} loop={loop}
          onRun={run} onStop={stop} onLoop={setLoop}
          onRecord={toggleRecord}
          savedConfigs={savedConfigs}
          onSaveConfig={saveConfig}
          onLoadConfig={loadConfig}
          onDeleteConfig={deleteConfig}
          onExportConfig={exportConfig}
          onImportConfig={importConfig}
        />
        <div className="flex flex-1 overflow-hidden">
          <StepsPanel
            steps={steps} stepStates={stepStates}
            running={running}
            onResetStates={() => setStepStates({})}
            onClearSteps={() => setSteps([])}
            onAdd={addStep}
            onEdit={editStep}
            onDelete={deleteStep}
            onDuplicate={duplicateStep}
            onRunOne={runOne}
            onToggleDisabled={toggleDisabled}
            onReorder={reorderSteps}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <VarsPanel vars={vars} setVars={setVars} />
            <LogPanel logs={logs} onClearLog={() => setLogs([])} />
          </div>
        </div>
        {modal && (
          <StepModal
            modal={modal}
            steps={steps}
            onSave={saveStep}
            onClose={() => setModal(null)}
            onPickXPath={startPickXPath}
          />
        )}
        <iframe ref={sandboxRef} src="sandbox.html" style={{ display: 'none' }} />
      </div>
    </TooltipProvider>
  );
}
