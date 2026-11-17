"""
High-Throughput Speed Test Engine.
Handles memory-buffered data chunks, sliding-window throughput telemetry,
and multi-stream bandwidth benchmarks.
"""
import time
import os
import collections

class ThroughputTracker:
    def __init__(self, window_seconds: float = 1.0):
        self.window_seconds = window_seconds
        # Stores (timestamp, bytes_transferred)
        self.history = collections.deque()
        self.total_bytes = 0
        self.start_time = None
        self.last_update = None
        self.peak_mbps = 0.0

    def start(self):
        self.history.clear()
        self.total_bytes = 0
        self.start_time = time.perf_counter()
        self.last_update = self.start_time
        self.peak_mbps = 0.0

    def add_bytes(self, count: int):
        now = time.perf_counter()
        if self.start_time is None:
            self.start_time = now
        self.total_bytes += count
        self.history.append((now, count))
        self.last_update = now

        # Prune older than sliding window
        cutoff = now - self.window_seconds
        while self.history and self.history[0][0] < cutoff:
            self.history.popleft()

    def get_instant_mbps(self) -> float:
        """Returns current throughput in Megabits per second (Mbps)."""
        now = time.perf_counter()
        cutoff = now - self.window_seconds
        while self.history and self.history[0][0] < cutoff:
            self.history.popleft()

        if not self.history or len(self.history) < 2:
            return 0.0

        duration = now - self.history[0][0]
        if duration <= 0:
            return 0.0

        window_bytes = sum(b for _, b in self.history)
        # (bytes * 8 bits) / (1,000,000 bits/megabit * duration)
        mbps = (window_bytes * 8.0) / (duration * 1_000_000.0)
        if mbps > self.peak_mbps:
            self.peak_mbps = mbps
        return round(mbps, 2)

    def get_average_mbps(self) -> float:
        if not self.start_time or self.total_bytes == 0:
            return 0.0
        duration = (self.last_update or time.perf_counter()) - self.start_time
        if duration <= 0:
            return 0.0
        return round((self.total_bytes * 8.0) / (duration * 1_000_000.0), 2)


class SpeedPayloadPool:
    """
    Pre-generates pseudorandom binary buffers in RAM to ensure that socket transfers
    are limited by network bandwidth, not CPU disk generation.
    """
    def __init__(self, block_size_kb: int = 1024):
        # 1 MB block of random uncompressible bytes
        self.block = os.urandom(block_size_kb * 1024)
        self.block_size = len(self.block)

    def get_chunk(self, size: int) -> bytes:
        if size <= self.block_size:
            return self.block[:size]
        return (self.block * (size // self.block_size + 1))[:size]
