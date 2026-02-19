"""
Shell Network Detector
======================

Detects:
Layered Shell Networks: Money passes through intermediate "shell" accounts 
with low transaction counts before reaching the final destination.

Look for chains of 3+ hops where intermediate accounts have only 2–3 total transactions.
This implies we need to find paths A -> B -> C -> D where B and C are "shells".
"""

import networkx as nx

class ShellNetworkDetector:

    def __init__(self):
        self.graph = nx.DiGraph()

    def run(self, transactions):
        self.graph.clear()
        
        # 1. Build Graph and Count Transactions per Node
        node_txn_counts = {} # Total transactions (in + out) for each node

        for txn in transactions:
            s = txn.get("sender_id")
            r = txn.get("receiver_id")
            
            if s and r:
                self.graph.add_edge(s, r)
                
                node_txn_counts[s] = node_txn_counts.get(s, 0) + 1
                node_txn_counts[r] = node_txn_counts.get(r, 0) + 1

        suspicious_accounts = []
        rings = []
        
        # 2. Identify Potential Shell Accounts (2-3 total transactions)
        shells = {node for node, count in node_txn_counts.items() if 2 <= count <= 3}
        
        if not shells:
            return {"suspicious_accounts": [], "fraud_rings": []}

        # 3. Find paths through shells
        # We are looking for chains of 3+ hops. A -> Shell -> Shell -> D
        # This is essentially finding paths in the subgraph induced by shells + their neighbors,
        # but specifically satisfying the shell property for intermediates.
        
        # Optimization: Iterate over all nodes, if a node is a shell, check its neighbors.
        # Better: Standard DFS/BFS limited to depth, but tracking shell status.
        
        # Let's simplify: Find connected components of shell nodes.
        # If a connected component of shell nodes has size >= 2 (Shell -> Shell), 
        # and is connected to non-shells at ends, it's a layered network.
        
        shell_subgraph = self.graph.subgraph(shells).copy()
        
        # We need chains of shells.
        # A simple approach: 
        # Iterate over all edges (u, v) in shell_subgraph.
        # If we find a path in shell_subgraph of length >= 1 (which creates a 3-hop chain with endpoints: S -> u -> v -> D)
        
        # Let's look for simple paths in the full graph where intermediate nodes are ALL in `shells` set.
        # And length of path >= 3 (3 hops means 2 intermediate nodes).
        
        detected_shells = set()
        
        # Iterate through all shell nodes to find if they are part of a chain
        for node in shells:
            if node in detected_shells:
                continue
                
            # Check for incoming from shell and outgoing to shell
            # This is expensive to do exhaustively.
            pass

        # Alternative Approach:
        # 1. remove non-shell nodes, but keep edges between shells.
        # 2. find connected components of shells.
        # 3. For each component, check if it forms a path/chain.
        
        for component in nx.weakly_connected_components(shell_subgraph):
            if len(component) >= 2:
                # Potential shell chain
                comp_sub = shell_subgraph.subgraph(component)
                
                # Check if it looks link-like (nodes have low degree within component)
                # If it's a chain: A -> B -> C
                
                # We need to verify these attach to something outside.
                # Nodes in `component` are the candidate shells.
                
                # Trace valid paths: In -> Shell1 -> Shell2 -> ... -> Out
                start_nodes = [n for n in component if self.graph.in_degree(n) > 0]
                
                valid_chain = False
                chain_members = []
                
                for start in start_nodes:
                    # Do a DFS from start, constrained to 'component' nodes
                    # We want a path of length at least 1 inside the component (2 shells)
                    # leading to non-shell outputs.
                    
                    # DFS to find longest path in this shell component
                    paths = nx.all_simple_paths(comp_sub, source=start, target=[n for n in component])
                    
                    for path in paths:
                        if len(path) >= 2: # At least 2 shells involved: S1 -> S2
                            # Check if S1 has a predecessor that is NOT a shell (or even if it is, we just need a source)
                            # Check if the last node has a successor.
                            
                            first = path[0]
                            last = path[-1]
                            
                            has_input = self.graph.in_degree(first) > 0 # Any input
                            has_output = self.graph.out_degree(last) > 0 # Any output
                            
                            if has_input and has_output:
                                valid_chain = True
                                chain_members = path
                                break
                    if valid_chain:
                        break
                
                if valid_chain:
                    ring_id = f"SHELL_{chain_members[0]}"
                    rings.append({
                        "ring_id": ring_id,
                        "member_accounts": chain_members,
                        "pattern_type": "shell_network",
                        "risk_score": 75.0,
                        "detected_at": None # No specific time for structural pattern
                    })
                    
                    for member in chain_members:
                        if member not in detected_shells:
                            detected_shells.add(member)
                            suspicious_accounts.append({
                                "account_id": member,
                                "suspicion_score": 75.0,
                                "detected_patterns": ["shell_account"],
                                "ring_id": ring_id
                            })

        return {
            "suspicious_accounts": suspicious_accounts,
            "fraud_rings": rings
        }
