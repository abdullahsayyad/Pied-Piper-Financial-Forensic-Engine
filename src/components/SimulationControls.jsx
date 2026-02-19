export default function SimulationControls({
    isPlaying,
    timeStep,
    speed,
    onPlay,
    onPause,
    onSpeedChange,
    onInject,
    onReset,
}) {
    return (
        <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 20px',
            background: 'rgba(10, 15, 26, 0.9)',
            border: '1px solid rgba(0, 229, 255, 0.12)',
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            zIndex: 20,
            userSelect: 'none',
        }}>
            {/* Play / Pause */}
            <button
                onClick={isPlaying ? onPause : onPlay}
                style={{
                    width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPlaying ? 'rgba(255, 61, 61, 0.15)' : 'rgba(0, 229, 255, 0.12)',
                    border: `1px solid ${isPlaying ? 'rgba(255, 61, 61, 0.3)' : 'rgba(0, 229, 255, 0.25)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: isPlaying ? '#FF3D3D' : '#00E5FF',
                    transition: 'all 0.2s',
                }}
                title={isPlaying ? 'Pause' : 'Play'}
            >
                {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                )}
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

            {/* Time step display */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    T-STEP
                </span>
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 600, color: '#00E5FF' }}>
                    {String(timeStep).padStart(3, '0')}
                </span>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

            {/* Speed slider */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    SPEED
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                        type="range"
                        min="0.5"
                        max="5"
                        step="0.5"
                        value={speed}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className="sim-slider"
                        style={{ width: '70px' }}
                    />
                    <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', minWidth: '28px' }}>
                        {speed}×
                    </span>
                </div>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />

            {/* Inject button */}
            <button
                onClick={onInject}
                style={{
                    padding: '6px 14px',
                    background: 'rgba(255, 61, 61, 0.12)',
                    border: '1px solid rgba(255, 61, 61, 0.3)',
                    borderRadius: '6px',
                    color: '#FF3D3D',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 61, 61, 0.25)';
                    e.target.style.boxShadow = '0 0 12px rgba(255, 61, 61, 0.2)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 61, 61, 0.12)';
                    e.target.style.boxShadow = 'none';
                }}
                title="Inject suspicious activity into random nodes"
            >
                ⚠ Inject Threat
            </button>

            {/* Reset button */}
            <button
                onClick={onReset}
                style={{
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
                title="Reset simulation"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
            </button>
        </div>
    );
}
