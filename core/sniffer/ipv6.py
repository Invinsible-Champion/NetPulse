"""
Layer 3 IPv6 (RFC 8200) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct
import socket

IPV6_NEXT_HEADERS = {
    0: "Hop-by-Hop Options",
    1: "ICMPv4",
    6: "TCP",
    17: "UDP",
    43: "Routing",
    44: "Fragment",
    58: "ICMPv6",
    59: "No Next Header",
    60: "Destination Options"
}

def dissect_ipv6(raw_data: bytes) -> dict:
    if len(raw_data) < 40:
        return {"error": "Packet too short for IPv6 (< 40 bytes)"}

    vtc_fl, payload_len, next_header, hop_limit = struct.unpack("!IHBB", raw_data[:8])
    version = (vtc_fl >> 28) & 0x0F
    traffic_class = (vtc_fl >> 20) & 0xFF
    flow_label = vtc_fl & 0x0FFFFF

    src_ip = socket.inet_ntop(socket.AF_INET6, raw_data[8:24])
    dst_ip = socket.inet_ntop(socket.AF_INET6, raw_data[24:40])

    next_proto_name = IPV6_NEXT_HEADERS.get(next_header, f"Unknown ({next_header})")

    tree = {
        "title": f"Internet Protocol Version 6, Src: {src_ip}, Dst: {dst_ip}",
        "fields": [
            f"0110 .... = Version: {version}",
            f"Traffic Class: 0x{traffic_class:02x}",
            f"Flow Label: 0x{flow_label:05x}",
            f"Payload Length: {payload_len}",
            f"Next Header: {next_proto_name} ({next_header})",
            f"Hop Limit: {hop_limit}",
            f"Source Address: {src_ip}",
            f"Destination Address: {dst_ip}"
        ]
    }

    return {
        "version": version,
        "traffic_class": traffic_class,
        "flow_label": flow_label,
        "payload_len": payload_len,
        "next_header": next_header,
        "next_header_name": next_proto_name,
        "hop_limit": hop_limit,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "payload": raw_data[40:40 + payload_len] if (40 + payload_len) <= len(raw_data) else raw_data[40:],
        "tree": tree
    }
