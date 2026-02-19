/**
 * InvestigationAssistant.jsx — LLM Investigation Assistant Panel
 *
 * Side panel with chat interface for querying investigation data.
 * Uses local keyword-based responses only. No LLM, no API.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import useInvestigationAgent from '../hooks/useInvestigationAgent';
import ChatMessage from './ChatMessage';

export default function InvestigationAssistant({ isOpen, onClose, context }) {
    const { messages, isTyping, sendMessage, clearMessages } = useInvestigationAgent(context);
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // Escape key closes panel
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const handleSend = useCallback(() => {
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
    }, [input, sendMessage]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.3)',
                        zIndex: 90,
                    }}
                />
            )}

            {/* Panel */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '360px',
                height: '100vh',
                background: '#0B0F14',
                borderLeft: '1px solid #1E2A36',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.25s ease',
                boxShadow: isOpen ? '-8px 0 30px rgba(0,0,0,0.5)' : 'none',
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #1E2A36',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#C8D6E5',
                            letterSpacing: '1.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <span style={{ fontSize: '14px' }}></span>
                            INVESTIGATION AGENT
                        </div>
                        <div style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '8px',
                            color: '#4A5A6A',
                            marginTop: '3px',
                            letterSpacing: '1px',
                        }}>
                            STATUS: SIMULATION MODE
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '7px',
                            color: '#FFC857',
                            background: 'rgba(255, 200, 87, 0.08)',
                            border: '1px solid rgba(255, 200, 87, 0.15)',
                            padding: '2px 6px',
                            letterSpacing: '0.5px',
                        }}>
                            LLM PENDING
                        </span>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: '1px solid #1E2A36',
                                color: '#7A8FA3',
                                fontSize: '14px',
                                cursor: 'pointer',
                                padding: '2px 8px',
                                fontFamily: "'IBM Plex Mono', monospace",
                                lineHeight: 1,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {messages.length === 0 && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1,
                            gap: '10px',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                border: '1px solid #1E2A36',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                            }}>
                                🔍
                            </div>
                            <span style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '9px',
                                color: '#4A5A6A',
                                letterSpacing: '1px',
                                lineHeight: 1.6,
                            }}>
                                ASK ABOUT THE CURRENT<br />INVESTIGATION DATASET
                            </span>
                            <span style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '8px',
                                color: '#2E3A46',
                                marginTop: '4px',
                            }}>
                                Try: "How many accounts?" or "summary"
                            </span>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                    ))}

                    {/* Typing indicator */}
                    {isTyping && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '8px 12px',
                            marginBottom: '10px',
                        }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '4px',
                                    height: '4px',
                                    background: '#00C2FF',
                                    animation: `typing-dot 1s ease-in-out ${i * 0.15}s infinite`,
                                    opacity: 0.4,
                                }} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div style={{
                    padding: '10px 14px',
                    borderTop: '1px solid #1E2A36',
                    display: 'flex',
                    gap: '8px',
                    flexShrink: 0,
                }}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about this dataset..."
                        style={{
                            flex: 1,
                            background: '#121A22',
                            border: '1px solid #1E2A36',
                            color: '#C8D6E5',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '10px',
                            padding: '8px 10px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        style={{
                            background: input.trim() ? 'rgba(0, 194, 255, 0.08)' : 'transparent',
                            border: `1px solid ${input.trim() ? 'rgba(0, 194, 255, 0.2)' : '#1E2A36'}`,
                            color: input.trim() ? '#00C2FF' : '#2E3A46',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '9px',
                            padding: '8px 12px',
                            cursor: input.trim() ? 'pointer' : 'default',
                            letterSpacing: '1px',
                            fontWeight: 600,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        SEND
                    </button>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '6px 14px',
                    borderTop: '1px solid rgba(30, 42, 54, 0.5)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '7px',
                        color: '#2E3A46',
                        letterSpacing: '0.5px',
                    }}>
                        KEYWORD-BASED · NO LLM ACTIVE
                    </span>
                    {messages.length > 0 && (
                        <button
                            onClick={clearMessages}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#4A5A6A',
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '7px',
                                cursor: 'pointer',
                                letterSpacing: '0.5px',
                            }}
                        >
                            CLEAR
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
