import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { AddCircleIcon, Delete01Icon } from '@hugeicons/core-free-icons';
import type { Vars } from '../schema';

interface Props {
  vars: Vars;
  setVars: (fn: (prev: Vars) => Vars) => void;
}

export default function VarsPanel({ vars, setVars }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function openDialog() {
    setName('');
    setError('');
    setOpen(true);
  }

  function confirm() {
    if (!name.match(/^\w+$/)) {
      setError('Only letters, numbers and underscores allowed.');
      return;
    }
    setVars(prev => ({ ...prev, [name]: prev[name] ?? '' }));
    setOpen(false);
  }

  return (
    <>
      <div className="flex-shrink-0 px-3 py-2" style={{ borderBottom: '1px solid var(--panel-border)', background: 'var(--panel-surface)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Variables</span>
          <Button variant="ghost" size="icon" onClick={openDialog} className="w-5 h-5" style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' }}>
            <HugeiconsIcon icon={AddCircleIcon} size={12} />
          </Button>
        </div>
        {Object.keys(vars).length === 0 && (
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No variables</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(vars).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1 rounded-lg px-2 py-1"
              style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)' }}>
              <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--accent-blue)' }}>{k}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>=</span>
              <Input
                value={v}
                onChange={e => setVars(prev => ({ ...prev, [k]: e.target.value }))}
                className="h-4 w-20 text-[10px] px-1 border-0 bg-transparent p-0 focus-visible:ring-0"
                style={{ color: 'var(--text-primary)' }}
              />
              <Button variant="ghost" size="icon" onClick={() => setVars(prev => { const n = { ...prev }; delete n[k]; return n; })} className="w-4 h-4 opacity-40 hover:opacity-100" style={{ color: 'var(--accent-danger)' }}>
                <HugeiconsIcon icon={Delete01Icon} size={10} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={o => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-[280px]">
          <DialogHeader>
            <DialogTitle>Add Variable</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Input
              autoFocus
              placeholder="variable_name"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirm()}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={confirm}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
