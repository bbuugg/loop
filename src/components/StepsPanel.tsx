import React, { useState } from 'react';
import { STEP_SCHEMA, stepSummary, type Step } from '../schema';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon, PencilEdit01Icon, Delete01Icon, Copy01Icon,
  ArrowUp01Icon, ArrowDown01Icon, EyeIcon, EyeOff as EyeOffIcon, AddCircleIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

const STEP_TYPES = Object.keys(STEP_SCHEMA);

const TYPE_ICON: Record<string, string> = {
  navigate: '🌐', refresh: '↺', waitElement: '⏳', hover: '🖱',
  click: '👆', type: '⌨', extract: '📤', setVar: '📝',
  scroll: '↕', waitMs: '⏱', screenshot: '📸',
};

interface Props {
  steps: Step[];
  stepStates: Record<number, 'running'|'done'|'error'|'skip'|null>;
  onAdd: (type: string) => void;
  onEdit: (i: number) => void;
  onDelete: (i: number) => void;
  onMove: (i: number, dir: -1|1) => void;
  onDuplicate: (i: number) => void;
  onRunOne: (i: number) => void;
  onToggleDisabled: (i: number) => void;
  onInsert: (i: number, type: string) => void;
}

export default function StepsPanel({ steps, stepStates, onAdd, onEdit, onDelete, onMove, onDuplicate, onRunOne, onToggleDisabled, onInsert }: Props) {
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden min-h-0" style={{ width: '260px', borderRight: '1px solid var(--panel-border)', background: 'var(--panel-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Steps</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--panel-item-bg)', color: 'var(--text-muted)' }}>{steps.length}</span>
          <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => setAddOpen(true)} title="Add step">
            <HugeiconsIcon icon={AddCircleIcon} size={13} />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="flex flex-col gap-1 p-1.5 w-full min-w-0">
          {steps.length === 0 && (
            <div className="text-center py-8 text-[11px]" style={{ color: 'var(--text-muted)' }}>No steps</div>
          )}
          {insertingAt === 0 && (
            <InsertPicker index={0} onInsert={onInsert} onClose={() => setInsertingAt(null)} />
          )}
          {steps.map((step, i) => {
            const schema  = STEP_SCHEMA[step.type] || { label: step.type };
            const summary = stepSummary(step);
            const state   = stepStates[i];
            return (
              <React.Fragment key={i}>
              <div
                className={cn('group flex flex-col rounded-xl px-2.5 py-2 cursor-pointer transition-all min-w-0 overflow-hidden', step.disabled && 'opacity-40')}
                style={{
                  background: state === 'running' ? 'var(--accent-blue-bg)'
                    : state === 'done'    ? 'rgba(52,211,153,0.08)'
                    : state === 'error'   ? 'var(--accent-danger-bg)'
                    : 'var(--panel-item-bg)',
                  border: `1px solid ${
                    state === 'running' ? 'var(--accent-blue-border)'
                    : state === 'done'  ? 'rgba(52,211,153,0.3)'
                    : state === 'error' ? 'var(--accent-danger-border)'
                    : 'var(--panel-item-border)'}`,
                }}
                onDoubleClick={() => onEdit(i)}>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] w-4 text-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{i+1}</span>
                  <span className="text-[11px]">{TYPE_ICON[step.type] || '•'}</span>
                  <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{step.name || schema.label}</span>
                  {state === 'running' && <span className="text-[10px]" style={{ color: 'var(--accent-blue)' }}>▶</span>}
                  {state === 'done'    && <span className="text-[10px]" style={{ color: 'var(--accent-ok)' }}>✓</span>}
                  {state === 'error'   && <span className="text-[10px]" style={{ color: 'var(--accent-danger)' }}>✗</span>}
                </div>

                {summary && (
                  <div className="text-[10px] mt-0.5 truncate pl-7" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{summary}</div>
                )}

                {/* Action buttons — show on hover */}
                <div className="flex items-center gap-0.5 rounded-lg px-1 py-0.5 mt-0 flex-wrap w-full opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-100"
                  style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)' }}>
                  <IconBtn title="Insert before" onClick={() => setInsertingAt(i)}>↑+</IconBtn>
                  <IconBtn title="Insert after" onClick={() => setInsertingAt(i + 1)}>↓+</IconBtn>
                  <IconBtn title="Run" onClick={() => onRunOne(i)}><HugeiconsIcon icon={PlayIcon} size={10} /></IconBtn>
                  <IconBtn title="Edit" onClick={() => onEdit(i)}><HugeiconsIcon icon={PencilEdit01Icon} size={10} /></IconBtn>
                  <IconBtn title="Duplicate" onClick={() => onDuplicate(i)}><HugeiconsIcon icon={Copy01Icon} size={10} /></IconBtn>
                  <IconBtn title="Move up" onClick={() => onMove(i, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={10} /></IconBtn>
                  <IconBtn title="Move down" onClick={() => onMove(i, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={10} /></IconBtn>
                  <IconBtn title={step.disabled ? 'Enable' : 'Disable'} onClick={() => onToggleDisabled(i)}>
                    {step.disabled ? <HugeiconsIcon icon={EyeIcon} size={10} /> : <HugeiconsIcon icon={EyeOffIcon} size={10} />}
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => onDelete(i)} danger><HugeiconsIcon icon={Delete01Icon} size={10} /></IconBtn>
                </div>
              </div>
              {insertingAt === i + 1 && (
                <InsertPicker index={i + 1} onInsert={onInsert} onClose={() => setInsertingAt(null)} />
              )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Step</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {STEP_TYPES.map(type => (
              <Button key={type} size="sm" variant="outline" onClick={() => { onAdd(type); setAddOpen(false); }}
                className="justify-start text-[11px] h-8 px-2.5">
                <span>{TYPE_ICON[type] || '•'}</span>
                <span className="truncate">{STEP_SCHEMA[type].label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InsertPicker({ index, onInsert, onClose }: { index: number; onInsert: (i: number, type: string) => void; onClose: () => void }) {
  return (
    <div className="rounded-xl p-2" style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)' }}>
      <div className="text-[9px] uppercase tracking-widest mb-1 px-0.5" style={{ color: 'var(--text-muted)' }}>Insert at position {index + 1}</div>
      <div className="grid grid-cols-2 gap-1">
        {Object.keys(STEP_SCHEMA).map(type => (
          <Button key={type} size="sm" onClick={() => { onInsert(index, type); onClose(); }}
            className="justify-start text-[10px] h-6 px-2"
            style={{ background: 'var(--panel-item-bg)', border: '1px solid var(--panel-item-border)', color: 'var(--text-secondary)' }}>
            <span>{TYPE_ICON[type] || '•'}</span>
            <span className="truncate">{STEP_SCHEMA[type].label}</span>
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-1 text-[9px] w-full" style={{ color: 'var(--text-muted)' }}>cancel</Button>
    </div>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={e => { e.stopPropagation(); onClick(); }}
          className="w-5 h-5"
          style={{ color: danger ? 'var(--accent-danger)' : 'var(--text-secondary)' }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>{title}</p></TooltipContent>
    </Tooltip>
  );
}
