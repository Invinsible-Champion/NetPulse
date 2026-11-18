# NetPulse & PacketScope: From-Scratch Network Telemetry & Wireshark-Style Packet Analyzer

A full-fledged, zero-dependency Computer Networks Capstone platform combining:
1. **NetPulse**: Multi-stream TCP/HTTP internet speed testing engine with real-time speedometer gauges, RTT latency, RFC 3550 jitter calculation, and Bufferbloat evaluation.
2. **PacketScope**: Low-level packet capture and dissection system with an authentic 3-pane Wireshark interface (Packet List, Protocol Hierarchy Tree, and side-by-side Hexadecimal & ASCII dump).

---

##  Academic Value: Built From Scratch (Zero High-Level Libraries)

Unlike typical projects that wrap `scapy`, `pyshark`, or third-party speedtest APIs, **every protocol dissector, binary unpacker, bitwise mask, and socket throughput accumulator was hand-crafted**:

- **Layer 2 (Data Link)**:
  - **Ethernet II** (`core/sniffer/ethernet.py`): Frame decoding using `struct.unpack('!6s6sH')`, MAC formatting, EtherType resolution.
  - **802.1Q VLAN**: Tag Control Information (TCI), Priority Code Point (PCP), Drop Eligible Indicator (DEI), and VLAN ID (VID) extraction.
- **Layer 3 (Network)**:
  - **IPv4 (RFC 791)** (`core/sniffer/ipv4.py`): Version, IHL bit extraction, DSCP/ECN, total length, flags (`DF`, `MF`), fragment offset, TTL, protocol dispatch, and **RFC 1071 one's complement Internet Checksum verification**.
  - **IPv6 (RFC 8200)** (`core/sniffer/ipv6.py`): Traffic class, 20-bit flow label, payload length, next header routing, 128-bit IPv6 addressing.
  - **ARP (RFC 826)** (`core/sniffer/arp.py`): Hardware/protocol types, MAC/IP address mapping, Opcode Request/Reply handling.
- **Layer 4 (Transport)**:
  - **TCP (RFC 793)** (`core/sniffer/tcp.py`): Source/destination ports, sequence/acknowledgment numbers, data offset calculation, TCP flags (`SYN`, `ACK`, `FIN`, `RST`, `PSH`, `URG`, `ECE`, `CWR`), window size, checksum, and **TCP Options parsing** (MSS, Window Scale, SACK Permitted, Timestamps).
  - **UDP (RFC 768)** (`core/sniffer/udp.py`): Header unpack, length, checksum, service port resolution.
  - **ICMPv4 & ICMPv6 (RFC 792 & RFC 4443)** (`core/sniffer/icmp.py`): Type, code, checksum, ping echo request/reply identifier and sequence numbers.
- **Layer 7 (Application)**:
  - **DNS (RFC 1035)** (`core/sniffer/dns.py`): Header flags, question/answer RRs, record types (A, AAAA, CNAME, MX, TXT, PTR), and **recursive pointer compression label decoding** (`0xC0` byte jumps).
  - **HTTP (RFC 2616 / 7230)** (`core/sniffer/http_parser.py`): Request methods, URIs, versions, status codes, and header tokenization.
  - **TLS Handshake & SNI (RFC 8446 / 5246)** (`core/sniffer/tls_parser.py`): Record layer, Handshake type (Client/Server Hello), and **Server Name Indication (SNI) host extraction** to reveal HTTPS websites visited in cleartext before encryption.
  - **DHCP / BOOTP (RFC 2131 / 2132)** (`core/sniffer/dhcp.py`): Magic cookie verification, client hardware addresses, IP leases, subnet masks, router, and DNS option fields.
  - **NTP (RFC 5905)** (`core/sniffer/ntp.py`): Leap indicator, stratum, precision, root delay, reference IDs.
- **Speed Test & Bufferbloat**:
  - Multi-stream chunked socket throughput calculation in RAM (bypassing disk I/O bottlenecks).
  - RFC 3550 Jitter algorithm: $J = J + \frac{|D(i-1, i)| - J}{16}$.
  - Loaded vs. Unloaded Latency Engine: Measures Idle Ping, Download-Loaded Ping, and Upload-Loaded Ping to isolate queueing delay ($\Delta$).
  - Bufferbloat grading based on worst-case loaded RTT inflation (A+ to F).

---

## 🌐 Real Internet Speed Testing, Multi-CDN & Parallel Streams

- **Multi-CDN Edge Provider Selection**:
  - **Cloudflare Anycast CDN (Default)**: Tests against 300+ global edge data centers with regional IP and ASN detection.
  - **Netflix Open Connect CDN (Fast.com Engine)**: Dynamically discovers and streams video chunks directly from nearest ISP-hosted Netflix Open Connect Appliances (OCA).
  - **AWS CloudFront / jsDelivr Edge**: Benchmarks throughput over Amazon Web Services global backbone.
  - **Localhost Socket Server (Loopback 127.0.0.1:8080)**: Hand-crafted Python memory-to-memory socket throughput testing internal kernel IPC speeds.
- **Parallel TCP Streams Selector**:
  - `1x (Single Stream)`: Tests single-connection TCP window scaling and ISP single-socket throttling.
  - `2x`, `4x (Balanced Standard)`: Industry standard multi-stream concurrency (matching Ookla / Fast.com).
  - `8x (High Performance)` & `16x (Extreme Gigabit)`: Heavy socket pipeline saturation for high-speed fiber broadband.
- **Loaded & Unloaded Latency Breakdown Deck**:
  - **Idle Latency**: Baseline round-trip time (ms) and RFC 3550 Jitter.
  - **Download-Loaded Latency**: Latency measured concurrently during downstream saturation with Delta tag ($+\Delta_{\text{down}}\text{ ms}$).
  - **Upload-Loaded Latency**: Latency measured concurrently during upstream saturation with Delta tag ($+\Delta_{\text{up}}\text{ ms}$).
  - **Comparative Visual Bars & Bufferbloat Verdict**: Displays normalized comparison bars and explains practical impact on competitive gaming, Zoom calls, and VoIP.

---

##  User Interface Highlights

- **Speed Test (NetPulse)**:
  - High-DPI HTML5 Canvas Speedometer gauge with smooth needle physics and dynamic glowing speed arc.
  - Digital readout (Mbps) and live throughput timeline waveform graph.
  - Metric cards for Download, Upload, Latency, RFC 3550 Jitter, and Bufferbloat Rating (A+ to F).
  - **Global Edge Routing Radar & Fiber Optic Diagnostics Map**:
    - Real-time Canvas world map with interactive global edge server switching (Mumbai, Singapore, Frankfurt, London, Tokyo, Silicon Valley).
    - Dynamic great-circle geodesic ballistic arcs connecting the client to destination edge nodes.
    - Live animated packet energy streams: particles rush from Server $\to$ Client during Download, and from Client $\to$ Server during Upload!
    - Optical fiber physics calculator: Haversine distance, speed of light in silica fiber ($c / 1.468$), routing efficiency, and real undersea cable backbones (SEA-ME-WE 4, AAE-1, MAREA, BBG).
- **Wireshark Monitor (PacketScope)**:
  - **Top Pane**: Color-coded packet summary table (Green: HTTP, Blue: DNS, Purple: TCP, Pink: TLS, Orange: ICMP, Yellow: ARP).
  - **Middle Pane**: Interactive collapsible protocol tree hierarchy.
  - **Bottom Pane**: Authentic side-by-side Hexadecimal and ASCII dump with byte offset markers.
  - **Display Filter Bar**: Filter by protocol (`tcp`, `udp`, `dns`, `tls`, `http`, `icmp`, `arp`), IP (`ip 192.168.1.1`), or port (`port 443`).
- **Network Analytics**:
  - Live Canvas donut chart showing real-time protocol breakdown.
  - Top Talkers table ranking active IPs by packet volume and bandwidth consumption.

---

##  How to Run the Platform

### Option 1: Live Raw Socket Capture (Recommended for Full Demonstration)
Capturing raw Ethernet frames on Linux network interfaces (`wlan0`, `enp7s0`, `lo`) requires raw socket capabilities (`CAP_NET_RAW` or root):
```bash
sudo python3 server.py
```
Then open your web browser at:
```
http://localhost:8080
```

### Option 2: Standard User Run (Dissection Engine Demonstration)
If running without `sudo`, the built-in server automatically operates the dissection engine with RFC-compliant synthetic network traffic, letting you test the Speedometer, live graph, Wireshark 3-pane tree, hex dump, and analytics immediately:
```bash
cd /home/adi/Documents/cn_project
python3 server.py
```
Open in browser:
```
http://localhost:8080
```

---

## 📁 Project Directory Layout

```
cn_project/
├── core/
│   ├── sniffer/
│   │   ├── dissector.py       # Master multi-layer packet dissector
│   │   ├── engine.py          # Raw socket capture & filtering engine
│   │   ├── ethernet.py        # Layer 2: Ethernet II & 802.1Q VLAN
│   │   ├── ipv4.py            # Layer 3: IPv4 RFC 791 & Checksum verifier
│   │   ├── ipv6.py            # Layer 3: IPv6 RFC 8200
│   │   ├── arp.py             # Layer 3: ARP RFC 826
│   │   ├── icmp.py            # Layer 3/4: ICMPv4 & ICMPv6
│   │   ├── tcp.py             # Layer 4: TCP RFC 793, Flags & Options
│   │   ├── udp.py             # Layer 4: UDP RFC 768
│   │   ├── dns.py             # Layer 7: DNS RFC 1035 & label decompressor
│   │   ├── http_parser.py     # Layer 7: HTTP requests & responses
│   │   ├── tls_parser.py      # Layer 7: TLS Record & SNI extractor
│   │   ├── dhcp.py            # Layer 7: DHCP / BOOTP options
│   │   ├── ntp.py             # Layer 7: NTP RFC 5905
│   │   └── hexdump.py         # Hexadecimal & ASCII dump formatter
│   └── speedtest/
│       ├── latency.py         # Ping, RTT, RFC 3550 Jitter & Bufferbloat
│       └── throughput.py      # Sliding-window Mbps & memory payload pool
├── web/
│   ├── index.html             # Single-page web dashboard
│   ├── style.css              # Cyberpunk dark mode & Wireshark styling
│   └── app.js                 # Canvas gauge, Wireshark 3-pane & analytics
├── server.py                  # Integrated HTTP & Server-Sent Events server
└── README.md                  # Project documentation & presentation guide
```
