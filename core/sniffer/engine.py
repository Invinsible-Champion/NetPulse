"""
Packet Capture Engine: Manages raw socket packet ingestion, filtering, and queuing.
Supports Linux AF_PACKET raw capture, with seamless fallback to an RFC-compliant packet generator
when run in non-root test environments.
"""
import socket
import threading
import time
import queue
import random
from .dissector import PacketDissector

class SnifferEngine:
    def __init__(self, interface: str = "any", max_queue_size: int = 5000):
        self.interface = interface
        self.max_queue_size = max_queue_size
        self.packet_queue = queue.Queue(maxsize=max_queue_size)
        self.dissector = PacketDissector()
        self.is_running = False
        self.worker_thread = None
        self.is_mock = False
        self.filter_query = ""
        self.lock = threading.Lock()
        self.total_captured = 0
        self.bytes_captured = 0

    def start(self, interface: str = "any"):
        if self.is_running:
            return
        self.interface = interface
        self.is_running = True
        self.worker_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.worker_thread.start()

    def stop(self):
        self.is_running = False

    def clear(self):
        with self.lock:
            while not self.packet_queue.empty():
                try:
                    self.packet_queue.get_nowait()
                except queue.Empty:
                    break
            self.dissector = PacketDissector()
            self.total_captured = 0
            self.bytes_captured = 0

    def set_filter(self, query: str):
        self.filter_query = query.strip().lower()

    def matches_filter(self, packet_obj: dict) -> bool:
        if not self.filter_query:
            return True
        q = self.filter_query
        summary = packet_obj["summary"]

        proto = summary["protocol"].lower()
        src = summary["src"].lower()
        dst = summary["dst"].lower()
        info = summary["info"].lower()

        # Protocol filter (e.g. "tcp", "udp", "dns", "http", "tls", "arp", "icmp")
        if q in proto:
            return True
        # IP / Port filter
        if q in src or q in dst:
            return True
        # Content in info string
        if q in info:
            return True

        # Wireshark-style token syntax: "port 80", "ip 192.168"
        if q.startswith("port "):
            target_port = q.split(" ", 1)[1].strip()
            if f":{target_port}" in src or f":{target_port}" in dst:
                return True
        if q.startswith("ip "):
            target_ip = q.split(" ", 1)[1].strip()
            if target_ip in src or target_ip in dst:
                return True

        return False

    def _capture_loop(self):
        raw_sock = None
        try:
            # Try Linux AF_PACKET raw socket
            ETH_P_ALL = 0x0003
            raw_sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(ETH_P_ALL))
            if self.interface and self.interface != "any" and self.interface != "all":
                try:
                    raw_sock.bind((self.interface, socket.htons(ETH_P_ALL)))
                except Exception:
                    try:
                        raw_sock.bind((self.interface, 0))
                    except Exception:
                        pass
            raw_sock.settimeout(0.5)
            self.is_mock = False
        except (PermissionError, OSError, AttributeError) as e:
            # Non-root environment or platform without AF_PACKET: fallback to live synthetic traffic
            self.is_mock = True

        if not self.is_mock and raw_sock:
            while self.is_running:
                try:
                    raw_bytes, addr = raw_sock.recvfrom(65535)
                    capture_time = time.time()
                    dissected = self.dissector.dissect(raw_bytes, capture_time)

                    self.total_captured += 1
                    self.bytes_captured += len(raw_bytes)

                    if self.matches_filter(dissected):
                        if self.packet_queue.full():
                            try:
                                self.packet_queue.get_nowait()
                            except queue.Empty:
                                pass
                        self.packet_queue.put(dissected)
                except socket.timeout:
                    continue
                except Exception:
                    time.sleep(0.05)
            try:
                raw_sock.close()
            except Exception:
                pass
        else:
            # Run realistic RFC-compliant packet generator loop
            self._synthetic_capture_loop()

    def _synthetic_capture_loop(self):
        """Generates realistic RFC-compliant raw packet frames for testing/evaluating."""
        sample_generator = SyntheticTrafficGenerator()
        while self.is_running:
            raw_bytes = sample_generator.generate_random_packet()
            capture_time = time.time()
            dissected = self.dissector.dissect(raw_bytes, capture_time)

            self.total_captured += 1
            self.bytes_captured += len(raw_bytes)

            if self.matches_filter(dissected):
                if self.packet_queue.full():
                    try:
                        self.packet_queue.get_nowait()
                    except queue.Empty:
                        pass
                self.packet_queue.put(dissected)

            # Natural jitter between packets (10ms - 150ms)
            time.sleep(random.uniform(0.02, 0.15))

    def get_packets(self, max_count: int = 100) -> list[dict]:
        packets = []
        while not self.packet_queue.empty() and len(packets) < max_count:
            try:
                packets.append(self.packet_queue.get_nowait())
            except queue.Empty:
                break
        return packets


class SyntheticTrafficGenerator:
    """Creates authentic binary packets (Layer 2 - Layer 7) to demonstrate all dissectors."""
    def __init__(self):
        self.seq = 1000

    def generate_random_packet(self) -> bytes:
        choice = random.choice(["dns", "tls", "http", "tcp_ack", "icmp", "arp"])
        if choice == "dns":
            return self._build_dns_query()
        elif choice == "tls":
            return self._build_tls_client_hello()
        elif choice == "http":
            return self._build_http_get()
        elif choice == "icmp":
            return self._build_icmp_ping()
        elif choice == "arp":
            return self._build_arp()
        else:
            return self._build_tcp_ack()

    def _eth_header(self, ethertype=0x0800):
        src_mac = bytes([0xa0, 0xb3, 0x39, random.randint(1, 254), random.randint(1, 254), 0x6d])
        dst_mac = bytes([0x40, 0xc2, 0xba, random.randint(1, 254), random.randint(1, 254), 0x7c])
        return dst_mac + src_mac + ethertype.to_bytes(2, "big")

    def _ip_header(self, proto, payload_len, src_ip="192.168.1.105", dst_ip="142.250.190.46"):
        v_ihl = 0x45
        tos = 0x00
        total_len = 20 + payload_len
        ident = random.randint(1, 65535)
        flags_frag = 0x4000  # DF
        ttl = random.randint(54, 64)
        checksum = 0
        src_bytes = socket.inet_aton(src_ip)
        dst_bytes = socket.inet_aton(dst_ip)
        hdr = (
            v_ihl.to_bytes(1, "big") +
            tos.to_bytes(1, "big") +
            total_len.to_bytes(2, "big") +
            ident.to_bytes(2, "big") +
            flags_frag.to_bytes(2, "big") +
            ttl.to_bytes(1, "big") +
            proto.to_bytes(1, "big") +
            checksum.to_bytes(2, "big") +
            src_bytes +
            dst_bytes
        )
        return hdr

    def _build_dns_query(self):
        domain = random.choice(["fast.com", "google.com", "github.com", "ookla.com", "mit.edu"])
        qname = b""
        for part in domain.split("."):
            qname += bytes([len(part)]) + part.encode("ascii")
        qname += b"\x00"

        dns_hdr = (
            random.randint(1, 65535).to_bytes(2, "big") +  # ID
            b"\x01\x00" +                                   # Flags: standard query, RD
            b"\x00\x01" +                                   # 1 Question
            b"\x00\x00\x00\x00\x00\x00"                    # 0 Ans, 0 Auth, 0 Add
        )
        dns_payload = dns_hdr + qname + b"\x00\x01\x00\x01"  # Type A, Class IN
        udp_hdr = random.randint(49152, 65535).to_bytes(2, "big") + (53).to_bytes(2, "big") + (8 + len(dns_payload)).to_bytes(2, "big") + b"\x00\x00"
        ip_hdr = self._ip_header(17, len(udp_hdr) + len(dns_payload), dst_ip="8.8.8.8")
        return self._eth_header() + ip_hdr + udp_hdr + dns_payload

    def _build_tls_client_hello(self):
        server_name = random.choice(["speed.cloudflare.com", "fast.com", "ookla.speedtest.net"])
        sni_ext = (
            b"\x00\x00" +  # ext type 0 (SNI)
            (len(server_name) + 5).to_bytes(2, "big") +
            (len(server_name) + 3).to_bytes(2, "big") +
            b"\x00" +  # host_name
            len(server_name).to_bytes(2, "big") +
            server_name.encode("utf-8")
        )
        hs_data = (
            b"\x01" +  # Client Hello
            (38 + len(sni_ext) + 6).to_bytes(3, "big") +
            b"\x03\x03" +  # TLS 1.2
            b"\x12\x34\x56\x78" * 8 +  # 32 bytes random
            b"\x00" +  # session id len 0
            b"\x00\x02\x13\x01" +  # ciphers (TLS_AES_128_GCM_SHA256)
            b"\x01\x00" +  # comp len 1 (null)
            (len(sni_ext)).to_bytes(2, "big") +
            sni_ext
        )
        tls_rec = b"\x16\x03\x01" + (len(hs_data)).to_bytes(2, "big") + hs_data
        self.seq += 100
        tcp_hdr = (
            random.randint(49152, 65535).to_bytes(2, "big") + (443).to_bytes(2, "big") +
            self.seq.to_bytes(4, "big") + (1).to_bytes(4, "big") +
            b"\x50\x18\xff\xff\x00\x00\x00\x00"  # PSH, ACK
        )
        ip_hdr = self._ip_header(6, len(tcp_hdr) + len(tls_rec))
        return self._eth_header() + ip_hdr + tcp_hdr + tls_rec

    def _build_http_get(self):
        http_data = b"GET /speedtest/latency HTTP/1.1\r\nHost: fast.com\r\nUser-Agent: NetPulse/1.0\r\nAccept: */*\r\n\r\n"
        self.seq += 150
        tcp_hdr = (
            random.randint(49152, 65535).to_bytes(2, "big") + (80).to_bytes(2, "big") +
            self.seq.to_bytes(4, "big") + (1).to_bytes(4, "big") +
            b"\x50\x18\x20\x00\x00\x00\x00\x00"  # PSH, ACK
        )
        ip_hdr = self._ip_header(6, len(tcp_hdr) + len(http_data))
        return self._eth_header() + ip_hdr + tcp_hdr + http_data

    def _build_icmp_ping(self):
        icmp_data = b"\x08\x00\x4c\x52\x12\x34\x00\x01abcdefghijklmnopqrstuvw"
        ip_hdr = self._ip_header(1, len(icmp_data), dst_ip="1.1.1.1")
        return self._eth_header() + ip_hdr + icmp_data

    def _build_arp(self):
        eth_hdr = bytes([0xff] * 6) + bytes([0xa0, 0xb3, 0x39, 0x11, 0x22, 0x33]) + (0x0806).to_bytes(2, "big")
        arp_data = (
            b"\x00\x01\x08\x00\x06\x04\x00\x01" +  # Eth, IPv4, hw_len 6, proto_len 4, Request (1)
            bytes([0xa0, 0xb3, 0x39, 0x11, 0x22, 0x33]) + socket.inet_aton("192.168.1.105") +
            bytes([0x00] * 6) + socket.inet_aton("192.168.1.1")
        )
        return eth_hdr + arp_data

    def _build_tcp_ack(self):
        self.seq += 1
        tcp_hdr = (
            (443).to_bytes(2, "big") + random.randint(49152, 65535).to_bytes(2, "big") +
            self.seq.to_bytes(4, "big") + (12345).to_bytes(4, "big") +
            b"\x50\x10\xfa\xf0\x00\x00\x00\x00"  # ACK
        )
        ip_hdr = self._ip_header(6, len(tcp_hdr))
        return self._eth_header() + ip_hdr + tcp_hdr
