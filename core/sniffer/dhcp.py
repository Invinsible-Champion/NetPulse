"""
Layer 7 DHCP / BOOTP (RFC 2131 / 2132) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct
import socket
from .ethernet import format_mac

DHCP_MESSAGE_TYPES = {
    1: "DHCP Discover",
    2: "DHCP Offer",
    3: "DHCP Request",
    4: "DHCP Decline",
    5: "DHCP ACK",
    6: "DHCP NAK",
    7: "DHCP Release",
    8: "DHCP Inform"
}

def dissect_dhcp(raw_data: bytes) -> dict | None:
    if len(raw_data) < 240:
        return None

    op, htype, hlen, hops, xid, secs, flags = struct.unpack("!BBBBIHH", raw_data[:12])
    ciaddr = socket.inet_ntoa(raw_data[12:16])
    yiaddr = socket.inet_ntoa(raw_data[16:20])
    siaddr = socket.inet_ntoa(raw_data[20:24])
    giaddr = socket.inet_ntoa(raw_data[24:28])
    chaddr = format_mac(raw_data[28:34])

    # Check DHCP Magic Cookie (0x63825363)
    magic_cookie = raw_data[236:240]
    if magic_cookie != b"\x63\x82\x53\x63":
        return None

    # Parse options
    offset = 240
    dhcp_type_name = "DHCP / BOOTP"
    options_list = []
    while offset < len(raw_data):
        opt_code = raw_data[offset]
        if opt_code == 255:  # End
            break
        elif opt_code == 0:  # Pad
            offset += 1
            continue

        if offset + 1 >= len(raw_data):
            break
        opt_len = raw_data[offset + 1]
        opt_data = raw_data[offset + 2:offset + 2 + opt_len]
        offset += 2 + opt_len

        if opt_code == 53 and len(opt_data) == 1:  # DHCP Message Type
            mtype = opt_data[0]
            dhcp_type_name = DHCP_MESSAGE_TYPES.get(mtype, f"DHCP Type {mtype}")
            options_list.append(f"DHCP Message Type: {dhcp_type_name}")
        elif opt_code == 54 and len(opt_data) == 4:  # Server Identifier
            options_list.append(f"Server Identifier: {socket.inet_ntoa(opt_data)}")
        elif opt_code == 51 and len(opt_data) == 4:  # IP Address Lease Time
            lease = struct.unpack("!I", opt_data)[0]
            options_list.append(f"IP Address Lease Time: {lease}s")
        elif opt_code == 1 and len(opt_data) == 4:  # Subnet Mask
            options_list.append(f"Subnet Mask: {socket.inet_ntoa(opt_data)}")
        elif opt_code == 3 and len(opt_data) >= 4:  # Router
            options_list.append(f"Router: {socket.inet_ntoa(opt_data[:4])}")
        elif opt_code == 6 and len(opt_data) >= 4:  # Domain Name Server
            options_list.append(f"Domain Name Server: {socket.inet_ntoa(opt_data[:4])}")

    info = f"{dhcp_type_name} - Transaction ID 0x{xid:08x}"

    fields = [
        f"Message type: {'Boot Request (1)' if op == 1 else 'Boot Reply (2)'}",
        f"Hardware type: Ethernet (0x01)",
        f"Client MAC address: {chaddr}",
        f"Client IP address: {ciaddr}",
        f"Your (client) IP address: {yiaddr}",
        f"Next server IP address: {siaddr}",
        f"Relay agent IP address: {giaddr}",
        f"Transaction ID: 0x{xid:08x}"
    ] + options_list

    tree = {
        "title": f"Dynamic Host Configuration Protocol ({dhcp_type_name})",
        "fields": fields
    }

    return {
        "op": op,
        "xid": xid,
        "chaddr": chaddr,
        "yiaddr": yiaddr,
        "dhcp_type": dhcp_type_name,
        "info": info,
        "tree": tree
    }
