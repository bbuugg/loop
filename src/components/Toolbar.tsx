import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, StopIcon, RecordIcon, Delete01Icon, CleanIcon, Download01Icon, Upload01Icon } from '@hugeicons/core-free-icons';

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
  folderFiles: File[];
  onOpenFolder: (files: FileList) => void;
  onImportFromFolder: (f: File) => void;
}

export default function Toolbar({
  running, recording, loop,
  onRun, onStop, onLoop, onRecord,
  onClearSteps, onClearLog,
  onExport, onImport,
  folderFiles, onOpenFolder, onImportFromFolder,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0 flex-wrap"
      style={{ background: 'var(--panel-surface)', borderBottom: '1px solid var(--panel-border)' }}
    >
      {!running ? (
        <Button size="sm" onClick={onRun} style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' }}>
          <HugeiconsIcon icon={PlayIcon} size={11} /> Run
        </Button>
      ) : (
        <Button size="sm" onClick={onStop} style={{ background: 'var(--accent-danger-bg)', border: '1px solid var(--accent-danger-border)', color: 'var(--accent-danger)' }}>
          <HugeiconsIcon icon={StopIcon} size={11} /> Stop
        </Button>
      )}

      <div className="flex items-center gap-1.5 h-6 px-2 rounded-md border" style={{ background: 'var(--panel-item-bg)', borderColor: 'var(--panel-item-border)' }}>
        <Checkbox
          id="loop-check"
          checked={loop}
          onCheckedChange={v => onLoop(!!v)}
          className="size-3"
        />
        <Label htmlFor="loop-check" className="text-[11px] cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>Loop</Label>
      </div>

      <Button
        size="sm"
        onClick={onRecord}
        style={recording ? {
          background: 'var(--accent-danger-bg)',
          border: '1px solid var(--accent-danger-border)',
          color: 'var(--accent-record)',
        } : {
          background: 'var(--panel-item-bg)',
          border: '1px solid var(--panel-item-border)',
          color: 'var(--text-secondary)',
        }}
      >
        <HugeiconsIcon icon={RecordIcon} size={11} />
        {recording ? 'Stop Rec' : 'Record'}
      </Button>

      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--panel-border)' }} />

      <Button size="sm" onClick={onClearSteps} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Delete01Icon} size={11} /> Steps
      </Button>

      <Button size="sm" onClick={onClearLog} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={CleanIcon} size={11} /> Log
      </Button>

      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--panel-border)' }} />

      <Button size="sm" onClick={onExport} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Download01Icon} size={11} /> Export
      </Button>

      <Button size="sm" onClick={() => fileRef.current?.click()} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        <HugeiconsIcon icon={Upload01Icon} size={11} /> Import
      </Button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { onImport(f); e.target.value = ''; } }} />

      <div className="w-px h-4 mx-0.5" style={{ background: 'var(--panel-border)' }} />

      <Button size="sm" onClick={() => folderRef.current?.click()} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
        📁 Open Folder
      </Button>
      <input
        ref={folderRef}
        type="file"
        className="hidden"
        // @ts-ignore
        webkitdirectory=""
        mozdirectory=""
        onChange={e => { if (e.target.files?.length) { onOpenFolder(e.target.files); e.target.value = ''; } }}
      />

      {folderFiles.length > 0 && (
        <Select value="" onValueChange={v => { const idx = Number(v); if (!isNaN(idx)) onImportFromFolder(folderFiles[idx]); }}>
          <SelectTrigger className="h-6 w-40 text-[11px]">
            <SelectValue placeholder="Select JSON…" />
          </SelectTrigger>
          <SelectContent>
            {folderFiles.map((f, i) => (
              <SelectItem key={f.name} value={String(i)} className="text-[11px]">{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
