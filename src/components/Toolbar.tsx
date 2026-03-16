import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, StopIcon, RecordIcon, Delete01Icon, Download01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import type { Step, Vars } from '@/schema';

type SavedConfig = { id: string; name: string; steps: Step[]; vars: Vars };

interface Props {
  running: boolean;
  recording: boolean;
  loop: boolean;
  onRun: () => void;
  onStop: () => void;
  onLoop: (v: boolean) => void;
  onRecord: () => void;
  savedConfigs: SavedConfig[];
  onSaveConfig: (name: string) => void;
  onLoadConfig: (id: string) => void;
  onDeleteConfig: (id: string) => void;
  onExportConfig: (id: string) => void;
  onImportConfig: (f: File) => void;
}

export default function Toolbar({
  running, recording, loop,
  onRun, onStop, onLoop, onRecord,
  savedConfigs, onSaveConfig, onLoadConfig, onDeleteConfig, onExportConfig, onImportConfig,
}: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [open, setOpen] = useState(false);

  function handleSave() {
    const name = newName.trim();
    if (!name) return;
    onSaveConfig(name);
    setNewName('');
  }

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
        <Button size="sm" onClick={onStop} style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)' }}>
          <HugeiconsIcon icon={StopIcon} size={11} /> Stop
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Checkbox
          id="loop"
          checked={loop}
          onCheckedChange={v => onLoop(!!v)}
        />
        <Label htmlFor="loop" className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Loop</Label>
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--panel-border)', margin: '0 2px' }} />
      <Button size="sm"
        onClick={onRecord}
        style={recording
          ? { background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-border)', color: 'var(--accent-red)' }
          : { background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-muted)' }
        }>
        <HugeiconsIcon icon={RecordIcon} size={11} />
        {recording ? 'Stop Rec' : 'Record'}
      </Button>
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--panel-border)', margin: '0 2px' }} />

      {/* Configs Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-muted)' }}>
            Configs {savedConfigs.length > 0 && `(${savedConfigs.length})`}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Saved Configs</DialogTitle>
          </DialogHeader>

          {/* Save current as new config */}
          <div className="flex gap-1 mt-1">
            <input
              className="flex-1 rounded border px-2 py-1 text-[11px]"
              style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-primary)' }}
              placeholder="Config name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <Button size="sm" onClick={handleSave}
              style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' }}>
              Save Current
            </Button>
          </div>

          {/* Import from file */}
          <div className="flex gap-1">
            <Button size="sm" onClick={() => importRef.current?.click()}
              style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-muted)' }}>
              <HugeiconsIcon icon={Upload01Icon} size={11} /> Import JSON
            </Button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { onImportConfig(f); e.target.value = ''; } }} />
          </div>

          {/* Config list */}
          <div className="flex flex-col gap-1 mt-1 max-h-60 overflow-y-auto">
            {savedConfigs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>No saved configs.</div>
            ) : (
              savedConfigs.map(cfg => (
                <div key={cfg.id} className="flex items-center gap-1"
                  style={{ padding: '3px 0', borderBottom: '1px solid var(--panel-border)' }}>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cfg.name}
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{cfg.steps.length} steps</span>
                  </span>
                  <Button size="sm" onClick={() => { onLoadConfig(cfg.id); setOpen(false); }}
                    style={{ background: 'var(--accent-green-bg)', border: '1px solid var(--accent-green-border)', color: 'var(--accent-green)', fontSize: 10 }}>
                    Load
                  </Button>
                  <Button size="sm" onClick={() => onExportConfig(cfg.id)}
                    style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-muted)', fontSize: 10 }}>
                    <HugeiconsIcon icon={Download01Icon} size={10} />
                  </Button>
                  <Button size="sm" onClick={() => onDeleteConfig(cfg.id)}
                    style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-border)', color: 'var(--accent-red)', fontSize: 10 }}>
                    <HugeiconsIcon icon={Delete01Icon} size={10} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
