import { useMemo } from 'react';
import { detectPatterns } from '../utils/transformData';
import { riskTier, riskColor } from './GraphView';

function DossierRow({ label, value, valueColor }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid rgba(30, 42, 54, 0.5)',
        }}>
            <span className="label" style={{ fontSize: '8px' }}>{label}</span>
            <span className="value" style={{ fontSize: '11px', color: valueColor || 'var(--text-primary)' }}>{value}</span>
        </div>
    );
}

export default function IntelligencePanel({ node, suspicionMap, edges, onClose }) {
    const score = suspicionMap?.get(node?.id) || 0;
    const tier = riskTier(score);
    const color = riskColor(score);

    const patterns = useMemo(() => {
        if (!node || !edges) return [];
        return detectPatterns(node.id, edges);
    }, [node, edges]);

    const inbound = useMemo(() => {
        if (!node || !edges) return 0;
        return edges.filter((e) => e.data.target === node.id).length;
    }, [node, edges]);

    const outbound = useMemo(() => {
        if (!node || !edges) return 0;
        return edges.filter((e) => e.data.source === node.id).length;
    }, [node, edges]);

    if (!node) return null;

    return (
        <div className="panel" style={{
            width: '320px',
            minWidth: '320px',
            height: '100%',
            borderTop: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            padding: '0',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            zIndex: 10,
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-base)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`led ${score > 70 ? 'led-red' : score > 40 ? 'led-amber' : 'led-green'}`} />
                    <span className="label">ACCOUNT DOSSIER</span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: '22px', height: '22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-base)',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Account ID */}
            <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-base)',
                background: 'var(--bg-base)',
            }}>
                <span className="label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>ACCOUNT ID</span>
                <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '16px', fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '1px',
                }}>
                    {node.id}
                </span>
            </div>

            {/* Suspicion Score */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-base)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="label" style={{ fontSize: '8px' }}>SUSPICION SCORE</span>
                    <span className="value" style={{ fontSize: '13px', fontWeight: 700, color }}>{Math.round(score)} / 100</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'var(--bg-base)' }}>
                    <div style={{
                        width: `${score}%`,
                        height: '100%',
                        background: color,
                        transition: 'width 0.4s, background 0.4s',
                    }} />
                </div>
            </div>

            {/* Structured Data */}
            <div style={{ padding: '8px 14px', flex: 1 }}>
                <DossierRow label="RISK TIER" value={tier} valueColor={color} />
                <DossierRow
                    label="RING AFFILIATION"
                    value={node.ringId || 'NONE'}
                    valueColor={node.ringId ? 'var(--elevated)' : 'var(--text-muted)'}
                />
                <DossierRow
                    label="DETECTED PATTERNS"
                    value={patterns.length > 0 ? patterns.join(', ') : 'NONE'}
                    valueColor={patterns.length > 0 ? 'var(--elevated)' : 'var(--text-muted)'}
                />
                <DossierRow label="TRANSACTION VELOCITY" value={`${node.txCount || 0} tx`} />
                <DossierRow label="INBOUND CONNECTIONS" value={inbound} valueColor="var(--accent)" />
                <DossierRow label="OUTBOUND CONNECTIONS" value={outbound} valueColor="var(--accent)" />
                <DossierRow label="TOTAL INFLOW" value={`$${(node.totalReceived || 0).toLocaleString()}`} valueColor="var(--success)" />
                <DossierRow label="TOTAL OUTFLOW" value={`$${(node.totalSent || 0).toLocaleString()}`} valueColor="var(--threat)" />
                <DossierRow
                    label="NET FLOW"
                    value={`$${((node.totalReceived || 0) - (node.totalSent || 0)).toLocaleString()}`}
                />
            </div>
        </div>
    );
}
