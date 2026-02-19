"""
Smurfing Detector (Fan-in / Fan-out)
=====================================

Detects:
1. Fan-in: Multiple accounts send to one aggregator (10+ senders -> 1 receiver)
2. Fan-out: One account disperses to many receivers (1 sender -> 10+ receivers)
3. Temporal analysis: Transactions within a 72-hour window

"""

from collections import defaultdict
from datetime import datetime, timedelta

# ==============================
# CONFIG
# ==============================

FAN_IN_THRESHOLD = 10
FAN_OUT_THRESHOLD = 10
TIME_WINDOW_HOURS = 72

class SmurfingDetector:

    def __init__(self):
        self.fan_in = defaultdict(list)
        self.fan_out = defaultdict(list)

    def parse_ts(self, ts):
        if not ts:
            return None
        for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(ts.strip(), fmt)
            except ValueError:
                continue
        return None

    def run(self, transactions):
        self.fan_in.clear()
        self.fan_out.clear()

        # Group transactions by receiver (fan-in) and sender (fan-out)
        for txn in transactions:
            s = txn.get("sender_id")
            r = txn.get("receiver_id")
            ts = self.parse_ts(txn.get("timestamp"))
            amount = float(txn.get("amount", 0))

            if s and r and ts:
                self.fan_in[r].append({"sender": s, "ts": ts, "amount": amount})
                self.fan_out[s].append({"receiver": r, "ts": ts, "amount": amount})

        suspicious_accounts = []
        rings = []

        # Detect Fan-in
        for acc, txns in self.fan_in.items():
            # Sort by timestamp
            txns.sort(key=lambda x: x["ts"])
            
            # Slater window check (simplified for now: checking if ANY 72h window has > threshold unique senders)
            # A more robust sliding window could be implemented, but this is a good start.
            
            # Correct approach: Slide a window over the sorted transactions
            unique_senders_in_window = set()
            start_idx = 0
            
            for i in range(len(txns)):
                current_ts = txns[i]["ts"]
                
                # Advance start_idx to keep window within 72 hours
                while start_idx < i and (current_ts - txns[start_idx]["ts"]) > timedelta(hours=TIME_WINDOW_HOURS):
                    start_idx += 1
                
                # Check unique senders in the current window [start_idx, i]
                current_window = txns[start_idx : i+1]
                senders = set(t["sender"] for t in current_window)
                
                if len(senders) >= FAN_IN_THRESHOLD:
                    suspicious_accounts.append({
                        "account_id": acc,
                        "suspicion_score": 80.0, # Base high score for smurfing
                        "detected_patterns": ["fan_in"],
                        "ring_id": f"SMURF_IN_{acc}"
                    })
                    
                    rings.append({
                        "ring_id": f"SMURF_IN_{acc}",
                        "member_accounts": list(senders) + [acc],
                        "pattern_type": "fan_in",
                        "risk_score": 85.0,
                        "detected_at": current_ts.strftime("%Y-%m-%d %H:%M:%S")
                    })
                    break # Flag once per account

        # Detect Fan-out
        for acc, txns in self.fan_out.items():
            txns.sort(key=lambda x: x["ts"])
            
            start_idx = 0
            for i in range(len(txns)):
                current_ts = txns[i]["ts"]
                
                while start_idx < i and (current_ts - txns[start_idx]["ts"]) > timedelta(hours=TIME_WINDOW_HOURS):
                    start_idx += 1
                
                current_window = txns[start_idx : i+1]
                receivers = set(t["receiver"] for t in current_window)
                
                if len(receivers) >= FAN_OUT_THRESHOLD:
                    suspicious_accounts.append({
                        "account_id": acc,
                        "suspicion_score": 80.0,
                        "detected_patterns": ["fan_out"],
                        "ring_id": f"SMURF_OUT_{acc}"
                    })
                    
                    rings.append({
                        "ring_id": f"SMURF_OUT_{acc}",
                        "member_accounts": [acc] + list(receivers),
                        "pattern_type": "fan_out",
                        "risk_score": 85.0,
                        "detected_at": current_ts.strftime("%Y-%m-%d %H:%M:%S")
                    })
                    break

        return {
            "suspicious_accounts": suspicious_accounts,
            "fraud_rings": rings
        }
