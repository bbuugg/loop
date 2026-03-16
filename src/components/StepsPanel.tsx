import React, { useState } from 'react';
import { STEP_SCHEMA, stepSummary, type Step } from '../schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlayIcon, PencilEdit01Icon, Delete01Icon, Copy01Icon,
  EyeIcon, EyeOff as EyeOffIcon, AddCircleIcon, ArrowDown01Icon, RefreshIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Step types shown in add menu (excludes internal/container sub-types)
const ADD_STEP_TYPES = Object.keys(STEP_SCHEMA).filter(t => t !== 'loop' && t !== 'ifVar'
  ? true : true); // all types shown; loop/ifVar are containers

const TYPE_ICON: Record<string, string> = {
  navigate: '🌐', refresh: '↺', waitElement: '⏳', hover: '🖱',
  click: '👆', type: '⌨', extract: '📤', setVar: '📝',
  scroll: '↕', waitMs: '⏱', screenshot: '📸',
  loop: '⟳', ifVar: '⑂',
};

interface TreeCallbacks {
  onAdd: (type: string, parentPath?: number[], branch?: 'children'|'elseChildren') => void;
  onEdit: (path: number[]) => void;
  onDelete: (path: number[]) => void;
  onDuplicate: (path: number[]) => void;
  onRunOne: (path: number[]) => void;
  onToggleDisabled: (path: number[]) => void;
  onReorder: (parentPath: number[], branch: 'children'|'elseChildren', newArr: Step[]) => void;
}

interface Props extends TreeCallbacks {
  steps: Step[];
  stepStates: Record<string, 'running'|'done'|'error'|'skip'|null>;
  onClearSteps: () => void;
  onResetStates: () => void;
  running?: boolean;
}

export default function StepsPanel({ steps, stepStates, onClearSteps, onResetStates, running, ...callbacks }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ parentPath?: number[]; branch?: 'children'|'elseChildren' } | null>(null);

  function openAdd(parentPath?: number[], branch?: 'children'|'elseChildren') {
    setAddTarget({ parentPath, branch });
    setAddOpen(true);
  }

  function handleAdd(type: string) {
    callbacks.onAdd(type, addTarget?.parentPath, addTarget?.branch);
    setAddOpen(false);
    setAddTarget(null);
  }

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden min-h-0" style={{ width: '260px', borderRight: '1px solid var(--panel-border)', background: 'var(--panel-surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Steps</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--panel-item-bg)', color: 'var(--text-muted)' }}>{steps.length}</span>
          <Button variant="ghost" size="icon" className="w-5 h-5" onClick={onResetStates} disabled={running} title="Reset step states">
            <HugeiconsIcon icon={RefreshIcon} size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5" onClick={onClearSteps} disabled={running} title="Clear steps">
            <HugeiconsIcon icon={Delete01Icon} size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => openAdd()} title="Add step">
            <HugeiconsIcon icon={AddCircleIcon} size={13} />
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-1.5">
        {steps.length === 0 && (
          <div className="text-center py-8 text-[11px]" style={{ color: 'var(--text-muted)' }}>No steps</div>
        )}
        <StepList
          steps={steps}
          path={[]}
          branch="children"
          stepStates={stepStates}
          callbacks={callbacks}
          onOpenAdd={openAdd}
        />
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add Step</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {ADD_STEP_TYPES.map(type => (
              <Button key={type} size="sm" variant="outline" onClick={() => handleAdd(type)}
                className="justify-start text-[11px] h-8 px-2.5">
                <span>{TYPE_ICON[type] || '•'}</span>
                <span className="ml-1.5 truncate">{STEP_SCHEMA[type]?.label || type}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepList({
  steps, path, branch, stepStates, callbacks, onOpenAdd
}: {
  steps: Step[];
  path: number[];
  branch: 'children'|'elseChildren';
  stepStates: Record<string, string|null>;
  callbacks: TreeCallbacks;
  onOpenAdd: (parentPath?: number[], branch?: 'children'|'elseChildren') => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex(s => s.id === active.id);
    const newIndex = steps.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    callbacks.onReorder(path, branch, arrayMove(steps, oldIndex, newIndex));
  }

  const ids = steps.map(s => s.id || s.type);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <SortableStepNode
              key={step.id || i}
              step={step}
              path={[...path, i]}
              stepStates={stepStates}
              callbacks={callbacks}
              onOpenAdd={onOpenAdd}
            />
          ))}
          {/* Add inside this container */}
          {path.length > 0 && (
            <button
              onClick={() => onOpenAdd(path, branch)}
              className="text-[9px] rounded px-2 py-0.5 mt-0.5 text-left opacity-40 hover:opacity-80"
              style={{ color: 'var(--text-muted)', border: '1px dashed var(--panel-border)' }}
            >+ add step</button>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableStepNode({ step, path, stepStates, callbacks, onOpenAdd }: {
  step: Step;
  path: number[];
  stepStates: Record<string, string|null>;
  callbacks: TreeCallbacks;
  onOpenAdd: (parentPath?: number[], branch?: 'children'|'elseChildren') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id || step.type });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const [collapsed, setCollapsed] = useState(false);
  const isContainer = STEP_SCHEMA[step.type]?.isContainer;
  const state = step.id ? stepStates[step.id] : null;

  const stateStyles: Record<string, { bg: string; border: string; dot: string; textColor?: string }> = {
    running: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', dot: '#f59e0b' },
    done:    { bg: 'rgba(34,197,94,0.08)',  border: '#22c55e', dot: '#22c55e' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', dot: '#ef4444', textColor: '#ef4444' },
    skip:    { bg: 'transparent',           border: 'var(--panel-item-border)', dot: 'var(--text-muted)' },
  };
  const ss = state ? stateStyles[state] : null;

  return (
    <div ref={setNodeRef} style={style}>
      {/* Step row */}
      <div
        className={cn('flex items-center gap-1 rounded-lg px-1.5 py-1 group', (step.disabled || state === 'skip') && 'opacity-40')}
        style={{
          background: ss?.bg ?? 'var(--panel-item-bg)',
          border: `1px solid ${ss?.border ?? 'var(--panel-item-border)'}`,
          minHeight: '28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Running left accent bar */}
        {state === 'running' && (
          <span className="pulse-dot" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#f59e0b', borderRadius: '4px 0 0 4px', display: 'block' }} />
        )}
        {/* State dot */}
        {state && state !== 'skip' && (
          <span className={state === 'running' ? 'pulse-dot' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: ss!.dot, flexShrink: 0, display: 'inline-block', marginLeft: state === 'running' ? 4 : 0 }} />
        )}
        {/* Drag handle */}
        <span {...attributes} {...listeners} className="cursor-grab text-[10px] opacity-30 hover:opacity-60 select-none flex-shrink-0">⠿</span>

        {/* Collapse toggle for containers */}
        {isContainer && (
          <button onClick={() => setCollapsed(c => !c)} className="flex-shrink-0 opacity-50 hover:opacity-100">
            <HugeiconsIcon icon={ArrowDown01Icon} size={9} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} />
          </button>
        )}

        {/* Icon + label */}
        <span className="flex-shrink-0 text-[11px]">{TYPE_ICON[step.type] || '•'}</span>
        <span className="flex-1 text-[10px] truncate min-w-0" style={{ color: ss?.textColor ?? (step.disabled ? 'var(--text-muted)' : 'var(--text-primary)'), fontWeight: state === 'running' ? 600 : undefined, textDecoration: state === 'skip' ? 'line-through' : undefined }}>
          {step.name || STEP_SCHEMA[step.type]?.label || step.type}
          {stepSummary(step) ? <span className="opacity-50 ml-1">{stepSummary(step)}</span> : null}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
          <IconBtn title="Run" onClick={() => callbacks.onRunOne(path)}><HugeiconsIcon icon={PlayIcon} size={9} /></IconBtn>
          <IconBtn title="Edit" onClick={() => callbacks.onEdit(path)}><HugeiconsIcon icon={PencilEdit01Icon} size={9} /></IconBtn>
          <IconBtn title="Duplicate" onClick={() => callbacks.onDuplicate(path)}><HugeiconsIcon icon={Copy01Icon} size={9} /></IconBtn>
          <IconBtn title={step.disabled ? 'Enable' : 'Disable'} onClick={() => callbacks.onToggleDisabled(path)}>
            {step.disabled ? <HugeiconsIcon icon={EyeIcon} size={9} /> : <HugeiconsIcon icon={EyeOffIcon} size={9} />}
          </IconBtn>
          <IconBtn title="Delete" onClick={() => callbacks.onDelete(path)} danger>
            <HugeiconsIcon icon={Delete01Icon} size={9} />
          </IconBtn>
        </div>
      </div>

      {/* Children (loop body / ifVar then) */}
      {isContainer && !collapsed && (
        <div className="ml-4 mt-1 mb-1" style={{ borderLeft: '2px solid var(--panel-border)', paddingLeft: '6px' }}>
          {step.type === 'ifVar' && (
            <div className="text-[9px] uppercase tracking-widest mb-0.5 px-0.5 opacity-50">then</div>
          )}
          <StepList
            steps={step.children || []}
            path={path}
            branch="children"
            stepStates={stepStates}
            callbacks={callbacks}
            onOpenAdd={onOpenAdd}
          />
          {step.type === 'ifVar' && (
            <>
              <div className="text-[9px] uppercase tracking-widest mt-1.5 mb-0.5 px-0.5 opacity-50">else</div>
              <StepList
                steps={step.elseChildren || []}
                path={path}
                branch="elseChildren"
                stepStates={stepStates}
                callbacks={callbacks}
                onOpenAdd={onOpenAdd}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn('w-5 h-5 flex items-center justify-center rounded hover:bg-white/10', danger && 'hover:text-red-400')}
          style={{ color: danger ? undefined : 'var(--text-muted)' }}
        >{children}</button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] px-1.5 py-0.5">{title}</TooltipContent>
    </Tooltip>
  );
}
