export default function PatternControls({
    patterns,
    onTogglePattern,
    isPlaying,
    speed,
    timeStep,
    onPlay,
    onPause,
    onSpeedChange,
    onInject,
    onReset,
    suspicionThreshold,
    onSuspicionThreshold,
    amountThreshold,
    onAmountThreshold,
    onSearch,
}) {
    return (
        <div className="panel" style={{
            width: '220px',
            minWidth: '220px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderTop: 'none',
            borderLeft: 'none',
            borderBottom: 'none',
            overflow: 'hidden',
        }}>
            {/* ── Pattern Isolation ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-base)' }}>
                <span className="label" style={{ display: 'block', marginBottom: '10px' }}>
                    PATTERN ISOLATION
                </span>
                {[
                    { key: 'cycles', label: 'CYCLE NETWORKS' },
                    { key: 'smurfing', label: 'SMURFING AGGREGATION' },
                    { key: 'shells', label: 'SHELL CHAIN STRUCTURES' },
                ].map(({ key, label }) => (
                    <label key={key} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '5px 0', cursor: 'pointer',
                    }}>
                        <div
                            className={`toggle-track ${patterns[key] ? 'active' : ''}`}
                            onClick={() => onTogglePattern(key)}
                        >
                            <div className="toggle-thumb" />
                        </div>
                        <span style={{
                            fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px',
                            color: patterns[key] ? 'var(--accent)' : 'var(--text-muted)',
                            transition: 'color 0.2s',
                        }}>
                            {label}
                        </span>
                    </label>
                ))}
            </div>

            {/* ── Search ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-base)' }}>
                <span className="label" style={{ display: 'block', marginBottom: '8px' }}>
                    SEARCH TARGET
                </span>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const val = e.target.elements.search.value.trim();
                    if (val) onSearch(val);
                }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{
                            position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                            fontSize: '10px', color: 'var(--text-muted)',
                        }}>
                            ›
                        </span>
                        <input
                            name="search"
                            type="text"
                            placeholder="ACCOUNT_ID"
                            style={{
                                width: '100%',
                                padding: '5px 8px 5px 20px',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-base)',
                                borderRadius: 0,
                                color: 'var(--text-primary)',
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '10px',
                                outline: 'none',
                                letterSpacing: '0.5px',
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--border-base)'}
                        />
                    </div>
                </form>
            </div>

            {/* ── Filters ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-base)' }}>
                <span className="label" style={{ display: 'block', marginBottom: '10px' }}>
                    FILTER CONTROLS
                </span>

                {/* Suspicion threshold */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>RISK THRESHOLD</span>
                        <span className="value" style={{ fontSize: '9px', color: 'var(--accent)' }}>{suspicionThreshold}</span>
                    </div>
                    <input
                        type="range" min="0" max="100" value={suspicionThreshold}
                        onChange={(e) => onSuspicionThreshold(parseInt(e.target.value))}
                        className="cmd-slider" style={{ width: '100%' }}
                    />
                </div>

                {/* Amount threshold */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>MIN AMOUNT</span>
                        <span className="value" style={{ fontSize: '9px', color: 'var(--accent)' }}>${amountThreshold}</span>
                    </div>
                    <input
                        type="range" min="0" max="5000" step="100" value={amountThreshold}
                        onChange={(e) => onAmountThreshold(parseInt(e.target.value))}
                        className="cmd-slider" style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* ── Simulation ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-base)' }}>
                <span className="label" style={{ display: 'block', marginBottom: '10px' }}>
                    SIMULATION ENGINE
                </span>

                {/* Time step */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>T-STEP</span>
                    <span className="value" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                        {String(timeStep).padStart(4, '0')}
                    </span>
                </div>

                {/* Speed */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPEED</span>
                        <span className="value" style={{ fontSize: '9px' }}>{speed}×</span>
                    </div>
                    <input
                        type="range" min="0.5" max="5" step="0.5" value={speed}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className="cmd-slider" style={{ width: '100%' }}
                    />
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        className={isPlaying ? 'btn-threat' : 'btn-primary'}
                        onClick={isPlaying ? onPause : onPlay}
                        style={{ flex: 1, padding: '5px 0', fontSize: '9px' }}
                    >
                        {isPlaying ? '■ HALT' : '▶ RUN'}
                    </button>
                    <button
                        className="btn-primary"
                        onClick={onReset}
                        style={{ padding: '5px 10px', fontSize: '9px' }}
                        title="Reset simulation"
                    >
                        ↺
                    </button>
                </div>

                {/* Inject */}
                <button
                    className="btn-threat"
                    onClick={onInject}
                    style={{ width: '100%', marginTop: '6px', padding: '5px 0', fontSize: '9px' }}
                >
                    ⚠ INJECT THREAT
                </button>
            </div>

            {/* Spacer for system log below */}
            <div style={{ flex: 1 }} />
        </div>
    );
}
