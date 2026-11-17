"""
Layer 4 TCP (RFC 793) Dissector with Flag and Option Decoding.
Built from scratch using binary struct unpacking.
"""
import struct

TCP_WELL_KNOWN_PORTS = {
    20: "FTP-Data",
    21: "FTP-Control",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    443: "HTTPS",
    465: "SMTPS",
    587: "Submission",
    993: "IMAPS",
    995: "POP3S",
    3306: "MySQL",
    5432: "PostgreSQL",
    8080: "HTTP-Alt",
    8443: "HTTPS-Alt"
}

def parse_tcp_options(options_bytes: bytes) -> list[str]:
    """Parse common TCP options: EOL, NOP, MSS, Window Scale, SACK Permitted, Timestamps."""
    options = []
    i = 0
    length = len(options_bytes)
    while i < length:
        kind = options_bytes[i]
        if kind == 0:  # End of Option List
            options.append("EOL")
            break
        elif kind == 1:  # NOP
            options.append("NOP")
            i += 1
            continue

        if i + 1 >= length:
            break
        opt_len = options_bytes[i + 1]
        if opt_len < 2 or i + opt_len > length:
            break

        data = options_bytes[i + 2:i + opt_len]
        if kind == 2 and len(data) == 2:  # MSS
            mss = struct.unpack("!H", data)[0]
            options.append(f"Maximum Segment Size: {mss} bytes")
        elif kind == 3 and len(data) == 1:  # Window Scale
            shift = data[0]
            options.append(f"Window Scale: {shift} (multiply by {1 << shift})")
        elif kind == 4:  # SACK Permitted
            options.append("SACK Permitted")
        elif kind == 8 and len(data) == 8:  # Timestamps
            ts_val, ts_ecr = struct.unpack("!II", data)
            options.append(f"Timestamps: TSval {ts_val}, TSecr {ts_ecr}")
        else:
            options.append(f"Option {kind} (len {opt_len})")
        i += opt_len
    return options

def dissect_tcp(raw_data: bytes) -> dict:
    if len(raw_data) < 20:
        return {"error": "Packet too short for TCP (< 20 bytes)"}

    src_port, dst_port, seq_num, ack_num, offset_flags, window_size, checksum, urgent_ptr = struct.unpack(
        "!HHIIHHHH", raw_data[:20]
    )

    data_offset = (offset_flags >> 12) * 4  # bytes
    if data_offset < 20 or len(raw_data) < data_offset:
        return {"error": f"Invalid TCP data offset ({data_offset} bytes)"}

    flags_raw = offset_flags & 0x01FF
    flags = {
        "cwr": bool(flags_raw & 0x0080),
        "ece": bool(flags_raw & 0x0040),
        "urg": bool(flags_raw & 0x0020),
        "ack": bool(flags_raw & 0x0010),
        "psh": bool(flags_raw & 0x0008),
        "rst": bool(flags_raw & 0x0004),
        "syn": bool(flags_raw & 0x0002),
        "fin": bool(flags_raw & 0x0001)
    }

    active_flags = [k.upper() for k, v in flags.items() if v]
    flag_str = f"[{', '.join(active_flags)}]" if active_flags else "[None]"

    payload = raw_data[data_offset:]
    payload_len = len(payload)

    # Info summary line matching Wireshark style: 54321 -> 443 [SYN] Seq=0 Win=65535 Len=0
    info = f"{src_port} → {dst_port} {flag_str} Seq={seq_num}"
    if flags["ack"]:
        info += f" Ack={ack_num}"
    info += f" Win={window_size} Len={payload_len}"

    src_service = TCP_WELL_KNOWN_PORTS.get(src_port, "")
    dst_service = TCP_WELL_KNOWN_PORTS.get(dst_port, "")

    options = []
    if data_offset > 20:
        options = parse_tcp_options(raw_data[20:data_offset])

    tree = {
        "title": f"Transmission Control Protocol, Src Port: {src_port}{f' ({src_service})' if src_service else ''}, Dst Port: {dst_port}{f' ({dst_service})' if dst_service else ''}, Seq: {seq_num}, Ack: {ack_num}",
        "fields": [
            f"Source Port: {src_port}{f' ({src_service})' if src_service else ''}",
            f"Destination Port: {dst_port}{f' ({dst_service})' if dst_service else ''}",
            f"Sequence Number (raw): {seq_num}",
            f"Acknowledgment Number (raw): {ack_num}",
            f"Header Length: {data_offset} bytes ({data_offset // 4})",
            f"Flags: 0x{flags_raw:03x} {flag_str}",
            f".... .... ...{int(flags['fin'])} = FIN: {flags['fin']}",
            f".... .... ..{int(flags['syn'])}. = SYN: {flags['syn']}",
            f".... .... .{int(flags['rst'])}.. = RST: {flags['rst']}",
            f".... .... {int(flags['psh'])}... = PSH: {flags['psh']}",
            f".... ...{int(flags['ack'])} .... = ACK: {flags['ack']}",
            f".... ..{int(flags['urg'])}. .... = URG: {flags['urg']}",
            f".... .{int(flags['ece'])}.. .... = ECE: {flags['ece']}",
            f".... {int(flags['cwr'])}... .... = CWR: {flags['cwr']}",
            f"Window Size value: {window_size}",
            f"Checksum: 0x{checksum:04x}",
            f"Urgent Pointer: {urgent_ptr}",
            f"TCP Payload Length: {payload_len} bytes"
        ]
    }
    if options:
        tree["fields"].append(f"Options: ({len(options)} options)")
        for opt in options:
            tree["fields"].append(f"  > {opt}")

    return {
        "src_port": src_port,
        "dst_port": dst_port,
        "src_service": src_service,
        "dst_service": dst_service,
        "seq_num": seq_num,
        "ack_num": ack_num,
        "header_length": data_offset,
        "flags": flags,
        "flag_str": flag_str,
        "window_size": window_size,
        "checksum": checksum,
        "urgent_ptr": urgent_ptr,
        "options": options,
        "payload_length": payload_len,
        "payload": payload,
        "info": info,
        "tree": tree
    }
