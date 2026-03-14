import { useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, StopIcon, RecordIcon, Delete01Icon, CleanIcon, Download01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface Props {
  running: boolean;
  recording: boolean;
  loop: boolean;
  onRun: () => void;
  onStop: () => void;
  onLoop: (v: boolean) => void;
  onRecord: () => void;
  onClearSteps: () => void;
  onClearLog: () => void;
  onExport: () => void;
  onImport: (f: File) => void;
}

export default function Toolbar({ running, recording, loop, onRun, onStop, onLoop, onRecord, onClearSteps, onClearLog, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0 flex-wrap"
      style={{
        background: 'var(--panel-surface)',
        borderBottom: '1px solid var(--panel-border)',
      }}>

      {!running ? (
        <button onClick={onRun}
          className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
          style={{
            background: 'var(--accent-blue-bg)',
            border: '1px solid var(--accent-blue-border)',
            color: 'var(--accent-blue)',
          }}>
          <HugeiconsIcon icon={PlayIcon} size={11} />
          Run
        </button>
      ) : (
        <button onClick={onStop}
          className="flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
          style={{
            background: 'var(--accent-danger-bg)',
            border: '1px solid var(--accent-danger-border)',
            color: 'var(--accent-danger)',
          }}>
          <HugeiconsIcon icon={StopIcon} size={11} />
          Stop
        </button>
      )}

      <label className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] cursor-pointer select-none"
        style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={loop} onChange={e => onLoop(e.target.checked)} className="w-3 h-3" />
        Loop
      </label>

      <button onClick={onRecord}
        className={cn('flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all')}
        style={recording ? {
          background: 'var(--accent-danger-bg)',
          border: '1px solid var(--accent-danger-border)',
          color: 'var(--accent-record)',
        } : {
          background: 'var(--panel-item-bg)',
          border: '1px solid var(--panel-item-border)',
          color: 'var(--text-secondary)',
        }}>
        <HugeiconsIcon icon={RecordIcon} size={11} />
        {recording ? 'Stop Rec' : 'Record'}
      </button>

      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--panel-border)' }} />

      <button onClick={onClearSteps}
        className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] cursor-pointer transition-all"
        style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Delete01Icon} size={11} /> Steps
      </button>

      <button onClick={onClearLog}
        className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] cursor-pointer transition-all"
        style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={CleanIcon} size={11} /> Log
      </button>

      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--panel-border)' }} />

      <button onClick={onExport}
        className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] cursor-pointer transition-all"
        style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Download01Icon} size={11} /> Export
      </button>

      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] cursor-pointer transition-all"
        style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Upload01Icon} size={11} /> Import
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { onImport(f); e.target.value = ''; } }} />
    </div>
  );
}
