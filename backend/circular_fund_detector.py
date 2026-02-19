"""
Circular Fund Routing Detector (Production Module)
===================================================

Detection time logic:
detected_at = timestamp of the LAST transaction
that completes the cycle (max timestamp in cycle edges)

Output format:

{
  "suspicious_accounts": [
    {
      "account_id": "...",
      "suspicion_score": 87.5,
      "detected_patterns": [...],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": [...],
      "pattern_type": "cycle",
      "risk_score": 95.3,
      "detected_at": "YYYY-MM-DD HH:MM:SS"
    }
  ],
  "summary": {...}
}
"""

import networkx as nx
from collections import defaultdict
from datetime import datetime
import statistics
import time

# ==============================
# CONFIG
# ==============================

MIN_CYCLE_LEN = 3
MAX_CYCLE_LEN = 5

MAX_ALLOWED_DURATION = 7 * 24 * 3600

HIGH_RISK_THRESHOLD = 0.0
HIGH_RISK_CYCLE_COUNT = 3

HUB_DEGREE_LIMIT = 20

# Balanced CRS weights
W_LENGTH = 0.25
W_AMOUNT = 0.20
W_TIME = 0.20
W_FREQUENCY = 0.20
W_VOLUME = 0.15

assert abs(W_LENGTH + W_AMOUNT + W_TIME + W_FREQUENCY + W_VOLUME - 1.0) < 1e-9


# ==============================
# UTILITIES
# ==============================

def clamp01(x):
    return max(0.0, min(1.0, x))

def safe_float(x):
    try:
        return float(x)
    except:
        return 0.0

def normalize_cycle(cycle):
    idx = cycle.index(min(cycle))
    return tuple(cycle[idx:] + cycle[:idx])

def parse_ts(ts):
    if not ts:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(ts.strip(), fmt)
        except ValueError:
            continue
    return None


# ==============================
# CRS SCORER
# ==============================

class CRSScorer:

    def __init__(self, graph, edge_meta):
        self.graph = graph
        self.edge_meta = edge_meta

    def length_score(self, cycle):
        L = len(cycle)
        return clamp01(
            (MAX_CYCLE_LEN - L + 1) /
            (MAX_CYCLE_LEN - MIN_CYCLE_LEN + 1)
        )

    def amount_similarity_score(self, edges):
        amounts = []
        for u, v in edges:
            data = self.graph[u][v]
            avg = data["total_amount"] / data["weight"]
            amounts.append(avg)

        if not amounts:
            return 0.0

        mean = sum(amounts) / len(amounts)
        if mean == 0:
            return 0.0

        if len(amounts) == 1:
            return 1.0

        std = statistics.stdev(amounts)
        return clamp01(1 - std / mean)

    def time_score(self, edges):
        timestamps = []
        for u, v in edges:
            for meta in self.edge_meta[(u, v)]:
                if meta["timestamp"]:
                    timestamps.append(meta["timestamp"])

        if len(timestamps) < 2:
            return 0.5

        duration = (max(timestamps) - min(timestamps)).total_seconds()
        return clamp01(1 - duration / MAX_ALLOWED_DURATION)

    def frequency_score(self, cycle, cycle_occurrences):
        count = len(cycle_occurrences.get(normalize_cycle(cycle), []))
        return clamp01(min(count / 3.0, 1.0))

    def volume_score(self, cycle, edges):
        cycle_volume = sum(self.graph[u][v]["total_amount"] for u, v in edges)

        total_outgoing = 0
        for u in cycle:
            for _, v in self.graph.out_edges(u):
                total_outgoing += self.graph[u][v]["total_amount"]

        if total_outgoing == 0:
            return 0.0

        return clamp01(cycle_volume / total_outgoing)

    def compute(self, cycle, cycle_occurrences):
        edges = list(zip(cycle, cycle[1:] + [cycle[0]]))

        raw = (
            W_LENGTH * self.length_score(cycle) +
            W_AMOUNT * self.amount_similarity_score(edges) +
            W_TIME * self.time_score(edges) +
            W_FREQUENCY * self.frequency_score(cycle, cycle_occurrences) +
            W_VOLUME * self.volume_score(cycle, edges)
        )

        return round(clamp01(raw) * 100, 2)


# ==============================
# DETECTOR
# ==============================

class CircularFundRoutingDetector:

    def __init__(self):
        self.graph = nx.DiGraph()
        self.edge_meta = defaultdict(list)

    def build_graph(self, transactions):
        for txn in transactions:
            s = txn.get("sender_id", "")
            r = txn.get("receiver_id", "")

            if not s or not r or s == r:
                continue

            amt = safe_float(txn.get("amount", 0))
            ts = parse_ts(txn.get("timestamp", ""))

            if self.graph.has_edge(s, r):
                self.graph[s][r]["weight"] += 1
                self.graph[s][r]["total_amount"] += amt
            else:
                self.graph.add_edge(s, r, weight=1, total_amount=amt)

            self.edge_meta[(s, r)].append({
                "amount": amt,
                "timestamp": ts
            })

    def prune(self):
        G = self.graph.copy()

        threshold = max(HUB_DEGREE_LIMIT, int(0.1 * G.number_of_nodes()))
        hubs = [n for n in G if G.degree(n) > threshold]
        G.remove_nodes_from(hubs)

        leaves = [n for n in G if G.in_degree(n) == 0 or G.out_degree(n) == 0]
        G.remove_nodes_from(leaves)

        return G

    def detect_cycles(self):
        G = self.prune()
        cycles = []
        seen = set()

        for scc in nx.strongly_connected_components(G):
            if len(scc) < MIN_CYCLE_LEN:
                continue

            sub = G.subgraph(scc).copy()

            for cycle in nx.simple_cycles(sub, length_bound=MAX_CYCLE_LEN):
                if MIN_CYCLE_LEN <= len(cycle) <= MAX_CYCLE_LEN:
                    norm = normalize_cycle(cycle)
                    if norm not in seen:
                        seen.add(norm)
                        cycles.append(list(norm))

        return cycles

    def get_cycle_completion_time(self, cycle):
        timestamps = []
        edges = list(zip(cycle, cycle[1:] + [cycle[0]]))

        for u, v in edges:
            for meta in self.edge_meta.get((u, v), []):
                if meta["timestamp"]:
                    timestamps.append(meta["timestamp"])

        if not timestamps:
            return None

        return max(timestamps)

    def run(self, transactions):
        start = time.time()
        self.build_graph(transactions)
        cycles = self.detect_cycles()

        cycle_occurrences = defaultdict(list)
        for cycle in cycles:
            cycle_occurrences[normalize_cycle(cycle)].append(datetime.now())

        scorer = CRSScorer(self.graph, self.edge_meta)

        rings = []
        account_data = defaultdict(list)

        for idx, cycle in enumerate(cycles, start=1):
            score = scorer.compute(cycle, cycle_occurrences)
            ring_id = f"RING_{idx:03d}"

            completion_time = self.get_cycle_completion_time(cycle)

            rings.append({
                "ring_id": ring_id,
                "member_accounts": cycle,
                "pattern_type": "cycle",
                "risk_score": score,
                "detected_at": completion_time.strftime("%Y-%m-%d %H:%M:%S")
                               if completion_time else None
            })

            for acc in cycle:
                account_data[acc].append({
                    "score": score,
                    "ring_id": ring_id,
                    "cycle_length": len(cycle)
                })

        suspicious_accounts = []

        for acc, entries in account_data.items():
            max_score = max(e["score"] for e in entries)
            high_risk_cycles = sum(1 for e in entries if e["score"] > HIGH_RISK_THRESHOLD)

            flagged = (
                max_score > HIGH_RISK_THRESHOLD or
                high_risk_cycles > HIGH_RISK_CYCLE_COUNT
            )

            if flagged:
                patterns = set()

                for e in entries:
                    if e["cycle_length"] == 3:
                        patterns.add("cycle_length_3")
                    if e["score"] > 85:
                        patterns.add("high_velocity")

                suspicious_accounts.append({
                    "account_id": acc,
                    "suspicion_score": round(max_score, 2),
                    "detected_patterns": sorted(patterns),
                    "ring_id": entries[0]["ring_id"]
                })

        return {
            "suspicious_accounts": suspicious_accounts,
            "fraud_rings": rings,
            "summary": {
                "total_accounts_analyzed": self.graph.number_of_nodes(),
                "suspicious_accounts_flagged": len(suspicious_accounts),
                "fraud_rings_detected": len(rings),
                "processing_time_seconds": round(time.time() - start, 3)
            }
        }
