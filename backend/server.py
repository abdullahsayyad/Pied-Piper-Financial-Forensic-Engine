from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import io
import time
from circular_fund_detector import CircularFundRoutingDetector
from smurfing_detector import SmurfingDetector
from shell_detector import ShellNetworkDetector

app = Flask(__name__)
CORS(app)

@app.route('/api/analyze', methods=['POST'])
def analyze():
    start_time = time.time()
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Read CSV
        df = pd.read_csv(io.StringIO(file.stream.read().decode("UTF8")), sep=None, engine='python')
        
        # Normalize columns: lowercase and strip format
        df.columns = df.columns.str.lower().str.strip()
        
        required_cols = {'sender_id', 'receiver_id', 'amount', 'timestamp'}
        if not required_cols.issubset(df.columns):
             return jsonify({"error": f"Missing required columns. Found: {list(df.columns)}"}), 400

        # Convert to list of dicts for detectors
        transactions = df.to_dict(orient='records')
        
        # Run Detectors
        logging_info = {}
        
        # 1. Circular Fund Routing
        circular_detector = CircularFundRoutingDetector()
        circular_results = circular_detector.run(transactions)
        
        # 2. Smurfing
        smurfing_detector = SmurfingDetector()
        smurfing_results = smurfing_detector.run(transactions)
        
        # 3. Shell Networks
        shell_detector = ShellNetworkDetector()
        shell_results = shell_detector.run(transactions)

        # Aggregate Results
        suspicious_accounts = []
        fraud_rings = []
        
        # Helper to merge suspicious accounts
        acc_map = {}
        
        all_suspicious = (
            circular_results.get("suspicious_accounts", []) + 
            smurfing_results.get("suspicious_accounts", []) + 
            shell_results.get("suspicious_accounts", [])
        )

        for item in all_suspicious:
            acc_id = item['account_id']
            if acc_id not in acc_map:
                acc_map[acc_id] = {
                    "account_id": acc_id,
                    "suspicion_score": 0.0,
                    "detected_patterns": set(),
                    "ring_id": item.get("ring_id") # Keep one for now
                }
            
            # Update score (take max for now, or weighted average)
            acc_map[acc_id]["suspicion_score"] = max(acc_map[acc_id]["suspicion_score"], item["suspicion_score"])
            acc_map[acc_id]["detected_patterns"].update(item.get("detected_patterns", []))

        # Convert sets to sorted lists
        for acc in acc_map.values():
            acc["detected_patterns"] = sorted(list(acc["detected_patterns"]))
            suspicious_accounts.append(acc)

        # Sort suspicious accounts by score descending
        suspicious_accounts.sort(key=lambda x: x["suspicion_score"], reverse=True)

        # Merge Rings
        fraud_rings = (
            circular_results.get("fraud_rings", []) + 
            smurfing_results.get("fraud_rings", []) + 
            shell_results.get("fraud_rings", [])
        )
        
        # Assign unique Ring IDs if needed or keep generated ones
        
        processing_time = round(time.time() - start_time, 3)
        
        response = {
            "suspicious_accounts": suspicious_accounts,
            "fraud_rings": fraud_rings,
            "summary": {
                "total_accounts_analyzed": len(set(df['sender_id']).union(set(df['receiver_id']))),
                "suspicious_accounts_flagged": len(suspicious_accounts),
                "fraud_rings_detected": len(fraud_rings),
                "processing_time_seconds": processing_time
            }
        }
        
        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
