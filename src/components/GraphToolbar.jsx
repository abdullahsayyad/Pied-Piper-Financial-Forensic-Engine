import { useState, useCallback } from 'react';

export default function GraphToolbar({
    showRings,
    onToggleRings,
    suspicionThreshold,
    onSuspicionThreshold,
    amountThreshold,
    onAmountThreshold,
    onSearch,
    onZoomIn,
    onZoomOut,
    onFit,
}) {
    const [searchValue, setSearchValue] = useState('');

    const handleSearch = useCallback((e) => {
        e.preventDefault();
        onSearch(searchValue.trim());
    }, [searchValue, onSearch]);

    return (
        <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 14px',
            background: 'rgba(10, 15, 26, 0.88)',
            border: '1px solid rgba(0, 229, 255, 0.1)',
            borderRadius: '10px',
            backdropFilter: 'blur(16px)',
            zIndex: 20,
            flexWrap: 'wrap',
        }}>
            {/* Search */}
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                        style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search account..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="font-mono"
                        style={{
                            width: '140px',
                            padding: '5px 8px 5px 28px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '5px',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            outline: 'none',
                        }}
                    />
                </div>
            </form>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Suspicion threshold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Risk
                </span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={suspicionThreshold}
                    onChange={(e) => onSuspicionThreshold(parseInt(e.target.value))}
                    className="sim-slider"
                    style={{ width: '60px' }}
                />
                <span className="font-mono" style={{ fontSize: '9px', color: 'var(--text-secondary)', minWidth: '18px' }}>
                    {suspicionThreshold}
                </span>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Amount threshold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Min $
                </span>
                <input
                    type="range"
                    min="0"
                    max="5000"
                    step="100"
                    value={amountThreshold}
                    onChange={(e) => onAmountThreshold(parseInt(e.target.value))}
                    className="sim-slider"
                    style={{ width: '60px' }}
                />
                <span className="font-mono" style={{ fontSize: '9px', color: 'var(--text-secondary)', minWidth: '28px' }}>
                    {amountThreshold}
                </span>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Fraud Ring toggle */}
            <label style={{
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
            }}>
                <div style={{
                    width: '28px', height: '16px',
                    borderRadius: '8px',
                    background: showRings ? 'rgba(255, 107, 53, 0.3)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${showRings ? 'rgba(255, 107, 53, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                    position: 'relative',
                    transition: 'all 0.2s',
                }}>
                    <div style={{
                        width: '12px', height: '12px',
                        borderRadius: '50%',
                        background: showRings ? '#FF6B35' : 'var(--text-muted)',
                        position: 'absolute',
                        top: '1px',
                        left: showRings ? '13px' : '1px',
                        transition: 'all 0.2s',
                        boxShadow: showRings ? '0 0 6px rgba(255,107,53,0.4)' : 'none',
                    }} />
                    <input
                        type="checkbox"
                        checked={showRings}
                        onChange={onToggleRings}
                        style={{ display: 'none' }}
                    />
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Rings
                </span>
            </label>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Zoom controls */}
            <div style={{ display: 'flex', gap: '4px' }}>
                {[
                    { icon: '+', action: onZoomIn, title: 'Zoom in' },
                    { icon: '−', action: onZoomOut, title: 'Zoom out' },
                    { icon: '⊡', action: onFit, title: 'Fit to view' },
                ].map(({ icon, action, title }) => (
                    <button
                        key={title}
                        onClick={action}
                        title={title}
                        style={{
                            width: '26px', height: '26px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '5px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                    >
                        {icon}
                    </button>
                ))}
            </div>
        </div>
    );
}
