import { useEffect, useRef } from 'react';

export default function SystemLog({ entries }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries]);

    return (
        <div className="panel" style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: 'none',
            borderLeft: 'none',
            borderBottom: 'none',
            borderRight: 'none',
        }}>
            <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-base)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span className="led led-green" />
                <span className="label">SYSTEM LOG</span>
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '6px 10px',
                fontSize: '9px',
                lineHeight: '16px',
            }}>
                {entries.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', padding: '8px 0', fontStyle: 'italic' }}>
                        Awaiting operations...
                    </div>
                )}

                {entries.map((entry, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            gap: '8px',
                            padding: '2px 0',
                            animation: 'log-entry 0.2s ease-out',
                            color: entry.type === 'threat' ? 'var(--threat)'
                                : entry.type === 'warning' ? 'var(--elevated)'
                                    : entry.type === 'success' ? 'var(--success)'
                                        : 'var(--text-muted)',
                        }}
                    >
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{entry.time}]</span>
                        <span>{entry.message}</span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
