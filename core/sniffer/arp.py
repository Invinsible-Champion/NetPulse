"""
Layer 3 ARP (Address Resolution Protocol - RFC 826) Dissector.
Built from scratch using binary struct unpacking.
"""
import struct
import socket
from .ethernet import format_mac

ARP_OPCODES = {
    1: "Request (1)",
    2: "Reply (2)",
    3: "RARP-Request (3)",
    4: "RARP-Reply (4)"
}

def dissect_arp(raw_data: bytes) -> dict:
    if len(raw_data) < 28:
        return {"error": "ARP packet too short (< 28 bytes)"}

    hw_type, proto_type, hw_size, proto_size, opcode = struct.unpack("!HHBBH", raw_data[:8])
    
    sender_mac = format_mac(raw_data[8:14])
    sender_ip = socket.inet_ntoa(raw_data[14:18])
    target_mac = format_mac(raw_data[18:24])
    target_ip = socket.inet_ntoa(raw_data[24:28])

    opcode_name = ARP_OPCODES.get(opcode, f"Unknown ({opcode})")

    info = f"Who has {target_ip}? Tell {sender_ip}" if opcode == 1 else f"{sender_ip} is at {sender_mac}"

    tree = {
        "title": f"Address Resolution Protocol ({opcode_name})",
        "fields": [
            f"Hardware type: {hw_type} ({'Ethernet' if hw_type == 1 else 'Other'})",
            f"Protocol type: 0x{proto_type:04x} ({'IPv4' if proto_type == 0x0800 else 'Other'})",
            f"Hardware size: {hw_size}",
            f"Protocol size: {proto_size}",
            f"Opcode: {opcode_name}",
            f"Sender MAC address: {sender_mac}",
            f"Sender IP address: {sender_ip}",
            f"Target MAC address: {target_mac}",
            f"Target IP address: {target_ip}"
        ]
    }

    return {
        "hw_type": hw_type,
        "proto_type": proto_type,
        "opcode": opcode,
        "opcode_name": opcode_name,
        "sender_mac": sender_mac,
        "sender_ip": sender_ip,
        "target_mac": target_mac,
        "target_ip": target_ip,
        "info": info,
        "tree": tree
    }
