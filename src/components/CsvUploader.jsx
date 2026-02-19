import { useCallback, useState } from 'react';
import Papa from 'papaparse';

const REQUIRED_HEADERS = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];

export default function CsvUploader({ onDataParsed }) {
    const [dragOver, setDragOver] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | parsing | done | error
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');

    const parseFile = useCallback((file) => {
        if (!file || !file.name.endsWith('.csv')) {
            setStatus('error');
            setError('Please upload a .csv file');
            return;
        }

        setFileName(file.name);
        setStatus('parsing');
        setError('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Validate headers
                const headers = results.meta.fields || [];
                const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));

                if (missing.length > 0) {
                    setStatus('error');
                    setError(`Missing headers: ${missing.join(', ')}`);
                    return;
                }

                setStatus('done');
                onDataParsed(results.data);
            },
            error: (err) => {
                setStatus('error');
                setError(err.message);
            },
        });
    }, [onDataParsed]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        parseFile(file);
    }, [parseFile]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleFileInput = useCallback((e) => {
        const file = e.target.files[0];
        parseFile(file);
    }, [parseFile]);

    return (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: status === 'done' ? '#00E5FF' : '#4A5568',
                    boxShadow: status === 'done' ? '0 0 8px #00E5FF' : 'none',
                }} />
                <span style={{
                    fontSize: '10px', fontWeight: 600, letterSpacing: '2px',
                    color: 'var(--text-secondary)', textTransform: 'uppercase',
                }}>
                    Data Ingestion
                </span>
            </div>

            {/* Dropzone */}
            <label
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '28px 16px',
                    borderRadius: '8px',
                    border: `1.5px dashed ${dragOver ? 'var(--accent-cyan)' : 'rgba(0,229,255,0.15)'}`,
                    background: dragOver ? 'rgba(0,229,255,0.05)' : 'rgba(13,19,33,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />

                {/* Icon */}
                <div style={{ marginBottom: '12px' }}>
                    {status === 'done' ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    ) : status === 'parsing' ? (
                        <div style={{
                            width: '32px', height: '32px', border: '2px solid rgba(0,229,255,0.2)',
                            borderTop: '2px solid #00E5FF', borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        }} />
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    )}
                </div>

                {/* Text */}
                {status === 'idle' && (
                    <>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Drop CSV file or <span style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>browse</span>
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                            transaction_id, sender_id, receiver_id, amount, timestamp
                        </span>
                    </>
                )}

                {status === 'parsing' && (
                    <span style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>Parsing…</span>
                )}

                {status === 'done' && (
                    <span style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>
                        <span className="font-mono" style={{ fontSize: '11px' }}>{fileName}</span> loaded
                    </span>
                )}

                {status === 'error' && (
                    <span style={{ fontSize: '12px', color: 'var(--accent-crimson)' }}>
                        {error}
                    </span>
                )}
            </label>

            {/* Spin animation */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
