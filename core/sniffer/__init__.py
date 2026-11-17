"""
Sniffer package initialization.
"""
from .dissector import PacketDissector
from .engine import SnifferEngine

__all__ = ["PacketDissector", "SnifferEngine"]
