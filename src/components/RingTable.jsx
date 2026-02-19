

export default function RingTable({ rings, suspicionMap, onHoverRing, onLeaveRing }) {
    return (
        <div className="panel" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderBottom: 'none',
            borderLeft: 'none',
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
                <span className={`led ${rings.length > 0 ? 'led-amber' : 'led-green'}`} />
                <span className="label">DETECTED FINANCIAL NETWORKS</span>
                <span className="value" style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: 'auto' }}>
                    {rings.length}
                </span>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {rings.length === 0 ? (
                    <div style={{
                        padding: '20px 14px',
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        letterSpacing: '1px',
                    }}>
                        NO NETWORKS DETECTED
                    </div>
                ) : (
                    <table className="cmd-table">
                        <thead>
                            <tr>
                                <th>RING ID</th>
                                <th>PATTERN</th>
                                <th>NODES</th>
                                <th>RISK SCORE</th>
                                <th>MEMBERS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rings.map((ring) => {
                                // use passed risk score directly
                                const score = ring.riskScore;
                                let color = 'var(--success)';
                                if (score >= 80) color = 'var(--threat)';
                                else if (score >= 50) color = 'var(--elevated)';
                                else if (score >= 20) color = 'var(--warning)';

                                return (
                                    <tr
                                        key={ring.ringId}
                                        onMouseEnter={() => onHoverRing?.(ring.members)}
                                        onMouseLeave={() => onLeaveRing?.()}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{ring.ringId}</td>
                                        <td>{ring.patternType || 'CYCLE'}</td>
                                        <td style={{ color: 'var(--text-primary)' }}>{ring.members.length}</td>
                                        <td style={{ color: color, fontWeight: 600 }}>{Math.round(score)}</td>
                                        <td style={{ fontSize: '9px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ring.members.join(', ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
