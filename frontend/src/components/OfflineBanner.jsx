import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * A sleek offline/online status banner.
 * - Slides down when connectivity is lost with amber styling
 * - Shows a brief "Back online" confirmation when reconnected
 * - Auto-dismisses after reconnection
 */
export default function OfflineBanner({ isOffline }) {
    const [visible, setVisible] = useState(false);
    const [showReconnected, setShowReconnected] = useState(false);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        if (isOffline) {
            setVisible(true);
            setShowReconnected(false);
            setWasOffline(true);
        } else if (wasOffline) {
            // Came back online — show "reconnected" briefly
            setShowReconnected(true);
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setShowReconnected(false);
                setWasOffline(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOffline, wasOffline]);

    if (!visible) return null;

    const isReconnected = showReconnected && !isOffline;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                animation: 'offlineBannerSlideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 24px',
                    margin: '12px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: isReconnected
                        ? '0 4px 24px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.15)'
                        : '0 4px 24px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.15)',
                    background: isReconnected
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))'
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(234, 88, 12, 0.95))',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    letterSpacing: '-0.01em',
                    pointerEvents: 'auto',
                    transition: 'all 0.4s ease',
                }}
            >
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.2)',
                        flexShrink: 0,
                        animation: isReconnected ? 'none' : 'offlinePulse 2s ease-in-out infinite',
                    }}
                >
                    {isReconnected ? <Wifi size={16} /> : <WifiOff size={16} />}
                </span>
                <span>
                    {isReconnected
                        ? "You're back online"
                        : "You're offline — some features may be unavailable"}
                </span>
            </div>

            <style>{`
                @keyframes offlineBannerSlideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes offlinePulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
