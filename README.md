# Pied-Piper

## Overview

&#x20;Pied-Piper is a graph based financial intelligence system that detects the presence of money laundering activities and money muling patterns from digital transactional datasets. The system analyzes up to 10,000 transactions per upload, builds forensic graphs, runs bounded algorithms and returns ranked suspicion scores with JSON output and interactive visualizations.

Live URL: [https://pied-piper-production.up.railway.app/](https://pied-piper-production.up.railway.app/)

Use the demo link to upload a CSV file, view our graph visualizations, inspect the timelines and download the JSON results.

---

## Tech Stack

### Frontend

**React**\
Used to build the interactive dashboard and dynamically render transaction graphs and fraud analysis results.

**Tailwind CSS**\
Used to build the interactive dashboard and dynamically render transaction graphs and fraud analysis results.

### Graph and Data Intelligence

**Pandas**\
Used to design a clean, responsive, and modern user interface with risk-based visual indicators.

**NumPy**\
Used for efficient CSV parsing, data cleaning, timestamp handling and transaction filtering.

**D3**\
Visualizes transaction networks and fraud rings as interactive graphs and timelines based on the detection results.

### Backend

**JavaScript**\
Used to model transactions as graphs and detect fraud patterns like cycles, smurfing and shell networks.

**FastAPI**\
Powers the core fraud detection algorithms and graph intelligence engine.

**Node.js**\
Acts as an optional API gateway layer for request handling, authentication, and future scalability.

---

## System Architecture

The system processes transaction datasets uploaded in CSV format and converts them into a directed financial graph. Each transaction is represented as:

```
sender → receiver
```

Each edge in the graph stores:

- transaction\_id
- amount
- timestamp

The system detects three major money laundering patterns directly from a transaction level directed graph built from uploaded CSV data (up to 10,000 transactions).

---

## Algorithm Approach

### 1. Circular Fund Routing (Cycle Detection)

#### Objective

Detect directed cycles of length 3 to 5, indicating circular fund movement.

Example:

```
A → B → C → A
```

#### Algorithm

1. Build a directed graph from transactions.
2. Remove:
   - High degree hub accounts (likely merchants).
   - Leaf nodes (no incoming or outgoing edges).
3. Compute Strongly Connected Components (SCC).
4. Run bounded cycle detection (length 3 to 5).
5. For each cycle calculate risk score based on:
   - Cycle length
   - Amount similarity
   - Time coherence
   - Repetition frequency
   - Volume ratio

Detection time logic:

```
detected_at = timestamp of the last transaction completing the cycle
```

#### Edge Cases

- Long duration cycles
- Small value loops
- Legitimate business loops
- Merchant induced cycles

#### False Positive Control

- Time window threshold
- Amount variance filtering
- Hub pruning
- Minimum risk score requirement

---

### 2. Smurfing Detection (Fan In and Fan Out)

#### Objective

Detect aggregation and rapid redistribution of funds.

Fan In:
Many to One (10 or more unique senders)

Fan Out:
One to Many (10 or more unique receivers)

Suspicion increases if activity occurs within 72 hours.

#### Algorithm

1. For each account count unique incoming and outgoing counterparties.
2. Identify candidates exceeding the threshold.
3. Apply sliding window of 72 hours:
   - Sort transactions by time.
   - Count unique counterparties within the window.
4. Highest risk when Fan In is followed by Fan Out.

#### Edge Cases

- Payroll systems
- E commerce merchants
- Government subsidies
- Seasonal sales spikes

#### False Positive Control

- Check transaction stability over time
- Detect recurring payroll patterns
- Require temporal clustering
- Boost risk only if aggregation and redistribution occur

---

### 3. Layered Shell Network Detection (Multi Hop Chains)

#### Objective

Detect fund layering through low activity intermediary accounts.

Example:

```
A → B → C → D
```

Where B and C have very few total transactions.

#### Algorithm

1. Identify shell accounts:

```
total_txn_count ≤ threshold (for example 3)
```

2. Run depth limited DFS with maximum depth equal to 5.
3. Allow only shell accounts as intermediate nodes.
4. Validate:
   - Sequential timestamps
   - Time window threshold
   - Amount consistency

#### Edge Cases

- Newly opened accounts
- Dormant accounts reactivated
- Escrow routing
- Startups with low history

#### False Positive Control

- Require short time window
- Penalize inconsistent amounts
- Require multiple chain occurrences

---

## Suspicion Score Methodology

### 1. Smurfing (Structuring)

The score is primarily driven by the number of unique counterparties involved in the fan pattern.

Formula:

```
Score = 80 + (Number of Unique Senders or Receivers)
```

Cap: Maximum 100.

Logic:
A base score of 80 is assigned immediately upon detecting the pattern. Every additional unique account adds 1 to the risk, reflecting higher complexity and effort.

---

### 2. Circular Fund Routing

The score is a weighted average of five behavioral factors.

Formula:

```
Score = (0.25 × Length) + (0.20 × Amount) + (0.20 × Time) + (0.20 × Frequency) + (0.15 × Volume)
```

- Length (25 percent): Chains of five hops get maximum score.
- Amount Similarity (20 percent): Higher score if transaction amounts in the loop are nearly identical.
- Time (20 percent): Higher score if the money completes the loop quickly.
- Frequency (20 percent): Higher score if the same loop repeats multiple times.
- Volume Ratio (15 percent): Percentage of the account’s total outflow involved in this cycle.

---

### 3. Shell Networks

The score is a weighted sum focused on the shell nature of intermediaries, penalized by node degree to avoid flagging legitimate hubs.

Base Formula:

```
RawScore = (0.25 × Length) + (0.35 × ShellStatus) + (0.25 × Time) + (0.15 × Concentration)
```

Multipliers:

```
FinalScore = RawScore × DatasetPenalty × DegreePenalty
```

- Shell Status (35 percent): High score because intermediaries have very low activity.
- Length (25 percent): Longer chains range higher.
- Degree Penalty: If start or end nodes are large hubs, the score is reduced.

---

## Installation and Setup

### Pre Requisites

- Node.js and npm
- Git

### Step by Step Installation

#### Clone the Repository

```
git clone https://github.com/abdullahsayyad/pied-piper.git
cd pied-piper
```

#### Install Frontend Dependencies

```
npm install
```

#### Run the Development Server

```
npm run dev
```

#### Build for Production

```
npm run build
```

#### Preview the Build

```
npm run preview
```

#### Navigate into Backend Repository

```
cd backend
```

#### Backend Installation

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Usage Instructions

1. Upload CSV
2. Parser validates and builds MultiDiGraph
3. Run detectors for circular routing, smurfing and layered networks
4. Generate suspicion scores and JSON
5. Visualize in React graph and timeline
6. Export findings and download JSON

---

## Known Limitations

### Batch Processing Model

The system currently processes uploaded datasets rather than real time transaction streams. This limits its ability to provide immediate fraud alerts in live banking environments.

### Limited External Context Integration

Detection is based solely on transaction network structure and timing. It does not yet incorporate external intelligence such as KYC data, sanctions lists, IP geolocation or behavioral profiling.

---

## Future Scope

### Real Time Transaction Monitoring

The system can be upgraded from batch based CSV processing to real time transaction streaming using technologies such as Kafka or WebSockets. This would enable instant detection of suspicious patterns as transactions occur.

### Advanced Graph Intelligence

Incorporating advanced graph analytics such as community detection, centrality measures and network embeddings can help uncover hidden orchestrators and complex laundering networks.

### Role Based Access and Case Management

The system can evolve into a multi user platform with role based access control and case management to track investigations, workflows, evidence logs and resolution outcomes.

---

## Team Members

Nishit Dixit Jain

Burhanuddin Gulamali

Abdullah Sayyad

Atharva Mangesh Khedekar

