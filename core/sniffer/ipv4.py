"""
Layer 3 IPv4 (RFC 791) Dissector.
Built from scratch using binary struct unpacking and bitwise logic.
Includes Internet Checksum verification.
"""
import struct
import socket

IP_PROTOCOLS = {
    1: "ICMP",
    2: "IGMP",
    6: "TCP",
    17: "UDP",
    41: "IPv6-in-IPv4",
    47: "GRE",
    50: "ESP",
    51: "AH",
    89: "OSPF"
}

def verify_checksum(header_bytes: bytes) -> tuple[bool, int, int]:
    """
    Computes RFC 1071 16-bit one's complement sum of the IPv4 header.
    Returns (is_valid, received_checksum, calculated_checksum).
    """
    if len(header_bytes) % 2 != 0:
        header_bytes += b'\x00'
    total = 0
    for i in range(0, len(header_bytes), 2):
        word = (header_bytes[i] << 8) + header_bytes[i + 1]
        total += word
        total = (total & 0xFFFF) + (total >> 16)
    calculated = (~total) & 0xFFFF
    return (calculated == 0), calculated

def dissect_ipv4(raw_data: bytes) -> dict:
    if len(raw_data) < 20:
        return {"error": "Packet too short for IPv4 (< 20 bytes)"}

    v_ihl, tos, total_length, identification, flags_frag, ttl, protocol, checksum = struct.unpack(
        "!BBHHHBBH", raw_data[:12]
    )
    src_ip = socket.inet_ntoa(raw_data[12:16])
    dst_ip = socket.inet_ntoa(raw_data[16:20])

    version = (v_ihl >> 4) & 0x0F
    ihl = (v_ihl & 0x0F) * 4  # bytes

    if ihl < 20 or len(raw_data) < ihl:
        return {"error": f"Invalid IPv4 IHL ({ihl} bytes)"}

    dscp = (tos >> 2) & 0x3F
    ecn = tos & 0x03

    reserved_flag = (flags_frag >> 15) & 0x01
    df_flag = (flags_frag >> 14) & 0x01
    mf_flag = (flags_frag >> 13) & 0x01
    frag_offset = (flags_frag & 0x1FFF) * 8

    proto_name = IP_PROTOCOLS.get(protocol, f"Unknown ({protocol})")

    # Options parsing if IHL > 20
    options = raw_data[20:ihl] if ihl > 20 else b""

    # Validate header checksum
    is_valid, _ = verify_checksum(raw_data[:ihl])

    tree = {
        "title": f"Internet Protocol Version 4, Src: {src_ip}, Dst: {dst_ip}",
        "fields": [
            f"0100 .... = Version: {version}",
            f".... {ihl // 4:04b} = Header Length: {ihl} bytes ({ihl // 4})",
            f"Differentiated Services Field: 0x{tos:02x} (DSCP: CS{dscp >> 3}, ECN: {ecn})",
            f"Total Length: {total_length}",
            f"Identification: 0x{identification:04x} ({identification})",
            f"Flags: 0x{(flags_frag >> 13):02x} (DF: {df_flag}, MF: {mf_flag})",
            f"Fragment Offset: {frag_offset}",
            f"Time to Live (TTL): {ttl}",
            f"Protocol: {proto_name} ({protocol})",
            f"Header Checksum: 0x{checksum:04x} [{'Valid' if is_valid else 'Calculated sum: 0x0'}]",
            f"Source Address: {src_ip}",
            f"Destination Address: {dst_ip}"
        ]
    }

    return {
        "version": version,
        "ihl": ihl,
        "tos": tos,
        "dscp": dscp,
        "ecn": ecn,
        "total_length": total_length,
        "identification": identification,
        "df": bool(df_flag),
        "mf": bool(mf_flag),
        "frag_offset": frag_offset,
        "ttl": ttl,
        "protocol": protocol,
        "protocol_name": proto_name,
        "checksum": checksum,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "options": options.hex(),
        "payload": raw_data[ihl:total_length] if total_length <= len(raw_data) else raw_data[ihl:],
        "tree": tree
    }
