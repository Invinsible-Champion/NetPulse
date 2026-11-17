"""
NetPulse & PacketScope: Unified Server
Standard Library Python Implementation (Zero External Dependencies).
Integrates High-Speed Throughput Testing with Live Wireshark Packet Sniffing.
"""
import os
import sys
import json
import time
import socket
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from core.sniffer.engine import SnifferEngine
from core.speedtest.throughput import SpeedPayloadPool, ThroughputTracker
from core.speedtest.latency import LatencyMeasurer

# Initialize core services
PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")

sniffer = SnifferEngine()
payload_pool = SpeedPayloadPool(block_size_kb=1024)
latency_measurer = LatencyMeasurer()

# Protocol statistics tracker
stats_lock = sniffer.lock
protocol_counts = {}

def get_interfaces() -> list[dict]:
    """Inspects Linux /sys/class/net to find physical and virtual interfaces."""
    interfaces = [{"name": "any", "state": "active", "label": "All Interfaces (any)"}]
    net_dir = "/sys/class/net"
    if os.path.exists(net_dir):
        for iface in sorted(os.listdir(net_dir)):
            state = "unknown"
            state_file = os.path.join(net_dir, iface, "operstate")
            if os.path.exists(state_file):
                try:
                    with open(state_file) as f:
                        state = f.read().strip()
                except Exception:
                    pass
            label = f"{iface} ({state})"
            interfaces.append({"name": iface, "state": state, "label": label})
    return interfaces

class UnifiedRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Suppress routine chunk logging to keep console clean
        if "/api/download" in args[0] or "/api/upload" in args[0] or "/api/ping" in args[0]:
            return
        super().log_message(format, *args)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Content-Length")

    def send_json_response(self, data: dict, status_code: int = 200, head_only: bool = False):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only: bool = False):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # ---------------------------------------------------------------------
        # 1. SPEED TEST API ENDPOINTS
        # ---------------------------------------------------------------------
        if path == "/api/ping":
            self.send_json_response({"status": "ok", "timestamp": time.time()}, head_only=head_only)
            return

        elif path == "/api/download":
            # Stream uncompressed random bytes for download throughput testing
            mb_requested = int(query.get("size", [25])[0])
            mb_requested = max(1, min(100, mb_requested))
            total_bytes = mb_requested * 1024 * 1024

            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(total_bytes))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()

            chunk_size = 64 * 1024  # 64 KB blocks
            chunk = payload_pool.get_chunk(chunk_size)
            bytes_sent = 0

            try:
                while bytes_sent < total_bytes:
                    to_send = min(chunk_size, total_bytes - bytes_sent)
                    self.wfile.write(chunk[:to_send])
                    bytes_sent += to_send
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        elif path == "/api/speedtest/bufferbloat":
            unloaded = float(query.get("unloaded", [10.0])[0])
            loaded = float(query.get("loaded", [25.0])[0])
            res = LatencyMeasurer.calculate_bufferbloat_grade(unloaded, loaded)
            self.send_json_response(res)
            return

        # ---------------------------------------------------------------------
        # 2. PACKET SNIFFER API ENDPOINTS
        # ---------------------------------------------------------------------
        elif path == "/api/interfaces":
            ifaces = get_interfaces()
            self.send_json_response({
                "interfaces": ifaces,
                "is_root": os.geteuid() == 0 if hasattr(os, "geteuid") else False,
                "is_mock": sniffer.is_mock
            })
            return

        elif path == "/api/sniffer/start":
            iface = query.get("interface", ["any"])[0]
            sniffer.start(interface=iface)
            self.send_json_response({
                "status": "started",
                "interface": iface,
                "is_mock": sniffer.is_mock
            })
            return

        elif path == "/api/sniffer/stop":
            sniffer.stop()
            self.send_json_response({"status": "stopped"})
            return

        elif path == "/api/sniffer/clear":
            sniffer.clear()
            self.send_json_response({"status": "cleared"})
            return

        elif path == "/api/sniffer/filter":
            f = query.get("q", [""])[0]
            sniffer.set_filter(f)
            self.send_json_response({"status": "filter_set", "filter": f})
            return

        elif path == "/api/sniffer/packets":
            # Polling endpoint for packets
            count = int(query.get("count", [50])[0])
            pkts = sniffer.get_packets(max_count=count)
            self.send_json_response({
                "packets": pkts,
                "total_captured": sniffer.total_captured,
                "bytes_captured": sniffer.bytes_captured,
                "is_running": sniffer.is_running,
                "is_mock": sniffer.is_mock
            })
            return

        elif path == "/api/sniffer/stream":
            # Server-Sent Events (SSE) real-time packet stream
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            try:
                while True:
                    pkts = sniffer.get_packets(max_count=20)
                    if pkts:
                        payload = f"data: {json.dumps(pkts)}\n\n"
                        self.wfile.write(payload.encode("utf-8"))
                        self.wfile.flush()
                    else:
                        # Send heartbeat ping every 500ms
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
                    time.sleep(0.1)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        # ---------------------------------------------------------------------
        # 3. STATIC WEB FILE SERVING
        # ---------------------------------------------------------------------
        if path == "/" or path == "":
            path = "/index.html"

        safe_path = os.path.normpath(path.lstrip("/"))
        file_path = os.path.join(WEB_DIR, safe_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            content_type = "text/plain"
            if file_path.endswith(".html"):
                content_type = "text/html"
            elif file_path.endswith(".css"):
                content_type = "text/css"
            elif file_path.endswith(".js"):
                content_type = "application/javascript"
            elif file_path.endswith(".json"):
                content_type = "application/json"
            elif file_path.endswith(".svg"):
                content_type = "image/svg+xml"
            elif file_path.endswith(".png"):
                content_type = "image/png"

            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            if not head_only:
                self.wfile.write(content)
        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"404 Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/upload":
            # Measure incoming upload stream bandwidth
            try:
                content_len = int(self.headers.get("Content-Length", 0))
            except (ValueError, TypeError):
                content_len = 0

            bytes_received = 0
            chunk_size = 64 * 1024
            t0 = time.perf_counter()

            while bytes_received < content_len:
                to_read = min(chunk_size, content_len - bytes_received)
                chunk = self.rfile.read(to_read)
                if not chunk:
                    break
                bytes_received += len(chunk)

            duration = max(0.0001, time.perf_counter() - t0)
            mbps = (bytes_received * 8.0) / (duration * 1_000_000.0)

            resp = {
                "status": "ok",
                "bytes_received": bytes_received,
                "duration_seconds": round(duration, 4),
                "speed_mbps": round(mbps, 2)
            }
            self.send_json_response(resp)
            return

        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

def run_server(port: int = PORT):
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, UnifiedRequestHandler)
    print(f"============================================================")
    print(f"  NETPULSE & PACKETSCOPE : Unified Network Platform")
    print(f"  Speed Tester & Wireshark-Style Packet Analyzer (From Scratch)")
    print(f"============================================================")
    print(f"  Listening on: http://localhost:{port}")
    print(f"  Running as:   {'ROOT (Full raw socket sniffing enabled)' if (hasattr(os, 'geteuid') and os.geteuid() == 0) else 'Standard User (Mock capture enabled if raw socket restricted)'}")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sniffer.stop()
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
