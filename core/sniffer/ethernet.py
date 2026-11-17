"""
Layer 2 Ethernet II Frame and 802.1Q VLAN Dissector.
Built from scratch using binary struct unpacking.
"""
import struct

ETHERTYPES = {
    0x0800: "IPv4",
    0x0806: "ARP",
    0x86DD: "IPv6",
    0x8100: "802.1Q VLAN",
    0x88CC: "LLDP",
    0x888E: "802.1X Auth"
}

def format_mac(raw_mac: bytes) -> str:
    """Format 6 bytes into colon-separated hex MAC: aa:bb:cc:dd:ee:ff"""
    return ":".join(f"{b:02x}" for b in raw_mac)

def dissect_ethernet(raw_data: bytes) -> dict:
    """
    Dissects Ethernet II frame.
    Header format:
    Destination MAC (6 bytes), Source MAC (6 bytes), EtherType (2 bytes)
    """
    if len(raw_data) < 14:
        return {"error": "Packet too short for Ethernet II (< 14 bytes)"}

    dst_mac_raw, src_mac_raw, ethertype = struct.unpack("!6s6sH", raw_data[:14])
    dst_mac = format_mac(dst_mac_raw)
    src_mac = format_mac(src_mac_raw)

    offset = 14
    vlan_info = None

    # Check for 802.1Q VLAN Tagging (0x8100)
    if ethertype == 0x8100 and len(raw_data) >= 18:
        vlan_tci, encapsulated_ethertype = struct.unpack("!HH", raw_data[14:18])
        pcp = (vlan_tci >> 13) & 0x07
        dei = (vlan_tci >> 12) & 0x01
        vid = vlan_tci & 0x0FFF
        vlan_info = {
            "tci": f"0x{vlan_tci:04x}",
            "pcp": pcp,
            "dei": dei,
            "vid": vid,
            "encapsulated_ethertype": f"0x{encapsulated_ethertype:04x}",
            "encapsulated_protocol": ETHERTYPES.get(encapsulated_ethertype, f"Unknown (0x{encapsulated_ethertype:04x})")
        }
        ethertype = encapsulated_ethertype
        offset = 18

    ethertype_name = ETHERTYPES.get(ethertype, f"Unknown (0x{ethertype:04x})")

    tree = {
        "title": f"Ethernet II, Src: {src_mac}, Dst: {dst_mac}",
        "fields": [
            f"Destination: {dst_mac}",
            f"Source: {src_mac}",
            f"Type: {ethertype_name} (0x{ethertype:04x})"
        ]
    }
    if vlan_info:
        tree["fields"].append(f"802.1Q VLAN: VID={vlan_info['vid']}, PCP={vlan_info['pcp']}")

    return {
        "src_mac": src_mac,
        "dst_mac": dst_mac,
        "ethertype": ethertype,
        "ethertype_name": ethertype_name,
        "vlan": vlan_info,
        "header_length": offset,
        "payload": raw_data[offset:],
        "tree": tree
    }
