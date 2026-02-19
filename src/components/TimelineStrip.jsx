import { useMemo } from 'react';

export default function TimelineStrip({ edges }) {
    // Group transactions by timestamp and compute burst data
    const bursts = useMemo(() => {
        if (!edges || edges.length === 0) return [];

        const grouped = {};
        for (const e of edges) {
            const ts = e.data.timestamp || 'unknown';
            if (!grouped[ts]) grouped[ts] = { count: 0, volume: 0 };
            grouped[ts].count += 1;
            grouped[ts].volume += e.data.amount || 0;
        }

        const entries = Object.entries(grouped)
            .map(([ts, data]) => ({ timestamp: ts, ...data }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const maxCount = Math.max(...entries.map((e) => e.count), 1);
        return entries.map((e) => ({ ...e, height: (e.count / maxCount) * 100 }));
    }, [edges]);

    return (
        <div className="panel" style={{
            display: 'flex',
            flexDirection: 'column',
            borderBottom: 'none',
            borderRight: 'none',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-base)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span className="led led-green" />
                <span className="label">TRANSACTION TIMELINE</span>
            </div>

            {/* Timeline bars */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                padding: '8px 14px',
                minHeight: 0,
            }}>
                {bursts.length === 0 ? (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', alignSelf: 'center', width: '100%', textAlign: 'center' }}>
                        NO DATA
                    </span>
                ) : (
                    bursts.map((b, i) => (
                        <div
                            key={i}
                            title={`${b.timestamp}\n${b.count} tx — $${b.volume.toLocaleString()}`}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'default',
                            }}
                        >
                            <div style={{
                                width: '100%',
                                maxWidth: '16px',
                                height: `${Math.max(b.height, 8)}%`,
                                background: b.count >= 3 ? 'var(--threat)' : b.count >= 2 ? 'var(--elevated)' : 'var(--accent)',
                                opacity: 0.7,
                                transition: 'height 0.3s',
                            }} />
                            <span style={{
                                fontSize: '7px',
                                color: 'var(--text-muted)',
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                maxHeight: '40px',
                                overflow: 'hidden',
                            }}>
                                {b.timestamp.slice(5)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
