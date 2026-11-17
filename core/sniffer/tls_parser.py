"""
Layer 7 TLS (Transport Layer Security) Dissector & SNI Extractor.
Built from scratch using binary struct unpacking.
"""
import struct

TLS_RECORD_TYPES = {
    20: "Change Cipher Spec",
    21: "Alert",
    22: "Handshake",
    23: "Application Data",
    24: "Heartbeat"
}

TLS_HANDSHAKE_TYPES = {
    1: "Client Hello",
    2: "Server Hello",
    4: "New Session Ticket",
    11: "Certificate",
    12: "Server Key Exchange",
    13: "Certificate Request",
    14: "Server Hello Done",
    15: "Certificate Verify",
    16: "Client Key Exchange",
    20: "Finished"
}

TLS_VERSIONS = {
    0x0300: "SSL 3.0",
    0x0301: "TLS 1.0",
    0x0302: "TLS 1.1",
    0x0303: "TLS 1.2",
    0x0304: "TLS 1.3"
}

def extract_sni_from_client_hello(payload: bytes) -> str | None:
    """Extract Server Name Indication (SNI) hostname from TLS Client Hello."""
    try:
        # Handshake: type (1 byte), length (3 bytes), version (2 bytes), random (32 bytes)
        if len(payload) < 38:
            return None
        offset = 38
        # Session ID
        if offset >= len(payload):
            return None
        session_id_len = payload[offset]
        offset += 1 + session_id_len

        # Cipher Suites
        if offset + 2 > len(payload):
            return None
        cipher_suites_len = struct.unpack("!H", payload[offset:offset + 2])[0]
        offset += 2 + cipher_suites_len

        # Compression Methods
        if offset >= len(payload):
            return None
        comp_len = payload[offset]
        offset += 1 + comp_len

        # Extensions
        if offset + 2 > len(payload):
            return None
        ext_total_len = struct.unpack("!H", payload[offset:offset + 2])[0]
        offset += 2
        ext_end = offset + ext_total_len

        while offset + 4 <= min(len(payload), ext_end):
            ext_type, ext_len = struct.unpack("!HH", payload[offset:offset + 4])
            offset += 4
            if ext_type == 0:  # SNI Extension
                if offset + 2 <= len(payload):
                    # server_name_list_length (2 bytes)
                    # sni_type (1 byte: 0 = host_name), name_length (2 bytes)
                    sni_type = payload[offset + 2]
                    if sni_type == 0:
                        name_len = struct.unpack("!H", payload[offset + 3:offset + 5])[0]
                        sni_name = payload[offset + 5:offset + 5 + name_len].decode("utf-8", errors="replace")
                        return sni_name
            offset += ext_len
    except Exception:
        pass
    return None

def dissect_tls(raw_data: bytes) -> dict | None:
    if len(raw_data) < 5:
        return None

    content_type, version, record_len = struct.unpack("!BHH", raw_data[:5])
    if content_type not in TLS_RECORD_TYPES or (version >> 8) != 3:
        return None

    record_type_name = TLS_RECORD_TYPES.get(content_type, f"Type {content_type}")
    ver_name = TLS_VERSIONS.get(version, f"0x{version:04x}")

    info = f"{ver_name} Record Layer: {record_type_name}"
    handshake_type_name = None
    sni = None

    fields = [
        f"Content Type: {record_type_name} ({content_type})",
        f"Version: {ver_name} (0x{version:04x})",
        f"Length: {record_len}"
    ]

    if content_type == 22 and len(raw_data) >= 9:  # Handshake
        hs_type = raw_data[5]
        handshake_type_name = TLS_HANDSHAKE_TYPES.get(hs_type, f"Handshake {hs_type}")
        fields.append(f"Handshake Protocol: {handshake_type_name}")

        if hs_type == 1:  # Client Hello
            sni = extract_sni_from_client_hello(raw_data[5:])
            if sni:
                info = f"Client Hello, SNI: {sni}"
                fields.append(f"Server Name Indication: {sni}")
            else:
                info = "Client Hello"
        elif hs_type == 2:
            info = "Server Hello"
    elif content_type == 23:
        info = f"{ver_name} Application Data"

    tree = {
        "title": f"Transport Layer Security ({ver_name} {record_type_name})",
        "fields": fields
    }

    return {
        "content_type": content_type,
        "content_type_name": record_type_name,
        "version": version,
        "version_name": ver_name,
        "record_length": record_len,
        "handshake_type": handshake_type_name,
        "sni": sni,
        "info": info,
        "tree": tree
    }
