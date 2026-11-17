"""
Layer 4 UDP (RFC 768) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct

UDP_WELL_KNOWN_PORTS = {
    53: "DNS",
    67: "DHCP-Server",
    68: "DHCP-Client",
    69: "TFTP",
    123: "NTP",
    137: "NetBIOS-Name",
    138: "NetBIOS-Datagram",
    161: "SNMP",
    500: "IKE (IPsec)",
    514: "Syslog",
    1900: "SSDP",
    5353: "mDNS"
}

def dissect_udp(raw_data: bytes) -> dict:
    if len(raw_data) < 8:
        return {"error": "Packet too short for UDP (< 8 bytes)"}

    src_port, dst_port, length, checksum = struct.unpack("!HHHH", raw_data[:8])

    payload = raw_data[8:length] if length <= len(raw_data) else raw_data[8:]
    payload_len = len(payload)

    src_service = UDP_WELL_KNOWN_PORTS.get(src_port, "")
    dst_service = UDP_WELL_KNOWN_PORTS.get(dst_port, "")

    info = f"{src_port} → {dst_port} Len={payload_len}"

    tree = {
        "title": f"User Datagram Protocol, Src Port: {src_port}{f' ({src_service})' if src_service else ''}, Dst Port: {dst_port}{f' ({dst_service})' if dst_service else ''}",
        "fields": [
            f"Source Port: {src_port}{f' ({src_service})' if src_service else ''}",
            f"Destination Port: {dst_port}{f' ({dst_service})' if dst_service else ''}",
            f"Length: {length}",
            f"Checksum: 0x{checksum:04x}",
            f"UDP payload ({payload_len} bytes)"
        ]
    }

    return {
        "src_port": src_port,
        "dst_port": dst_port,
        "src_service": src_service,
        "dst_service": dst_service,
        "length": length,
        "checksum": checksum,
        "payload_length": payload_len,
        "payload": payload,
        "info": info,
        "tree": tree
    }
