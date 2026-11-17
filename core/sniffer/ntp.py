"""
Layer 7 NTP (Network Time Protocol - RFC 5905) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct

NTP_MODES = {
    0: "Reserved",
    1: "Symmetric active",
    2: "Symmetric passive",
    3: "Client",
    4: "Server",
    5: "Broadcast",
    6: "NTP control message",
    7: "Private"
}

def dissect_ntp(raw_data: bytes) -> dict | None:
    if len(raw_data) < 48:
        return None

    flags, stratum, poll, precision = struct.unpack("!BBbB", raw_data[:4])
    li = (flags >> 6) & 0x03
    version = (flags >> 3) & 0x07
    mode = flags & 0x07

    if version < 1 or version > 4 or mode not in NTP_MODES:
        return None

    mode_name = NTP_MODES.get(mode, f"Mode {mode}")
    root_delay, root_dispersion, ref_id = struct.unpack("!II4s", raw_data[4:16])

    info = f"NTP Version {version}, {mode_name}"

    tree = {
        "title": f"Network Time Protocol (NTP Version {version}, {mode_name})",
        "fields": [
            f"Flags: 0x{flags:02x} (Leap: {li}, Version: {version}, Mode: {mode_name})",
            f"Peer Stratum: {stratum}",
            f"Peer Polling Interval: {poll}",
            f"Peer Precision: {precision}",
            f"Root Delay: {root_delay / 65536.0:.4f} sec",
            f"Root Dispersion: {root_dispersion / 65536.0:.4f} sec",
            f"Reference ID: {ref_id.decode('latin-1', errors='replace')}"
        ]
    }

    return {
        "version": version,
        "mode": mode_name,
        "stratum": stratum,
        "info": info,
        "tree": tree
    }
