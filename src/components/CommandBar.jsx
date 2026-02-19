import { useRef } from 'react';

function StatusLed({ color }) {
    const cls = color === 'green' ? 'led-green' : color === 'amber' ? 'led-amber' : 'led-red';
    return <span className={`led ${cls}`} />;
}

function AlertBadge({ level }) {
    const colors = {
        LOW: { bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.3)', text: '#34D399' },
        ELEVATED: { bg: 'rgba(255, 200, 87, 0.1)', border: 'rgba(255, 200, 87, 0.3)', text: '#FFC857' },
        HIGH: { bg: 'rgba(255, 59, 59, 0.1)', border: 'rgba(255, 59, 59, 0.25)', text: '#FF3B3B' },
        CRITICAL: { bg: 'rgba(255, 59, 59, 0.18)', border: 'rgba(255, 59, 59, 0.5)', text: '#FF3B3B' },
    };
    const c = colors[level] || colors.LOW;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '4px 12px',
            background: c.bg,
            border: `1px solid ${c.border}`,
        }}>
            <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '1.5px', color: 'var(--text-label)' }}>
                ALERT LEVEL
            </span>
            <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: c.text,
                animation: level === 'CRITICAL' ? 'threat-pulse 2s ease-in-out infinite' : 'none',
            }}>
                {level}
            </span>
        </div>
    );
}

export default function CommandBar({
    datasetName,
    recordCount,
    processingTime,
    alertLevel,
    onLoadDataset,
    onExportReport,
    systemActive,
}) {
    const fileRef = useRef(null);

    return (
        <div className="panel" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            height: '44px',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            zIndex: 30,
            position: 'relative',
        }}>
            {/* Left: System Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <StatusLed color={systemActive ? 'green' : 'red'} />
                    <span className="label" style={{ fontSize: '9px' }}>
                        SYSTEM STATUS:
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: systemActive ? 'var(--success)' : 'var(--threat)', letterSpacing: '1px' }}>
                        {systemActive ? 'ACTIVE' : 'STANDBY'}
                    </span>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '20px', background: 'var(--border-base)' }} />

                {/* Dataset */}
                {datasetName && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <StatusLed color="green" />
                            <span className="label" style={{ fontSize: '8px' }}>DATASET</span>
                            <span className="value" style={{ fontSize: '10px' }}>{datasetName}</span>
                        </div>
                        <div style={{ width: '1px', height: '20px', background: 'var(--border-base)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="label" style={{ fontSize: '8px' }}>RECORDS</span>
                            <span className="value" style={{ fontSize: '10px', color: 'var(--accent)' }}>{recordCount}</span>
                        </div>
                        {processingTime && (
                            <>
                                <div style={{ width: '1px', height: '20px', background: 'var(--border-base)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="label" style={{ fontSize: '8px' }}>PROC TIME</span>
                                    <span className="value" style={{ fontSize: '10px' }}>{processingTime}ms</span>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Center: Alert Level */}
            <AlertBadge level={alertLevel} />

            {/* Right: Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) onLoadDataset(file);
                    }}
                    style={{ display: 'none' }}
                />
                <button
                    className="btn-primary"
                    onClick={() => fileRef.current?.click()}
                >
                    ▲ LOAD DATASET
                </button>
                <button
                    className="btn-primary"
                    onClick={onExportReport}
                    disabled={!datasetName}
                    style={{ opacity: datasetName ? 1 : 0.3 }}
                >
                    ▼ EXPORT INTEL REPORT
                </button>
            </div>
        </div>
    );
}
