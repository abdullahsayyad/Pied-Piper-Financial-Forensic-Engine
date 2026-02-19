/**
 * ChatMessage.jsx — Individual chat message bubble
 */

export default function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    const time = new Date(message.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit',
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '10px',
            animation: 'fade-in-up 0.2s ease',
        }}>
            <div style={{
                maxWidth: '85%',
                padding: '8px 12px',
                background: isUser ? 'rgba(0, 194, 255, 0.08)' : 'rgba(30, 42, 54, 0.6)',
                border: `1px solid ${isUser ? 'rgba(0, 194, 255, 0.15)' : '#1E2A36'}`,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px',
                lineHeight: '1.6',
                color: isUser ? '#C8D6E5' : '#A0B4C8',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {message.content}
            </div>
            <span style={{
                fontSize: '8px',
                color: '#4A5A6A',
                marginTop: '2px',
                fontFamily: "'IBM Plex Mono', monospace",
            }}>
                {time}
            </span>
        </div>
    );
}
