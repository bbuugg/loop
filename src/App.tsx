import { useState, useCallback, useRef } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { STEP_SCHEMA, stepSummary, type Step, type Vars, type LogEntry } from './schema';
import Toolbar from './components/Toolbar';
import StepsPanel from './components/StepsPanel';
import VarsPanel from './components/VarsPanel';
import LogPanel from './components/LogPanel';
import StepModal from './components/StepModal';

const tabId: number = typeof chrome !== 'undefined' && chrome.devtools
  ? chrome.devtools.inspectedWindow.tabId
  : 0;

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

function evalExpr(expr: string, vars: Vars): string {
  try {
    const keys = Object.keys(vars);
    const vals = keys.map(k => vars[k]);
    // eslint-disable-next-line no-new-func
    return String(new Function(...keys, `return (${expr})`)(...vals));
  } catch { return expr; }
}

export default function App() {
  const [steps, setSteps]           = useState<Step[]>([]);
  const [vars, setVars]             = useState<Vars>({});
  const [logs, setLogs]             = useState<LogEntry[]>([{ text: `Loop ready — tab ${tabId}`, level: 'info', time: ts() }]);
  const [running, setRunning]       = useState(false);
  const [loop, setLoop]             = useState(false);
  const [recording, setRecording]   = useState(false);
  const [stepStates, setStepStates] = useState<Record<number, 'running'|'done'|'error'|'skip'|null>>({});
  const [modal, setModal]           = useState<{ step?: Step; index?: number; insertAt?: number } | null>(null);
  const stopRef = useRef(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const loopRef = useRef(false);
  loopRef.current = loop;

  const addLog = useCallback((text: string, level: LogEntry['level'] = 'info') => {
    setLogs(prev => [...prev, { text, level, time: ts() }]);
  }, []);

  // ── Steps ──
  function addStep(type: string) {
    setModal({ step: { type } as Step });
  }

  function editStep(index: number) {
    setModal({ step: { ...steps[index] }, index });
  }

  function saveStep(step: Step) {
    if (modal!.index !== undefined) {
      setSteps(prev => prev.map((s, i) => i === modal!.index ? step : s));
    } else if (modal!.insertAt !== undefined) {
      setSteps(prev => { const a = [...prev]; a.splice(modal!.insertAt!, 0, step); return a; });
    } else {
      setSteps(prev => [...prev, step]);
    }
    setModal(null);
  }

  function insertStep(insertAt: number, type: string) {
    setModal({ step: { type } as Step, insertAt });
  }

  function deleteStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps(prev => {
      const a = [...prev];
      const j = index + dir;
      if (j < 0 || j >= a.length) return a;
      [a[index], a[j]] = [a[j], a[index]];
      return a;
    });
  }

  function duplicateStep(index: number) {
    setSteps(prev => {
      const a = [...prev];
      a.splice(index + 1, 0, { ...a[index] });
      return a;
    });
  }

  function toggleDisabled(index: number) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, disabled: !s.disabled } : s));
  }

  // ── Run ──
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
    let i = 0;
    while (i < steps.length) {
      if (stopRef.current) { addLog('Stopped.', 'warn'); break; }
      const step = steps[i];
      if (step.disabled) { setStepStates(p => ({ ...p, [i]: 'skip' })); i++; continue; }
      setStepStates(p => ({ ...p, [i]: 'running' }));
      const schema = STEP_SCHEMA[step.type] || { label: step.type };
      addLog(`Step ${i+1}: ${schema.label}${stepSummary(step) ? ' — ' + stepSummary(step) : ''}`, 'info');
      try {
        if (step.type === 'setVar') {
          const name = step.varName?.match(/^\w+$/) ? step.varName : null;
          if (!name) throw new Error('Invalid variable name');
          const expr = interpolate(step.varExpr || '', vars);
          const result = evalExpr(expr, vars);
          setVars(prev => ({ ...prev, [name]: String(result) }));
          addLog(`${name} = ${result}`, 'ok');
        } else if (step.type === 'ifVar') {
          const expr = interpolate(step.condExpr || 'false', vars);
          const result = evalExpr(expr, vars);
          addLog(`if (${expr}) = ${result}`, 'info');
          if (result === 'true' || result === true as any) {
            if (step.condAction === 'stop') {
              addLog('Condition met → stop.', 'warn');
              break;
            } else if (step.condAction === 'goto' && step.condGoto) {
              const idx = steps.findIndex(s => s.id === step.condGoto);
              if (idx >= 0) { addLog(`Condition met → goto ${step.condGoto}`, 'warn'); i = idx; continue; }
              else throw new Error(`Step ID not found: ${step.condGoto}`);
            }
          }
        } else {
          const res = await sendMsg({ type: 'runStep', tabId, step: applyVars(step, vars) });
          if (step.type === 'extract' && step.saveAs && res?.result?.value != null) {
            setVars(prev => ({ ...prev, [step.saveAs!]: String(res.result.value) }));
            addLog(`${step.saveAs} = ${res.result.value}`, 'ok');
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
        setStepStates(p => ({ ...p, [i]: 'done' }));
      } catch (e: any) {
        addLog(`Error: ${e.message}`, 'err');
        setStepStates(p => ({ ...p, [i]: 'error' }));
        const onErr = step.onError || 'stop';
        if (onErr === 'stop') break;
        if (onErr === 'goto' && step.onErrorGoto) {
          const idx = steps.findIndex(s => s.id === step.onErrorGoto);
          if (idx >= 0) { i = idx; continue; }
        }
      }
      i++;
    }
    try { await sendMsg({ type: 'detachDebugger', tabId }); } catch {}
    if (loopRef.current && !stopRef.current) {
      addLog('Loop — restarting.', 'warn');
      setTimeout(() => run(), 500);
      return;
    }
    setRunning(false);
    addLog('Done.', 'ok');
  }

  function stop() {
    stopRef.current = true;
    setRunning(false);
  }

  // ── Record ──
  async function toggleRecord() {
    if (!recording) {
      const p = chrome.runtime.connect({ name: `crawler-panel-${tabId}` });
      portRef.current = p;
      p.onMessage.addListener((msg: any) => {
        if (msg.type === 'recordedStep') {
          setSteps(prev => [...prev, msg.step]);
          addLog(`Recorded: ${STEP_SCHEMA[msg.step.type]?.label || msg.step.type}`, 'warn');
        }
      });
      p.onDisconnect.addListener(() => { portRef.current = null; });
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

  // ── Run one ──
  async function runOne(index: number) {
    const step = steps[index];
    if (!step) return;
    setStepStates(p => ({ ...p, [index]: 'running' }));
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
          setVars(prev => ({ ...prev, [step.saveAs!]: String(res.result.value) }));
          addLog(`${step.saveAs} = ${res.result.value}`, 'ok');
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
      setStepStates(p => ({ ...p, [index]: 'done' }));
      addLog(`Step ${index+1} ok`, 'ok');
    } catch (e: any) {
      setStepStates(p => ({ ...p, [index]: 'error' }));
      addLog(`Step ${index+1} error: ${e.message}`, 'err');
    }
  }

  // ── IO ──
  function exportJSON() {
    const data = JSON.stringify({ steps, vars }, null, 2);
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
        if (Array.isArray(s)) setSteps(s);
        if (v && typeof v === 'object') setVars(v);
        addLog('Imported.', 'ok');
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
          onClearSteps={() => setSteps([])}
          onClearLog={() => setLogs([])}
          onExport={exportJSON}
          onImport={importJSON}
        />
        <div className="flex flex-1 overflow-hidden">
          <StepsPanel
            steps={steps} stepStates={stepStates}
            onAdd={addStep} onEdit={editStep} onDelete={deleteStep}
            onMove={moveStep} onDuplicate={duplicateStep}
            onRunOne={runOne} onToggleDisabled={toggleDisabled}
            onInsert={insertStep}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <VarsPanel vars={vars} setVars={setVars} />
            <LogPanel logs={logs} />
          </div>
        </div>
        {modal && (
          <StepModal
            modal={modal}
            onSave={saveStep}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
