import sys
import os
import datetime

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from circular_fund_detector import CircularFundRoutingDetector
from smurfing_detector import SmurfingDetector
from shell_detector import ShellNetworkDetector

def test_detectors():
    # 1. Test Circular Detection
    print("Testing Circular Detector...")
    c_detector = CircularFundRoutingDetector()
    
    # A -> B -> C -> A
    c_txns = [
        {"sender_id": "A", "receiver_id": "B", "amount": 100, "timestamp": "2023-01-01 10:00:00"},
        {"sender_id": "B", "receiver_id": "C", "amount": 100, "timestamp": "2023-01-01 11:00:00"},
        {"sender_id": "C", "receiver_id": "A", "amount": 100, "timestamp": "2023-01-01 12:00:00"},
    ]
    
    res = c_detector.run(c_txns)
    print("Circular Result:", len(res['fraud_rings']), "rings found.")
    assert len(res['fraud_rings']) == 1
    assert res['fraud_rings'][0]['pattern_type'] == 'cycle'

    # 2. Test Smurfing Detection
    print("\nTesting Smurfing Detector...")
    s_detector = SmurfingDetector()
    
    # Fan-in: 10 users -> Aggregator
    s_txns = []
    for i in range(12):
        s_txns.append({
            "sender_id": f"User_{i}", 
            "receiver_id": "Aggregator", 
            "amount": 10, 
            "timestamp": "2023-01-01 10:00:00"
        })
        
    res = s_detector.run(s_txns)
    print("Smurfing Result:", len(res['fraud_rings']), "rings found.")
    assert len(res['fraud_rings']) == 1
    assert res['fraud_rings'][0]['pattern_type'] == 'fan_in'

    # 3. Test Shell Detection
    print("\nTesting Shell Detector...")
    sh_detector = ShellNetworkDetector()
    
    # Chain: Source -> Shell1 -> Shell2 -> Shell3 -> Dest
    # Shells need 2-3 txns.
    # Shell1: In from Source, Out to Shell2 (2 txns)
    # Shell2: In from Shell1, Out to Shell3 (2 txns)
    # Shell3: In from Shell2, Out to Dest (2 txns)
    
    sh_txns = [
        {"sender_id": "Source", "receiver_id": "Shell1", "amount": 100},
        {"sender_id": "Shell1", "receiver_id": "Shell2", "amount": 100},
        {"sender_id": "Shell2", "receiver_id": "Shell3", "amount": 100},
        {"sender_id": "Shell3", "receiver_id": "Dest", "amount": 100},
    ]
    
    res = sh_detector.run(sh_txns)
    print("Shell Result:", len(res['fraud_rings']), "rings found.")
    # Depending on logic, might find 1 ring representing the chain
    if len(res['fraud_rings']) > 0:
         print("Found shell chain:", res['fraud_rings'][0]['member_accounts'])

if __name__ == "__main__":
    test_detectors()
