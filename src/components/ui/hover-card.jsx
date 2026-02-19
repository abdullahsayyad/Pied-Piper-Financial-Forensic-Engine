/**
 * hover-card.jsx — shadcn-style HoverCard wrapping @radix-ui/react-hover-card
 *
 * Styled to match the military command center theme.
 * Uses inline styles so no Tailwind config dependency.
 */

import * as React from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef(
    ({ children, side = 'top', sideOffset = 8, style, ...props }, ref) => (
        <HoverCardPrimitive.Portal>
            <HoverCardPrimitive.Content
                ref={ref}
                side={side}
                sideOffset={sideOffset}
                style={{
                    background: '#0F1820',
                    border: '1px solid #1E2A36',
                    borderRadius: 0,
                    padding: '10px 14px',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10px',
                    lineHeight: '1.6',
                    color: '#C8D6E5',
                    zIndex: 100,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                    minWidth: '200px',
                    maxWidth: '280px',
                    animationDuration: '150ms',
                    ...style,
                }}
                {...props}
            >
                {children}
            </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
    )
);

HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardTrigger, HoverCardContent };
