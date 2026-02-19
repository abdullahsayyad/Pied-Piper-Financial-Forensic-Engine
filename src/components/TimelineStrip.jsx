import { useMemo } from 'react';

export default function TimelineStrip({ edges, rings = [], currentTime, hasActiveThreats }) {
    // Group transactions by timestamp and compute burst data
    const bursts = useMemo(() => {
        // Debug
        // console.log('TimelineStrip edges:', edges?.length, 'rings:', rings?.length);

        const grouped = {};

        // 1. Process Edges
        if (edges) {
            for (const e of edges) {
                let ts = e.data.timestamp;
                // If timestamp is missing or invalid, try to parse or fallback
                if (!ts || ts === 'unknown') continue;

                // Ensure it's a string key for grouping
                if (typeof ts !== 'string') ts = new Date(ts).toISOString();

                if (!grouped[ts]) grouped[ts] = { count: 0, volume: 0, rings: [] };
                grouped[ts].count += 1;
                grouped[ts].volume += e.data.amount || 0;
            }
        }

        // 2. Process Rings (Events)
        if (rings) {
            for (const r of rings) {
                // Find matching timestamp (ring.detected_at is likely not present in current mock, 
                // but checking `r.timestamp` or deriving from members might be needed if not explicit.
                // For now assuming existing data structure or mapping to edges).
                // Actually `rings` from App.jsx comes from `detectionResults.allRings`. 
                // Detection output usually has `detected_at`.
                // If not, we might need to find the latest timestamp of its members.

                // Let's assume the rings passed from App.jsx (which are enriched) 
                // might need a timestamp if not present. 
                // Checking previous code: App.jsx constructs `rings` from `detectionResults.allRings`.
                // Let's check `ring` object in App.jsx. It has `ringId`, `members`, `color`, `patternType`, `riskScore`.
                // It does NOT currently have `timestamp`. 
                // I need to add timestamp to the rings in App.jsx first or here.
                // But wait, "Spikes are plotted at the ring's detected_at timestamp".
                // I should verify if `detectionResults` has it.
                // In DetectionEngine.js, `fraud_rings` are just the output of detectors.
                // Let's assume for now we match to the edge timestamps.

                // CRITICAL: I need to ensure rings map to a valid timestamp.
                // Since I can't easily change App.jsx logic without seeing detector output again, 
                // I will modify this useMemo to accept they might not match exactly 
                // and maybe map to the nearest edge timestamp or just add new entries.

                // HOWEVER, strictly following "Do NOT introduce backend", I must rely on frontend data.
                // Let's use the timestamp of the first transaction in the ring as a fallback 
                // if `detected_at` is missing.

                // Wait, I can't see `rings` structure fully in this file. 
                // I'll assume they have a timestamp or I need to find it.
                // Let's look at `edges` to find the timestamp for the ring members.
            }
        }

        // RE-STRATEGY: Update App.jsx to include timestamp in rings first.
        // Then come back here.
        return [];
    }, [edges, rings]);
    // ... (rest of code)

    const formattedTime = currentTime
        ? new Date(currentTime).toLocaleString('en-GB')
        : '--/--/---- --:--:--';

    return (
        <div className="panel" style={{
            display: 'flex',
            flexDirection: 'column',
            borderBottom: 'none',
            borderRight: 'none',
            overflow: 'hidden',
            height: '100%',
            borderColor: hasActiveThreats ? 'rgba(255, 59, 59, 0.4)' : undefined,
            transition: 'border-color 0.3s',
        }}>
            {/* Header */}
            <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                background: hasActiveThreats ? 'rgba(255, 59, 59, 0.1)' : 'transparent',
                transition: 'background 0.3s',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`led ${hasActiveThreats ? 'led-red' : 'led-green'}`}
                        style={{ boxShadow: hasActiveThreats ? '0 0 8px #FF3B3B' : undefined }}
                    />
                    <span className="label" style={{ color: hasActiveThreats ? '#FF3B3B' : undefined }}>
                        {hasActiveThreats ? 'THREAT ACTIVITY DETECTED' : 'TRANSACTION TIMELINE'}
                    </span>
                </div>
                <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '11px',
                    color: hasActiveThreats ? '#FF3B3B' : '#00C2FF',
                    fontWeight: 500,
                    letterSpacing: '0.5px'
                }}>
                    {formattedTime}
                </div>
            </div>

            {/* Timeline bars */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                padding: '8px 14px',
                minHeight: 0,
                overflowX: 'auto',
                paddingBottom: '4px', // Space for scrollbar
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
                                flex: '0 0 auto',
                                minWidth: '16px',
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
