"""
Master Packet Dissector: Orchestrates multi-layer packet decoding.
Produces structured packet objects matching Wireshark's 3-pane representation:
1. Packet Summary (List View)
2. Decoded Protocol Tree (Tree View)
3. Hex & ASCII Dump (Bytes View)
"""
import time
from .ethernet import dissect_ethernet
from .arp import dissect_arp
from .ipv4 import dissect_ipv4
from .ipv6 import dissect_ipv6
from .icmp import dissect_icmp
from .tcp import dissect_tcp
from .udp import dissect_udp
from .dns import dissect_dns
from .http_parser import dissect_http
from .tls_parser import dissect_tls
from .dhcp import dissect_dhcp
from .ntp import dissect_ntp
from .hexdump import generate_hexdump

class PacketDissector:
    def __init__(self):
        self.packet_counter = 0
        self.start_time = None

    def dissect(self, raw_bytes: bytes, capture_time: float | None = None) -> dict:
        self.packet_counter += 1
        if capture_time is None:
            capture_time = time.time()
        if self.start_time is None:
            self.start_time = capture_time

        relative_time = capture_time - self.start_time
        total_len = len(raw_bytes)

        summary = {
            "no": self.packet_counter,
            "time": f"{relative_time:.6f}",
            "src": "Unknown",
            "dst": "Unknown",
            "protocol": "RAW",
            "length": total_len,
            "info": f"Raw packet ({total_len} bytes)"
        }

        tree_layers = []

        # 1. Layer 2: Ethernet
        eth = dissect_ethernet(raw_bytes)
        if "error" in eth:
            summary["info"] = eth["error"]
            return {
                "summary": summary,
                "tree": [{"title": "Malformed Packet", "fields": [eth["error"]]}],
                "hexdump": generate_hexdump(raw_bytes),
                "raw_len": total_len
            }

        tree_layers.append(eth["tree"])
        summary["src"] = eth["src_mac"]
        summary["dst"] = eth["dst_mac"]
        summary["protocol"] = eth["ethertype_name"]
        summary["info"] = f"Ethernet II, Src: {eth['src_mac']}, Dst: {eth['dst_mac']}"

        payload = eth["payload"]
        ethertype = eth["ethertype"]

        # 2. Layer 3: ARP, IPv4, IPv6
        if ethertype == 0x0806:  # ARP
            arp = dissect_arp(payload)
            if "error" not in arp:
                summary["protocol"] = "ARP"
                summary["src"] = arp["sender_ip"]
                summary["dst"] = arp["target_ip"]
                summary["info"] = arp["info"]
                tree_layers.append(arp["tree"])

        elif ethertype == 0x0800:  # IPv4
            ip4 = dissect_ipv4(payload)
            if "error" not in ip4:
                summary["src"] = ip4["src_ip"]
                summary["dst"] = ip4["dst_ip"]
                summary["protocol"] = ip4["protocol_name"]
                summary["info"] = f"IPv4 from {ip4['src_ip']} to {ip4['dst_ip']} (TTL={ip4['ttl']})"
                tree_layers.append(ip4["tree"])

                l4_proto = ip4["protocol"]
                l4_payload = ip4["payload"]

                # 3. Layer 4: TCP, UDP, ICMP
                if l4_proto == 1:  # ICMP
                    icmp = dissect_icmp(l4_payload, is_ipv6=False)
                    if "error" not in icmp:
                        summary["protocol"] = "ICMP"
                        summary["info"] = icmp["info"]
                        tree_layers.append(icmp["tree"])

                elif l4_proto == 6:  # TCP
                    self._process_tcp(l4_payload, summary, tree_layers)

                elif l4_proto == 17:  # UDP
                    self._process_udp(l4_payload, summary, tree_layers)

        elif ethertype == 0x86DD:  # IPv6
            ip6 = dissect_ipv6(payload)
            if "error" not in ip6:
                summary["src"] = ip6["src_ip"]
                summary["dst"] = ip6["dst_ip"]
                summary["protocol"] = ip6["next_header_name"]
                summary["info"] = f"IPv6 from {ip6['src_ip']} to {ip6['dst_ip']}"
                tree_layers.append(ip6["tree"])

                next_proto = ip6["next_header"]
                l4_payload = ip6["payload"]

                if next_proto == 58:  # ICMPv6
                    icmp6 = dissect_icmp(l4_payload, is_ipv6=True)
                    if "error" not in icmp6:
                        summary["protocol"] = "ICMPv6"
                        summary["info"] = icmp6["info"]
                        tree_layers.append(icmp6["tree"])
                elif next_proto == 6:  # TCP
                    self._process_tcp(l4_payload, summary, tree_layers)
                elif next_proto == 17:  # UDP
                    self._process_udp(l4_payload, summary, tree_layers)

        # 4. Generate Wireshark-Style Hex/ASCII Dump
        hexdump_rows = generate_hexdump(raw_bytes)

        return {
            "summary": summary,
            "tree": tree_layers,
            "hexdump": hexdump_rows,
            "raw_len": total_len
        }

    def _process_tcp(self, payload: bytes, summary: dict, tree_layers: list):
        tcp = dissect_tcp(payload)
        if "error" in tcp:
            return
        summary["protocol"] = "TCP"
        summary["src"] = f"{summary['src']}:{tcp['src_port']}"
        summary["dst"] = f"{summary['dst']}:{tcp['dst_port']}"
        summary["info"] = tcp["info"]
        tree_layers.append(tcp["tree"])

        app_payload = tcp["payload"]
        if not app_payload:
            return

        # Try TLS
        if tcp["src_port"] in (443, 8443) or tcp["dst_port"] in (443, 8443) or app_payload.startswith(b"\x16\x03"):
            tls = dissect_tls(app_payload)
            if tls:
                summary["protocol"] = "TLS"
                summary["info"] = tls["info"]
                tree_layers.append(tls["tree"])
                return

        # Try HTTP
        http = dissect_http(app_payload)
        if http:
            summary["protocol"] = "HTTP"
            summary["info"] = http["info"]
            tree_layers.append(http["tree"])
            return

        # Try DNS over TCP
        if tcp["src_port"] == 53 or tcp["dst_port"] == 53:
            if len(app_payload) > 2:
                dns = dissect_dns(app_payload[2:])
                if "error" not in dns:
                    summary["protocol"] = "DNS"
                    summary["info"] = dns["info"]
                    tree_layers.append(dns["tree"])

    def _process_udp(self, payload: bytes, summary: dict, tree_layers: list):
        udp = dissect_udp(payload)
        if "error" in udp:
            return
        summary["protocol"] = "UDP"
        summary["src"] = f"{summary['src']}:{udp['src_port']}"
        summary["dst"] = f"{summary['dst']}:{udp['dst_port']}"
        summary["info"] = udp["info"]
        tree_layers.append(udp["tree"])

        app_payload = udp["payload"]
        if not app_payload:
            return

        # Try DNS (Port 53 or 5353 mDNS)
        if udp["src_port"] in (53, 5353) or udp["dst_port"] in (53, 5353):
            dns = dissect_dns(app_payload)
            if "error" not in dns:
                summary["protocol"] = "mDNS" if 5353 in (udp["src_port"], udp["dst_port"]) else "DNS"
                summary["info"] = dns["info"]
                tree_layers.append(dns["tree"])
                return

        # Try DHCP (Port 67/68)
        if (udp["src_port"] in (67, 68) or udp["dst_port"] in (67, 68)):
            dhcp = dissect_dhcp(app_payload)
            if dhcp:
                summary["protocol"] = "DHCP"
                summary["info"] = dhcp["info"]
                tree_layers.append(dhcp["tree"])
                return

        # Try NTP (Port 123)
        if udp["src_port"] == 123 or udp["dst_port"] == 123:
            ntp = dissect_ntp(app_payload)
            if ntp:
                summary["protocol"] = "NTP"
                summary["info"] = ntp["info"]
                tree_layers.append(ntp["tree"])
                return
