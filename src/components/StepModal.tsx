import { useState, useEffect } from 'react';
import { STEP_SCHEMA, type Step, type SchemaDef } from '../schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function applyDefaults(step: Step): Step {
  const schema: SchemaDef = STEP_SCHEMA[step.type] || { label: step.type, fields: [] };
  const result = { ...step };
  for (const f of schema.fields) {
    if (f.default !== undefined && (result as any)[f.key] === undefined) {
      (result as any)[f.key] = f.default;
    }
  }
  return result;
}

interface Props {
  modal: { step?: Step; path?: number[]; insertPath?: { path: number[]; branch?: 'children'|'elseChildren' } };
  steps: Step[];
  onSave: (step: Step) => void;
  onClose: () => void;
  onPickXPath: (callback: (xpath: string | null) => void) => void;
}

export default function StepModal({ modal, steps, onSave, onClose, onPickXPath }: Props) {
  const [step, setStep] = useState<Step>(applyDefaults(modal.step || { type: 'navigate' } as Step));

  useEffect(() => {
    setStep(applyDefaults(modal.step || { type: 'navigate' } as Step));
  }, [modal]);

  const schema = STEP_SCHEMA[step.type] || { label: step.type, fields: [] };

  function setField(key: string, val: any) {
    setStep(prev => ({ ...prev, [key]: val }));
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[340px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{schema.label}</DialogTitle>
          {step.id && <div className="text-[10px] font-mono text-muted-foreground">{step.id}</div>}
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Step name */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Name (optional)</Label>
            <Input
              value={step.name || ''}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g. Login button"
            />
          </div>

          {/* Dynamic fields from schema */}
          {schema.fields.map((f: any) => (
            <div key={f.key} className="flex flex-col gap-1">
              <Label className="text-xs">{f.label}</Label>
              {f.type === 'checkbox' ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={f.key}
                    checked={!!(step as any)[f.key]}
                    onCheckedChange={v => setField(f.key, !!v)}
                  />
                  <label htmlFor={f.key} className="text-xs cursor-pointer">{f.label}</label>
                </div>
              ) : f.type === 'select' ? (
                <Select value={(step as any)[f.key] || f.options?.[0] || ''} onValueChange={v => setField(f.key, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map((opt: string) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.xpath ? (
                <div className="flex gap-1">
                  <Input
                    value={(step as any)[f.key] || ''}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title="Pick element from page"
                    onClick={() => onPickXPath(xpath => { if (xpath) setField(f.key, xpath); })}
                  >🎯</Button>
                </div>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={(step as any)[f.key] || ''}
                  onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              ) : (
                <Input
                  value={(step as any)[f.key] || ''}
                  onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}

          {/* ifVar: just show condExpr; then/else branches are children in the tree */}
          {step.type === 'ifVar' && (
            <div className="flex flex-col gap-1 border rounded p-2">
              <Label className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Condition (JS expression)</Label>
              <Input
                value={step.condExpr || ''}
                onChange={e => setField('condExpr', e.target.value)}
                placeholder="e.g. count >= 10"
              />
              <p className="text-[10px] opacity-50">Add steps to the "then" and "else" branches in the steps tree.</p>
            </div>
          )}

          {/* On Error */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">On error</Label>
            <Select value={step.onError || 'stop'} onValueChange={v => setField('onError', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stop">Stop</SelectItem>
                <SelectItem value="continue">Continue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(step)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
