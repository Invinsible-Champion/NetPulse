"""
Layer 7 DNS (RFC 1035) Dissector.
Built from scratch with support for recursive label pointer decompression.
"""
import struct
import socket

DNS_TYPES = {
    1: "A",
    2: "NS",
    5: "CNAME",
    6: "SOA",
    12: "PTR",
    15: "MX",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
    41: "OPT",
    255: "ANY"
}

DNS_CLASSES = {
    1: "IN (Internet)",
    3: "CH (Chaos)",
    4: "HS (Hesiod)",
    255: "ANY"
}

def decode_domain_name(data: bytes, offset: int, depth: int = 0) -> tuple[str, int]:
    """
    Decodes RFC 1035 domain name labels with pointer compression (0xC0).
    Returns (domain_name, next_offset).
    """
    labels = []
    original_offset = offset
    stepped = False
    max_depth = 15

    while offset < len(data) and depth < max_depth:
        length = data[offset]
        if length == 0:
            if not stepped:
                original_offset = offset + 1
            break
        # Pointer compression check: two most significant bits set (0xC0)
        elif (length & 0xC0) == 0xC0:
            if offset + 1 >= len(data):
                break
            pointer_offset = ((length & 0x3F) << 8) | data[offset + 1]
            if not stepped:
                original_offset = offset + 2
                stepped = True
            offset = pointer_offset
            depth += 1
        else:
            offset += 1
            if offset + length > len(data):
                break
            labels.append(data[offset:offset + length].decode("utf-8", errors="replace"))
            offset += length
            if not stepped:
                original_offset = offset

    domain = ".".join(labels) if labels else "<root>"
    return domain, original_offset

def dissect_dns(raw_data: bytes) -> dict:
    if len(raw_data) < 12:
        return {"error": "DNS packet too short (< 12 bytes)"}

    tx_id, flags_raw, qd_count, an_count, ns_count, ar_count = struct.unpack("!HHHHHH", raw_data[:12])

    is_response = bool((flags_raw >> 15) & 0x01)
    opcode = (flags_raw >> 11) & 0x0F
    authoritative = bool((flags_raw >> 10) & 0x01)
    truncated = bool((flags_raw >> 9) & 0x01)
    recursion_desired = bool((flags_raw >> 8) & 0x01)
    recursion_available = bool((flags_raw >> 7) & 0x01)
    rcode = flags_raw & 0x0F

    rcode_names = {0: "No error", 1: "Format error", 2: "Server failure", 3: "Non-existent domain (NXDOMAIN)"}
    rcode_str = rcode_names.get(rcode, f"Code {rcode}")

    offset = 12
    questions = []
    for _ in range(qd_count):
        if offset >= len(raw_data):
            break
        qname, offset = decode_domain_name(raw_data, offset)
        if offset + 4 <= len(raw_data):
            qtype, qclass = struct.unpack("!HH", raw_data[offset:offset + 4])
            offset += 4
            questions.append({
                "name": qname,
                "type": DNS_TYPES.get(qtype, str(qtype)),
                "class": DNS_CLASSES.get(qclass, str(qclass))
            })

    answers = []
    for _ in range(an_count):
        if offset >= len(raw_data):
            break
        aname, offset = decode_domain_name(raw_data, offset)
        if offset + 10 <= len(raw_data):
            atype, aclass, attl, rdlength = struct.unpack("!HHIH", raw_data[offset:offset + 10])
            offset += 10
            rdata_raw = raw_data[offset:offset + rdlength]
            offset += rdlength

            rdata_str = ""
            if atype == 1 and rdlength == 4:  # A record (IPv4)
                rdata_str = socket.inet_ntoa(rdata_raw)
            elif atype == 28 and rdlength == 16:  # AAAA record (IPv6)
                rdata_str = socket.inet_ntop(socket.AF_INET6, rdata_raw)
            elif atype in (2, 5):  # CNAME or NS
                rdata_str, _ = decode_domain_name(raw_data, offset - rdlength)
            else:
                rdata_str = rdata_raw.hex()

            answers.append({
                "name": aname,
                "type": DNS_TYPES.get(atype, str(atype)),
                "ttl": attl,
                "data": rdata_str
            })

    info_summary = "Standard query" if not is_response else "Standard query response"
    if questions:
        info_summary += f" 0x{tx_id:04x} {questions[0]['type']} {questions[0]['name']}"
    if answers:
        info_summary += f" -> {answers[0]['data']}"

    fields = [
        f"Transaction ID: 0x{tx_id:04x}",
        f"Flags: 0x{flags_raw:04x} ({'Response' if is_response else 'Query'}, {rcode_str})",
        f"  {'1' if is_response else '0'}... .... .... .... = Response: {'Message is a response' if is_response else 'Message is a query'}",
        f"  .... {'1' if authoritative else '0'}... .... .... = Authoritative: {authoritative}",
        f"  .... .... {'1' if recursion_desired else '0'}... .... = Recursion desired: {recursion_desired}",
        f"  .... .... .{'1' if recursion_available else '0'}.. .... = Recursion available: {recursion_available}",
        f"Questions: {qd_count}",
        f"Answer RRs: {an_count}",
        f"Authority RRs: {ns_count}",
        f"Additional RRs: {ar_count}"
    ]

    for q in questions:
        fields.append(f"Queries: {q['name']}: type {q['type']}, class {q['class']}")
    for a in answers:
        fields.append(f"Answers: {a['name']}: type {a['type']}, {a['data']} (TTL {a['ttl']})")

    tree = {
        "title": f"Domain Name System ({'response' if is_response else 'query'})",
        "fields": fields
    }

    return {
        "tx_id": tx_id,
        "is_response": is_response,
        "opcode": opcode,
        "rcode": rcode,
        "rcode_str": rcode_str,
        "questions": questions,
        "answers": answers,
        "info": info_summary,
        "tree": tree
    }
