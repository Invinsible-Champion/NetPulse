"""
Layer 3/4 ICMPv4 (RFC 792) and ICMPv6 (RFC 4443) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct

ICMPV4_TYPES = {
    0: "Echo (ping) Reply",
    3: "Destination Unreachable",
    4: "Source Quench",
    5: "Redirect",
    8: "Echo (ping) Request",
    11: "Time Exceeded (TTL expired)",
    12: "Parameter Problem",
    13: "Timestamp Request",
    14: "Timestamp Reply"
}

ICMPV6_TYPES = {
    1: "Destination Unreachable",
    2: "Packet Too Big",
    3: "Time Exceeded",
    4: "Parameter Problem",
    128: "Echo Request",
    129: "Echo Reply",
    133: "Router Solicitation",
    134: "Router Advertisement",
    135: "Neighbor Solicitation",
    136: "Neighbor Advertisement"
}

def dissect_icmp(raw_data: bytes, is_ipv6: bool = False) -> dict:
    if len(raw_data) < 8:
        return {"error": "ICMP packet too short (< 8 bytes)"}

    icmp_type, code, checksum, rest = struct.unpack("!BBHI", raw_data[:8])

    type_dict = ICMPV6_TYPES if is_ipv6 else ICMPV4_TYPES
    proto_label = "ICMPv6" if is_ipv6 else "ICMP"
    type_name = type_dict.get(icmp_type, f"Type {icmp_type}")

    identifier = (rest >> 16) & 0xFFFF
    sequence = rest & 0xFFFF

    is_echo = (icmp_type in (0, 8)) if not is_ipv6 else (icmp_type in (128, 129))
    info = f"{type_name} id=0x{identifier:04x}, seq={sequence}" if is_echo else f"{type_name} (code={code})"

    fields = [
        f"Type: {icmp_type} ({type_name})",
        f"Code: {code}",
        f"Checksum: 0x{checksum:04x}"
    ]
    if is_echo:
        fields.append(f"Identifier (BE): {identifier} (0x{identifier:04x})")
        fields.append(f"Sequence Number (BE): {sequence} (0x{sequence:04x})")

    tree = {
        "title": f"{proto_label} ({type_name})",
        "fields": fields
    }

    return {
        "type": icmp_type,
        "code": code,
        "checksum": checksum,
        "type_name": type_name,
        "identifier": identifier if is_echo else None,
        "sequence": sequence if is_echo else None,
        "info": info,
        "payload": raw_data[8:],
        "tree": tree
    }
