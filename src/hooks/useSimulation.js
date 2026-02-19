import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useSimulation — Time-stepped suspicion propagation engine
 *
 * Manages suspicion scores across the network, propagating suspicion
 * from high-risk nodes to neighbors over time steps.
 */
export default function useSimulation(nodes, edges) {
    const [timeStep, setTimeStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [suspicionMap, setSuspicionMap] = useState(() => new Map());
    const [activeEdges, setActiveEdges] = useState(() => new Set());

    const intervalRef = useRef(null);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    // Keep refs in sync
    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [nodes, edges]);

    // Initialize suspicion scores when nodes change
    useEffect(() => {
        if (nodes.length === 0) return;
        const map = new Map();
        for (const n of nodes) {
            map.set(n.data.id, 0);
        }
        setSuspicionMap(map);
        setTimeStep(0);
        setActiveEdges(new Set());
    }, [nodes]);

    // Propagation tick
    const tick = useCallback(() => {
        setSuspicionMap((prev) => {
            const next = new Map(prev);
            const currentEdges = edgesRef.current;
            const newActive = new Set();

            // Build outflow totals per node
            const outflow = new Map();
            for (const e of currentEdges) {
                const src = e.data.source;
                const amt = e.data.amount || 1;
                outflow.set(src, (outflow.get(src) || 0) + amt);
            }

            // Propagate suspicion along edges
            for (const e of currentEdges) {
                const src = e.data.source;
                const tgt = e.data.target;
                const amt = e.data.amount || 1;
                const srcScore = prev.get(src) || 0;

                if (srcScore > 15) {
                    const totalOut = outflow.get(src) || 1;
                    const weight = amt / totalOut;
                    const decay = 0.3;
                    const spread = srcScore * weight * decay;
                    const currentTgt = next.get(tgt) || 0;
                    next.set(tgt, Math.min(100, currentTgt + spread));

                    // Mark edge as active if meaningful suspicion flows
                    if (spread > 2) {
                        newActive.add(e.data.id);
                    }
                }
            }

            // Natural decay: all scores drift slightly toward 0
            for (const [id, score] of next) {
                if (score > 0) {
                    next.set(id, Math.max(0, score - 0.3));
                }
            }

            setActiveEdges(newActive);
            return next;
        });

        setTimeStep((t) => t + 1);
    }, []);

    // Play/pause loop
    useEffect(() => {
        if (isPlaying) {
            const ms = Math.max(80, 500 / speed);
            intervalRef.current = setInterval(tick, ms);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, speed, tick]);

    const play = useCallback(() => setIsPlaying(true), []);
    const pause = useCallback(() => setIsPlaying(false), []);

    const injectSuspicious = useCallback(() => {
        setSuspicionMap((prev) => {
            if (prev.size === 0) return prev;
            const next = new Map(prev);
            const ids = Array.from(next.keys());

            // Pick 1-2 random nodes
            const count = Math.min(ids.length, Math.random() > 0.5 ? 2 : 1);
            for (let i = 0; i < count; i++) {
                const idx = Math.floor(Math.random() * ids.length);
                const score = 80 + Math.random() * 20; // 80-100
                next.set(ids[idx], Math.min(100, score));
            }

            return next;
        });
    }, []);

    const reset = useCallback(() => {
        setIsPlaying(false);
        setTimeStep(0);
        setActiveEdges(new Set());
        setSuspicionMap((prev) => {
            const next = new Map();
            for (const [id] of prev) {
                next.set(id, 0);
            }
            return next;
        });
    }, []);

    return {
        timeStep,
        isPlaying,
        speed,
        suspicionMap,
        activeEdges,
        play,
        pause,
        setSpeed,
        injectSuspicious,
        reset,
    };
}
