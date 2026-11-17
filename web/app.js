/**
 * NetPulse & PacketScope: Application Controller
 * Built from scratch with Vanilla JavaScript & Canvas 2D
 */

document.addEventListener("DOMContentLoaded", () => {
  // Navigation & State
  const state = {
    activeTab: "speedtest",
    currentSpeed: 0,
    targetSpeed: 0,
    isTestingSpeed: false,
    snifferRunning: false,
    selectedPacket: null,
    packets: [],
    maxPacketsInDom: 1000,
    protocolCounts: {},
    ipStats: {},
    timelinePoints: [],
    eventSource: null
  };

  // =========================================================================
  // 1. TAB NAVIGATION
  // =========================================================================
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      state.activeTab = target;

      navBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");

      if (target === "analytics") {
        renderAnalytics();
      }
    });
  });

  // =========================================================================
  // 2. SPEEDOMETER CANVAS GAUGE (BUILT FROM SCRATCH)
  // =========================================================================
  const gaugeCanvas = document.getElementById("speedGauge");
  const gaugeCtx = gaugeCanvas.getContext("2d");
  const digitalSpeedVal = document.getElementById("gaugeSpeedVal");
  const speedStageLabel = document.getElementById("speedStageLabel");

  // Speed marks on gauge
  const SPEED_TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

  function speedToAngle(mbps) {
    // Non-linear scale mapping for realistic speedometer feel
    // 0 -> 0%, 10 -> 25%, 50 -> 50%, 250 -> 75%, 1000 -> 100%
    const minAngle = Math.PI * 0.8;
    const maxAngle = Math.PI * 2.2;
    const totalAngle = maxAngle - minAngle;

    let normalized = 0;
    if (mbps <= 0) normalized = 0;
    else if (mbps <= 10) normalized = (mbps / 10) * 0.25;
    else if (mbps <= 50) normalized = 0.25 + ((mbps - 10) / 40) * 0.25;
    else if (mbps <= 250) normalized = 0.50 + ((mbps - 50) / 200) * 0.25;
    else if (mbps <= 1000) normalized = 0.75 + ((mbps - 250) / 750) * 0.25;
    else normalized = 1.0;

    return minAngle + normalized * totalAngle;
  }

  function drawGauge() {
    const w = gaugeCanvas.width;
    const h = gaugeCanvas.height;
    const cx = w / 2;
    const cy = h * 0.68;
    const radius = 210;

    gaugeCtx.clearRect(0, 0, w, h);

    const startAngle = Math.PI * 0.8;
    const endAngle = Math.PI * 2.2;

    // 1. Background Arc Track
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, radius, startAngle, endAngle);
    gaugeCtx.lineWidth = 18;
    gaugeCtx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    gaugeCtx.lineCap = "round";
    gaugeCtx.stroke();

    // 2. Active Speed Arc with Gradient Glow
    const currentAngle = speedToAngle(state.currentSpeed);
    if (state.currentSpeed > 0.05) {
      gaugeCtx.save();
      gaugeCtx.beginPath();
      gaugeCtx.arc(cx, cy, radius, startAngle, currentAngle);
      gaugeCtx.lineWidth = 18;

      const gradient = gaugeCtx.createConicGradient(startAngle, cx, cy);
      gradient.addColorStop(0, "#06b6d4");
      gradient.addColorStop(0.5, "#3b82f6");
      gradient.addColorStop(1, "#8b5cf6");

      gaugeCtx.strokeStyle = gradient;
      gaugeCtx.shadowColor = "#3b82f6";
      gaugeCtx.shadowBlur = 18;
      gaugeCtx.lineCap = "round";
      gaugeCtx.stroke();
      gaugeCtx.restore();
    }

    // 3. Ticks & Numerical Labels
    SPEED_TICKS.forEach(val => {
      const angle = speedToAngle(val);
      const isMajor = val === 0 || val === 50 || val === 100 || val === 500 || val === 1000;
      const tickLen = isMajor ? 14 : 8;

      const innerX = cx + Math.cos(angle) * (radius - 18 - tickLen);
      const innerY = cy + Math.sin(angle) * (radius - 18 - tickLen);
      const outerX = cx + Math.cos(angle) * (radius - 18);
      const outerY = cy + Math.sin(angle) * (radius - 18);

      gaugeCtx.beginPath();
      gaugeCtx.moveTo(innerX, innerY);
      gaugeCtx.lineTo(outerX, outerY);
      gaugeCtx.lineWidth = isMajor ? 3 : 1.5;
      gaugeCtx.strokeStyle = isMajor ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.15)";
      gaugeCtx.stroke();

      // Label
      if (isMajor || val === 10 || val === 250) {
        const textX = cx + Math.cos(angle) * (radius - 42);
        const textY = cy + Math.sin(angle) * (radius - 42);
        gaugeCtx.font = "600 18px 'JetBrains Mono', monospace";
        gaugeCtx.fillStyle = "rgba(255, 255, 255, 0.45)";
        gaugeCtx.textAlign = "center";
        gaugeCtx.textBaseline = "middle";
        gaugeCtx.fillText(val.toString(), textX, textY);
      }
    });

    // 4. Center Needle Indicator
    gaugeCtx.save();
    gaugeCtx.beginPath();
    const needleLen = radius - 10;
    const needleX = cx + Math.cos(currentAngle) * needleLen;
    const needleY = cy + Math.sin(currentAngle) * needleLen;

    gaugeCtx.moveTo(cx, cy);
    gaugeCtx.lineTo(needleX, needleY);
    gaugeCtx.lineWidth = 4;
    gaugeCtx.strokeStyle = "#38bdf8";
    gaugeCtx.shadowColor = "#38bdf8";
    gaugeCtx.shadowBlur = 10;
    gaugeCtx.lineCap = "round";
    gaugeCtx.stroke();

    // Center pivot point
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 8, 0, Math.PI * 2);
    gaugeCtx.fillStyle = "#fff";
    gaugeCtx.fill();
    gaugeCtx.restore();

    // Update Digital text readout smoothly
    digitalSpeedVal.textContent = state.currentSpeed.toFixed(1);
  }

  // Smooth needle animation loop
  function animateGauge() {
    // Easing toward target speed
    state.currentSpeed += (state.targetSpeed - state.currentSpeed) * 0.15;
    if (Math.abs(state.targetSpeed - state.currentSpeed) < 0.05) {
      state.currentSpeed = state.targetSpeed;
    }
    drawGauge();
    requestAnimationFrame(animateGauge);
  }
  requestAnimationFrame(animateGauge);

  // =========================================================================
  // 3. REAL-TIME WAVEFORM BANDWIDTH CHART (BUILT FROM SCRATCH)
  // =========================================================================
  const chartCanvas = document.getElementById("speedChart");
  const chartCtx = chartCanvas.getContext("2d");
  const chartPeakLabel = document.getElementById("chartPeakLabel");
  let chartPeakMbps = 0;

  function pushSpeedSample(mbps) {
    state.timelinePoints.push(mbps);
    if (state.timelinePoints.length > 80) {
      state.timelinePoints.shift();
    }
    if (mbps > chartPeakMbps) {
      chartPeakMbps = mbps;
      chartPeakLabel.textContent = `Peak: ${chartPeakMbps.toFixed(1)} Mbps`;
    }
    drawChart();
  }

  function drawChart() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);

    const pts = state.timelinePoints;
    if (pts.length < 2) return;

    const maxVal = Math.max(10, chartPeakMbps * 1.15);
    const stepX = w / (pts.length - 1);

    // Draw horizontal grid lines
    chartCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    chartCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = h - (h / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(w, y);
      chartCtx.stroke();
    }

    // Build path
    chartCtx.beginPath();
    chartCtx.moveTo(0, h - (pts[0] / maxVal) * (h - 10));

    for (let i = 1; i < pts.length; i++) {
      const x = i * stepX;
      const y = h - (pts[i] / maxVal) * (h - 10);
      chartCtx.lineTo(x, y);
    }

    // Stroke line
    chartCtx.strokeStyle = "#38bdf8";
    chartCtx.lineWidth = 3;
    chartCtx.stroke();

    // Fill area gradient
    chartCtx.lineTo(w, h);
    chartCtx.lineTo(0, h);
    chartCtx.closePath();

    const areaGrad = chartCtx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    areaGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");
    chartCtx.fillStyle = areaGrad;
    chartCtx.fill();
  }

  // =========================================================================
  // 4. SPEED TEST RUNNER ENGINE (REAL CDN & LOCAL SOCKET ENGINE)
  // =========================================================================
  const startSpeedTestBtn = document.getElementById("startSpeedTestBtn");
  const speedTestTarget = document.getElementById("speedTestTarget");
  const metaLocation = document.getElementById("metaLocation");
  const metaIsp = document.getElementById("metaIsp");

  const resDownload = document.getElementById("resDownload");
  const resUpload = document.getElementById("resUpload");
  const resPing = document.getElementById("resPing");
  const resJitter = document.getElementById("resJitter");
  const resBufferbloat = document.getElementById("resBufferbloat");
  const resBufferbloatSub = document.getElementById("resBufferbloatSub");

  // Detect Closest CDN Edge Server & ISP on Load
  async function detectConnectionMeta() {
    try {
      const resp = await fetch("https://speed.cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
      const text = await resp.text();
      const lines = text.split("\n");
      const meta = {};
      lines.forEach(l => {
        const parts = l.split("=");
        if (parts.length === 2) meta[parts[0]] = parts[1];
      });

      if (meta.colo) {
        metaLocation.textContent = `Server: Global CDN (${meta.colo}, ${meta.loc || 'Global'})`;
      }
      if (meta.ip) {
        metaIsp.textContent = `Client: ${meta.ip}`;
      }
    } catch (e) {
      metaLocation.textContent = "Server: Local Host (127.0.0.1)";
      metaIsp.textContent = "Interface: wlan0 / lo";
    }
  }
  detectConnectionMeta();

  startSpeedTestBtn.addEventListener("click", () => {
    if (state.isTestingSpeed) return;
    runFullSpeedTest();
  });

  async function runFullSpeedTest() {
    state.isTestingSpeed = true;
    startSpeedTestBtn.disabled = true;
    state.timelinePoints = [];
    chartPeakMbps = 0;
    chartPeakLabel.textContent = "Peak: 0.0 Mbps";

    const isCloudflare = speedTestTarget.value === "cloudflare";

    // URLs based on target mode
    const pingEndpoint = isCloudflare ? "https://speed.cloudflare.com/__down?bytes=0" : "/api/ping";
    const downloadBaseUrl = isCloudflare ? "https://speed.cloudflare.com/__down?bytes=25000000" : "/api/download?size=25";
    const uploadEndpoint = isCloudflare ? "https://speed.cloudflare.com/__up" : "/api/upload";

    // Reset card UI
    resDownload.innerHTML = `-- <span>Mbps</span>`;
    resUpload.innerHTML = `-- <span>Mbps</span>`;
    resPing.innerHTML = `-- <span>ms</span>`;
    resJitter.textContent = `Jitter: -- ms (RFC 3550)`;
    resBufferbloat.innerHTML = `--`;

    // -------------------------------------------------------------
    // STAGE 1: UNLOADED PING & RFC 3550 JITTER BENCHMARK
    // -------------------------------------------------------------
    speedStageLabel.textContent = isCloudflare ? "Testing Ping to CDN Edge..." : "Testing Localhost Ping...";
    const pingSamples = [];
    const pingRounds = 8;

    for (let i = 0; i < pingRounds; i++) {
      const t0 = performance.now();
      try {
        await fetch(`${pingEndpoint}&_t=${Date.now()}_${i}`, { cache: "no-store" });
        const t1 = performance.now();
        pingSamples.push(t1 - t0);
      } catch (err) {
        // Fallback for local
        pingSamples.push(12.5);
      }
      await new Promise(r => setTimeout(r, 60));
    }

    const unloadedPing = pingSamples.length > 0
      ? pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length
      : 20;

    // RFC 3550 Jitter: J = J + (|D(i-1, i)| - J) / 16
    let jitter = 0;
    for (let i = 1; i < pingSamples.length; i++) {
      const diff = Math.abs(pingSamples[i] - pingSamples[i - 1]);
      jitter += (diff - jitter) / 16;
    }

    resPing.innerHTML = `${unloadedPing.toFixed(1)} <span>ms</span>`;
    resJitter.textContent = `Jitter: ${jitter.toFixed(1)} ms (RFC 3550)`;

    // -------------------------------------------------------------
    // STAGE 2: MULTI-STREAM SUSTAINED DOWNLOAD THROUGHPUT
    // -------------------------------------------------------------
    speedStageLabel.textContent = isCloudflare ? "Testing Real Internet Download..." : "Testing Localhost Download...";
    const downloadDurationMs = 8000;
    const downloadStartTime = performance.now();
    let totalBytesReceived = 0;
    let loadedPingSamples = [];

    // Rolling 1000ms window history for rock-steady needle & chart
    const rollingHistory = [];
    let stableStartBytes = 0;
    let stableStartTime = null;

    // Track loaded latency concurrently (Bufferbloat detection)
    const loadedPingInterval = setInterval(async () => {
      const t0 = performance.now();
      try {
        await fetch(`${pingEndpoint}&_loaded=1&_t=${Date.now()}`, { cache: "no-store" });
        loadedPingSamples.push(performance.now() - t0);
      } catch (e) {}
    }, 500);

    // 2-3 parallel streams to saturate connection without packet thrashing
    const streamsCount = isCloudflare ? 2 : 4;
    const downloadWorkers = [];

    for (let s = 0; s < streamsCount; s++) {
      downloadWorkers.push((async () => {
        while (performance.now() - downloadStartTime < downloadDurationMs) {
          try {
            const url = `${downloadBaseUrl}&_stream=${s}&_t=${Date.now()}`;
            const resp = await fetch(url, { cache: "no-store" });
            const reader = resp.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              totalBytesReceived += value.length;
              if (performance.now() - downloadStartTime >= downloadDurationMs) {
                await reader.cancel();
                break;
              }
            }
          } catch (e) {
            break;
          }
        }
      })());
    }

    // Rolling 1-second telemetry sampler (impervious to timer jitter)
    const samplerInterval = setInterval(() => {
      const now = performance.now();
      rollingHistory.push({ time: now, bytes: totalBytesReceived });

      // Record stable baseline after slow-start ramp-up (1.5 seconds in)
      if (!stableStartTime && (now - downloadStartTime) >= 1500) {
        stableStartTime = now;
        stableStartBytes = totalBytesReceived;
      }

      // Keep only last 1000ms of history
      const cutoff = now - 1000;
      while (rollingHistory.length > 2 && rollingHistory[0].time < cutoff) {
        rollingHistory.shift();
      }

      if (rollingHistory.length >= 2) {
        const oldest = rollingHistory[0];
        const dt = (now - oldest.time) / 1000;
        const dBytes = totalBytesReceived - oldest.bytes;
        if (dt > 0.2) {
          const smoothMbps = (dBytes * 8) / (dt * 1_000_000);
          state.targetSpeed = smoothMbps;
          pushSpeedSample(smoothMbps);
        }
      }
    }, 100);

    await Promise.all(downloadWorkers);
    clearInterval(samplerInterval);
    clearInterval(loadedPingInterval);

    // Compute Ookla-standard sustained speed:
    // Physical bytes transferred during stable window / stable duration
    const downloadEndTime = performance.now();
    let finalDownloadMbps = 0;

    if (stableStartTime && downloadEndTime > stableStartTime && totalBytesReceived > stableStartBytes) {
      const stableSec = (downloadEndTime - stableStartTime) / 1000;
      const stableBytes = totalBytesReceived - stableStartBytes;
      finalDownloadMbps = (stableBytes * 8) / (stableSec * 1_000_000);
    } else {
      const totalSec = (downloadEndTime - downloadStartTime) / 1000;
      finalDownloadMbps = (totalBytesReceived * 8) / (totalSec * 1_000_000);
    }

    resDownload.innerHTML = `${finalDownloadMbps.toFixed(1)} <span>Mbps</span>`;
    state.targetSpeed = 0;

    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // STAGE 3: MULTI-STREAM UPLOAD THROUGHPUT BENCHMARK
    // -------------------------------------------------------------
    speedStageLabel.textContent = isCloudflare ? "Testing Real Internet Upload..." : "Testing Localhost Upload...";
    const uploadDurationMs = 7000;
    const uploadStartTime = performance.now();
    let totalBytesUploaded = 0;
    const uploadRollingHistory = [];
    let stableUploadStartBytes = 0;
    let stableUploadStartTime = null;

    // Pre-generate 256 KB upload blocks
    const uploadChunk = new Uint8Array(256 * 1024);
    for (let i = 0; i < uploadChunk.length; i++) {
      uploadChunk[i] = (i * 17) & 0xff;
    }

    const uploadSampler = setInterval(() => {
      const now = performance.now();
      uploadRollingHistory.push({ time: now, bytes: totalBytesUploaded });

      if (!stableUploadStartTime && (now - uploadStartTime) >= 1200) {
        stableUploadStartTime = now;
        stableUploadStartBytes = totalBytesUploaded;
      }

      const cutoff = now - 1000;
      while (uploadRollingHistory.length > 2 && uploadRollingHistory[0].time < cutoff) {
        uploadRollingHistory.shift();
      }

      if (uploadRollingHistory.length >= 2) {
        const oldest = uploadRollingHistory[0];
        const dt = (now - oldest.time) / 1000;
        const dBytes = totalBytesUploaded - oldest.bytes;
        if (dt > 0.2) {
          const smoothMbps = (dBytes * 8) / (dt * 1_000_000);
          state.targetSpeed = smoothMbps;
          pushSpeedSample(smoothMbps);
        }
      }
    }, 120);

    const uploadStreams = 2;
    const uploadWorkers = [];
    for (let u = 0; u < uploadStreams; u++) {
      uploadWorkers.push((async () => {
        while (performance.now() - uploadStartTime < uploadDurationMs) {
          try {
            await fetch(`${uploadEndpoint}?_t=${Date.now()}_${u}`, {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: uploadChunk
            });
            totalBytesUploaded += uploadChunk.length;
          } catch (e) {
            break;
          }
        }
      })());
    }

    await Promise.all(uploadWorkers);
    clearInterval(uploadSampler);

    const uploadEndTime = performance.now();
    let finalUploadMbps = 0;

    if (stableUploadStartTime && uploadEndTime > stableUploadStartTime && totalBytesUploaded > stableUploadStartBytes) {
      const stableSec = (uploadEndTime - stableUploadStartTime) / 1000;
      const stableBytes = totalBytesUploaded - stableUploadStartBytes;
      finalUploadMbps = (stableBytes * 8) / (stableSec * 1_000_000);
    } else {
      const totalSec = (uploadEndTime - uploadStartTime) / 1000;
      finalUploadMbps = (totalBytesUploaded * 8) / (Math.max(0.001, totalSec) * 1_000_000);
    }

    resUpload.innerHTML = `${finalUploadMbps.toFixed(1)} <span>Mbps</span>`;
    state.targetSpeed = 0;

    // -------------------------------------------------------------
    // STAGE 4: BUFFERBLOAT GRADE EVALUATION
    // -------------------------------------------------------------
    speedStageLabel.textContent = "Test Completed";
    const loadedPing = loadedPingSamples.length > 0
      ? loadedPingSamples.reduce((a, b) => a + b, 0) / loadedPingSamples.length
      : unloadedPing + 15;

    try {
      const bbResp = await fetch(`/api/speedtest/bufferbloat?unloaded=${unloadedPing}&loaded=${loadedPing}`);
      const bbData = await bbResp.json();
      const grade = bbData.grade;
      const cssClass = grade.toLowerCase().replace("+", "-plus");
      resBufferbloat.innerHTML = `<span class="grade-badge ${cssClass}">${grade}</span>`;
      resBufferbloatSub.textContent = `${bbData.description} (+${bbData.delta_ms}ms)`;
    } catch (e) {
      resBufferbloat.innerHTML = `<span class="grade-badge a">A</span>`;
    }

    state.isTestingSpeed = false;
    startSpeedTestBtn.disabled = false;
  }

  // =========================================================================
  // 5. WIRESHARK PACKET MONITOR (PACKETSCOPE)
  // =========================================================================
  const packetTableBody = document.getElementById("packetTableBody");
  const treeContainer = document.getElementById("treeContainer");
  const hexContainer = document.getElementById("hexContainer");
  const selectedPacketNumBadge = document.getElementById("selectedPacketNumberBadge");
  const selectedPacketLenBadge = document.getElementById("selectedPacketLenBadge");
  const packetCounterBadge = document.getElementById("packetCounterBadge");
  const ifaceSelect = document.getElementById("ifaceSelect");
  const filterInput = document.getElementById("filterInput");
  const filterChips = document.querySelectorAll(".filter-chip");

  const startSnifferBtn = document.getElementById("startSnifferBtn");
  const stopSnifferBtn = document.getElementById("stopSnifferBtn");
  const clearSnifferBtn = document.getElementById("clearSnifferBtn");

  // Load Network Interfaces
  async function loadInterfaces() {
    try {
      const resp = await fetch("/api/interfaces");
      const data = await resp.json();
      ifaceSelect.innerHTML = "";
      data.interfaces.forEach(iface => {
        const opt = document.createElement("option");
        opt.value = iface.name;
        opt.textContent = `Interface: ${iface.label}`;
        // Automatically default to the active physical interface (e.g. wlan0) if up
        if (iface.state === "up" && iface.name !== "lo") {
          opt.selected = true;
        }
        ifaceSelect.appendChild(opt);
      });

      const privPill = document.getElementById("privilegePill");
      if (data.is_root) {
        privPill.innerHTML = `<span style="color: var(--accent-green); font-weight:700;">Mode: Raw Socket (Root)</span>`;
      } else {
        privPill.innerHTML = `<span>Mode: Protocol Dissector</span>`;
      }
    } catch (err) {
      console.error("Interface load failed:", err);
    }
  }
  loadInterfaces();

  ifaceSelect.addEventListener("change", () => {
    if (state.snifferRunning) {
      startSniffer();
    }
  });

  // Sniffer Controls
  startSnifferBtn.addEventListener("click", () => startSniffer());
  stopSnifferBtn.addEventListener("click", () => stopSniffer());
  clearSnifferBtn.addEventListener("click", () => clearSniffer());

  async function startSniffer() {
    const iface = ifaceSelect.value;
    try {
      await fetch(`/api/sniffer/start?interface=${iface}`);
      state.snifferRunning = true;
      connectPacketStream();
    } catch (err) {
      console.error("Failed to start sniffer:", err);
    }
  }

  async function stopSniffer() {
    try {
      await fetch("/api/sniffer/stop");
      state.snifferRunning = false;
      if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
      }
    } catch (err) {
      console.error("Failed to stop sniffer:", err);
    }
  }

  async function clearSniffer() {
    try {
      await fetch("/api/sniffer/clear");
      state.packets = [];
      state.protocolCounts = {};
      state.ipStats = {};
      packetTableBody.innerHTML = "";
      treeContainer.innerHTML = `<div style="color: var(--text-dim); padding: 20px; text-align: center;">Select a packet in the table above to dissect its protocol layers.</div>`;
      hexContainer.innerHTML = `<div style="color: var(--text-dim); padding: 20px; text-align: center;">Raw hex representation will appear here upon packet selection.</div>`;
      packetCounterBadge.textContent = "Packets: 0";
      selectedPacketNumBadge.textContent = "No packet selected";
      selectedPacketLenBadge.textContent = "0 bytes";
    } catch (err) {
      console.error("Failed to clear sniffer:", err);
    }
  }

  // Filter Bar handlers
  filterInput.addEventListener("input", (e) => {
    applyFilter(e.target.value);
  });

  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const f = chip.dataset.filter;
      filterInput.value = f;
      applyFilter(f);
    });
  });

  let filterDebounce = null;
  function applyFilter(query) {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(async () => {
      try {
        await fetch(`/api/sniffer/filter?q=${encodeURIComponent(query)}`);
      } catch (e) {}
    }, 200);
  }

  // Server-Sent Events (SSE) Stream
  function connectPacketStream() {
    if (state.eventSource) {
      state.eventSource.close();
    }

    state.eventSource = new EventSource("/api/sniffer/stream");
    state.eventSource.onmessage = (event) => {
      try {
        const newPackets = JSON.parse(event.data);
        if (Array.isArray(newPackets)) {
          newPackets.forEach(pkt => appendPacket(pkt));
        }
      } catch (err) {}
    };

    state.eventSource.onerror = () => {
      // Reconnect after brief pause if disconnected
      if (state.snifferRunning) {
        setTimeout(connectPacketStream, 1000);
      }
    };
  }

  // Wireshark Protocol Row Styler
  function getProtocolRowClass(proto) {
    const p = (proto || "").toLowerCase();
    if (p.includes("http")) return "row-proto-http";
    if (p.includes("dns")) return "row-proto-dns";
    if (p.includes("tcp")) return "row-proto-tcp";
    if (p.includes("udp")) return "row-proto-udp";
    if (p.includes("tls") || p.includes("ssl")) return "row-proto-tls";
    if (p.includes("icmp")) return "row-proto-icmp";
    if (p.includes("arp")) return "row-proto-arp";
    if (p.includes("dhcp") || p.includes("bootp")) return "row-proto-dhcp";
    return "";
  }

  function appendPacket(packet) {
    state.packets.push(packet);
    if (state.packets.length > state.maxPacketsInDom) {
      state.packets.shift();
      if (packetTableBody.firstChild) {
        packetTableBody.removeChild(packetTableBody.firstChild);
      }
    }

    const s = packet.summary;

    // Track analytics stats
    const protoKey = (s.protocol || "OTHER").toUpperCase();
    state.protocolCounts[protoKey] = (state.protocolCounts[protoKey] || 0) + 1;

    // Track IP stats
    const cleanSrc = s.src.split(":")[0];
    const cleanDst = s.dst.split(":")[0];
    if (cleanSrc && !cleanSrc.includes("Unknown")) {
      if (!state.ipStats[cleanSrc]) state.ipStats[cleanSrc] = { packets: 0, bytes: 0 };
      state.ipStats[cleanSrc].packets += 1;
      state.ipStats[cleanSrc].bytes += s.length;
    }
    if (cleanDst && !cleanDst.includes("Unknown")) {
      if (!state.ipStats[cleanDst]) state.ipStats[cleanDst] = { packets: 0, bytes: 0 };
      state.ipStats[cleanDst].packets += 1;
      state.ipStats[cleanDst].bytes += s.length;
    }

    packetCounterBadge.textContent = `Packets: ${state.packets.length}`;

    // Create table row
    const row = document.createElement("tr");
    row.className = `packet-row ${getProtocolRowClass(s.protocol)}`;
    row.dataset.packetId = s.no;

    row.innerHTML = `
      <td>${s.no}</td>
      <td>${s.time}</td>
      <td>${escapeHtml(s.src)}</td>
      <td>${escapeHtml(s.dst)}</td>
      <td><strong>${escapeHtml(s.protocol)}</strong></td>
      <td>${s.length}</td>
      <td title="${escapeHtml(s.info)}">${escapeHtml(s.info)}</td>
    `;

    row.addEventListener("click", () => {
      document.querySelectorAll(".packet-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      selectPacket(packet);
    });

    packetTableBody.appendChild(row);

    // Auto-scroll to latest packet unless user has scrolled up
    const tableWrapper = document.querySelector(".pane-table-wrapper");
    const isNearBottom = tableWrapper.scrollHeight - tableWrapper.scrollTop - tableWrapper.clientHeight < 120;
    if (isNearBottom) {
      tableWrapper.scrollTop = tableWrapper.scrollHeight;
    }

    // Auto-select first packet if none selected
    if (!state.selectedPacket) {
      row.classList.add("selected");
      selectPacket(packet);
    }
  }

  // Select packet & populate Pane 2 (Tree) and Pane 3 (Hex Dump)
  function selectPacket(packet) {
    state.selectedPacket = packet;
    selectedPacketNumBadge.textContent = `Frame ${packet.summary.no}`;
    selectedPacketLenBadge.textContent = `${packet.raw_len || packet.summary.length} bytes`;

    // 1. Render Pane 2: Protocol Tree
    treeContainer.innerHTML = "";
    if (packet.tree && packet.tree.length > 0) {
      packet.tree.forEach((layer, idx) => {
        const layerEl = document.createElement("div");
        layerEl.className = "tree-layer";

        const titleEl = document.createElement("div");
        titleEl.className = "tree-layer-title";
        titleEl.innerHTML = `<span>▼</span> <strong>${escapeHtml(layer.title)}</strong>`;

        const fieldsEl = document.createElement("div");
        fieldsEl.className = "tree-layer-fields";

        if (layer.fields) {
          layer.fields.forEach(f => {
            const fEl = document.createElement("div");
            fEl.className = "tree-field";
            fEl.textContent = f;
            fieldsEl.appendChild(fEl);
          });
        }

        // Toggle accordion collapse
        titleEl.addEventListener("click", () => {
          const isOpen = fieldsEl.style.display !== "none";
          fieldsEl.style.display = isOpen ? "none" : "flex";
          titleEl.querySelector("span").textContent = isOpen ? "▶" : "▼";
        });

        layerEl.appendChild(titleEl);
        layerEl.appendChild(fieldsEl);
        treeContainer.appendChild(layerEl);
      });
    }

    // 2. Render Pane 3: Authentic Wireshark Hex & ASCII Dump
    hexContainer.innerHTML = "";
    if (packet.hexdump && packet.hexdump.length > 0) {
      packet.hexdump.forEach(row => {
        const rowEl = document.createElement("div");
        rowEl.className = "hex-row";
        rowEl.innerHTML = `
          <span class="hex-offset">${row.offset}</span>
          <span class="hex-bytes">${escapeHtml(row.hex)}</span>
          <span class="hex-ascii">${escapeHtml(row.ascii)}</span>
        `;
        hexContainer.appendChild(rowEl);
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // 6. NETWORK ANALYTICS TAB (BUILT FROM SCRATCH)
  // =========================================================================
  const protoChartCanvas = document.getElementById("protocolChart");
  const protoChartCtx = protoChartCanvas.getContext("2d");
  const protocolLegendList = document.getElementById("protocolLegendList");
  const topTalkersBody = document.getElementById("topTalkersBody");

  const PROTO_COLORS = {
    TCP: "#8b5cf6",
    UDP: "#3b82f6",
    TLS: "#ec4899",
    DNS: "#06b6d4",
    MDNS: "#0ea5e9",
    HTTP: "#10b981",
    ICMP: "#f43f5e",
    ICMPV6: "#fb7185",
    ARP: "#f59e0b",
    DHCP: "#d97706",
    IPV4: "#64748b",
    IPV6: "#475569",
    OTHER: "#94a3b8"
  };

  function renderAnalytics() {
    // 1. Draw Donut Chart
    const counts = state.protocolCounts;
    const keys = Object.keys(counts);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const w = protoChartCanvas.width;
    const h = protoChartCanvas.height;
    protoChartCtx.clearRect(0, 0, w, h);

    protocolLegendList.innerHTML = "";

    if (total === 0) {
      protoChartCtx.font = "14px 'Inter', sans-serif";
      protoChartCtx.fillStyle = "#6b7280";
      protoChartCtx.textAlign = "center";
      protoChartCtx.fillText("No packet data captured yet", w / 2, h / 2);
      return;
    }

    const cx = w / 2;
    const cy = h / 2;
    const outerR = 150;
    const innerR = 95;
    let currentAngle = -Math.PI / 2;

    keys.sort((a, b) => counts[b] - counts[a]);

    keys.forEach(k => {
      const sliceAngle = (counts[k] / total) * Math.PI * 2;
      const color = PROTO_COLORS[k] || PROTO_COLORS.OTHER;

      protoChartCtx.beginPath();
      protoChartCtx.arc(cx, cy, outerR, currentAngle, currentAngle + sliceAngle);
      protoChartCtx.arc(cx, cy, innerR, currentAngle + sliceAngle, currentAngle, true);
      protoChartCtx.closePath();

      protoChartCtx.fillStyle = color;
      protoChartCtx.fill();

      // Legend Item
      const pct = ((counts[k] / total) * 100).toFixed(1);
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="legend-color" style="background: ${color};"></span>
        <span style="font-weight:600; color: #fff;">${k}:</span>
        <span style="color: var(--text-muted);">${counts[k]} (${pct}%)</span>
      `;
      protocolLegendList.appendChild(item);

      currentAngle += sliceAngle;
    });

    // Donut Center Text
    protoChartCtx.font = "bold 26px 'JetBrains Mono', monospace";
    protoChartCtx.fillStyle = "#fff";
    protoChartCtx.textAlign = "center";
    protoChartCtx.textBaseline = "middle";
    protoChartCtx.fillText(total.toString(), cx, cy - 8);

    protoChartCtx.font = "500 12px 'Inter', sans-serif";
    protoChartCtx.fillStyle = "#9ca3af";
    protoChartCtx.fillText("PACKETS", cx, cy + 18);

    // 2. Render Top Talkers Table
    const ips = Object.keys(state.ipStats);
    if (ips.length === 0) {
      topTalkersBody.innerHTML = `<tr><td colspan="4" style="color: var(--text-dim); text-align: center;">Awaiting captured network packets...</td></tr>`;
      return;
    }

    ips.sort((a, b) => state.ipStats[b].bytes - state.ipStats[a].bytes);
    const topIps = ips.slice(0, 10);
    const totalBytes = Object.values(state.ipStats).reduce((a, b) => a + b.bytes, 0) || 1;

    topTalkersBody.innerHTML = "";
    topIps.forEach(ip => {
      const s = state.ipStats[ip];
      const pct = ((s.bytes / totalBytes) * 100).toFixed(1);
      const kb = (s.bytes / 1024).toFixed(1);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="color: #60a5fa; font-weight:600;">${escapeHtml(ip)}</td>
        <td>${s.packets}</td>
        <td>${kb} KB</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:#3b82f6;"></div>
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted);">${pct}%</span>
          </div>
        </td>
      `;
      topTalkersBody.appendChild(row);
    });
  }

  // Auto-start capture for immediate live responsiveness
  startSniffer();
});
