export default function StatsPanel({ stats, suspicionMap, ringCount }) {
    if (!stats) return null;

    let highRiskCount = 0;
    if (suspicionMap) {
        for (const [, score] of suspicionMap) {
            if (score > 70) highRiskCount++;
        }
    }

    const items = [
        { label: 'Transactions', value: stats.transactionCount.toLocaleString(), icon: '⇌', color: '#00E5FF' },
        { label: 'Accounts', value: stats.uniqueAccounts.toLocaleString(), icon: '◉', color: '#00E5FF' },
        { label: 'Total Volume', value: `$${stats.totalVolume.toLocaleString()}`, icon: '◆', color: '#00E5FF' },
        { label: 'High Risk', value: highRiskCount, icon: '⚠', color: highRiskCount > 0 ? '#FF3D3D' : '#4A5568' },
        { label: 'Active Rings', value: ringCount || 0, icon: '◎', color: ringCount > 0 ? '#FF6B35' : '#4A5568' },
    ];

    return (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#00E5FF',
                    boxShadow: '0 0 8px #00E5FF',
                }} />
                <span style={{
                    fontSize: '10px', fontWeight: 600, letterSpacing: '2px',
                    color: 'var(--text-secondary)', textTransform: 'uppercase',
                }}>
                    Network Stats
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map(({ label, value, icon, color }) => (
                    <div
                        key={label}
                        className="glass-panel"
                        style={{
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', opacity: 0.6 }}>{icon}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                {label}
                            </span>
                        </div>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color, transition: 'color 0.3s' }}>
                            {value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
