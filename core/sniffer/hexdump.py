"""
Hexdump generator for raw packet bytes.
Produces authentic Wireshark-style Hex + ASCII side-by-side view.
"""

def generate_hexdump(data: bytes) -> list[dict]:
    """
    Format raw bytes into an array of rows:
    [
        {"offset": "0000", "hex": "45 00 00 3c 1a 2b ...", "ascii": "E..<.+..."},
        ...
    ]
    """
    rows = []
    length = len(data)
    for i in range(0, length, 16):
        chunk = data[i:i + 16]
        hex_bytes = [f"{b:02x}" for b in chunk]
        # Pad with spaces if less than 16 bytes
        hex_str = " ".join(hex_bytes)
        if len(chunk) < 16:
            hex_str = hex_str.ljust(16 * 3 - 1)
        
        # Wireshark splits 16 bytes into two 8-byte groups with extra space
        if len(hex_bytes) > 8:
            first_8 = " ".join(hex_bytes[:8])
            last_8 = " ".join(hex_bytes[8:])
            hex_formatted = f"{first_8}  {last_8}".ljust(49)
        else:
            hex_formatted = hex_str.ljust(49)

        ascii_chars = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
        rows.append({
            "offset": f"{i:04x}",
            "hex": hex_formatted,
            "raw_hex": hex_bytes,
            "ascii": ascii_chars,
            "start_byte": i,
            "end_byte": i + len(chunk)
        })
    return rows
