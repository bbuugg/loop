import { useState, useEffect } from 'react';
import { STEP_SCHEMA, type Step } from '../schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  modal: { step?: Step; index?: number; insertAt?: number };
  onSave: (step: Step) => void;
  onClose: () => void;
}

export default function StepModal({ modal, onSave, onClose }: Props) {
  const [step, setStep] = useState<Step>(modal.step || { type: modal.step?.type || 'navigate' } as Step);

  useEffect(() => {
    setStep(modal.step || { type: 'navigate' } as Step);
  }, [modal]);

  const schema = STEP_SCHEMA[step.type] || { label: step.type, fields: [] };

  function setField(key: string, val: any) {
    setStep(prev => ({ ...prev, [key]: val }));
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[340px]">
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

          {/* Dynamic fields */}
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
              ) : (
                <Input
                  value={(step as any)[f.key] || ''}
                  onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}

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
                <SelectItem value="goto">Go to step</SelectItem>
              </SelectContent>
            </Select>
            {step.onError === 'goto' && (
              <Input
                className="mt-1"
                value={step.onErrorGoto || ''}
                onChange={e => setField('onErrorGoto', e.target.value)}
                placeholder="step-3"
              />
            )}
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
