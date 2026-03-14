import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEntry } from '../schema';

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--text-secondary)',
  ok:   'var(--accent-ok)',
  warn: 'var(--accent-warn)',
  err:  'var(--accent-danger)',
};

const LEVEL_DOT: Record<string, React.CSSProperties> = {
  info: { background: 'var(--text-muted)' },
  ok:   { background: 'var(--accent-ok)' },
  warn: { background: 'var(--accent-warn)' },
  err:  { background: 'var(--accent-danger)' },
};

export default function LogPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--panel-surface)' }}>
      <div className="flex-shrink-0 px-3 py-1.5" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Log</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 flex flex-col gap-0.5">
          {logs.map((entry, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '52px' }}>{entry.time}</span>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 translate-y-0.5" style={LEVEL_DOT[entry.level] || LEVEL_DOT.info} />
              <span className="text-[11px] break-all" style={{ color: LEVEL_COLOR[entry.level] || LEVEL_COLOR.info }}>{entry.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
