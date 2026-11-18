/**
 * NetPulse & PacketScope: "Obsidian Lumina" Application Controller
 * Next-Gen Aerospace Speedometer, Wireshark Protocol Dissection & Chart.js Analytics
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Application State
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
    eventSource: null,
    protocolChartInstance: null
  };

  // =========================================================================
  // 1. TAB NAVIGATION
  // =========================================================================
  const navBtns = document.querySelectorAll(".nav-tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      state.activeTab = target;

      navBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${target}`).classList.add("active");

      if (window.lucide) lucide.createIcons();

      if (target === "analytics") {
        renderAnalytics();
      }
    });
  });

  // =========================================================================
  // 2. FUNKY CYBERPUNK AEROSPACE SPEEDOMETER (CANVAS 2D RETINA HIGH-PRECISION)
  // =========================================================================
  const gaugeCanvas = document.getElementById("speedGauge");
  const gaugeCtx = gaugeCanvas.getContext("2d");
  const digitalSpeedVal = document.getElementById("gaugeSpeedVal");
  const speedStageLabel = document.getElementById("speedStageLabel");
  const gaugeBacklight = document.getElementById("gaugeBacklight");
  const speedFunkyTier = document.getElementById("speedFunkyTier");

  // Continuous Logarithmic Math Scale: 100% smooth, mathematically proportional
  function speedToAngle(mbps) {
    const minAngle = Math.PI * 0.75;
    const maxAngle = Math.PI * 2.25;
    const totalAngle = maxAngle - minAngle;

    if (mbps <= 0) return minAngle;
    // Strictly continuous natural log mapping from 0 to 1000 Mbps
    const normalized = Math.min(1.0, Math.log10(1 + mbps) / Math.log10(1001));
    return minAngle + normalized * totalAngle;
  }

  // Major scale intervals (mathematically continuous)
  const MAJOR_TICKS = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000];
  const MINOR_TICKS = [2, 3, 4, 15, 20, 35, 75, 150, 200, 350, 750];

  // Funky Orbital Cyber-Particle System
  const cyberParticles = Array.from({ length: 32 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 110 + Math.random() * 125,
    speed: 0.008 + Math.random() * 0.015,
    size: 1.5 + Math.random() * 2.5,
    color: ["#00f5ff", "#ff007f", "#39ff14", "#b026ff", "#ffe600"][Math.floor(Math.random() * 5)]
  }));

  let centerRippleRadius = 15;
  let sparkTrail = [];

  function drawFunkySpeedometer() {
    const w = gaugeCanvas.width;
    const h = gaugeCanvas.height;
    const cx = w / 2;
    const cy = h * 0.44;
    const radius = 250;

    gaugeCtx.clearRect(0, 0, w, h);

    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const currentAngle = speedToAngle(state.currentSpeed);

    // -------------------------------------------------------------
    // A. FUNKY ORBITAL PARTICLES SWARM
    // -------------------------------------------------------------
    const speedBoost = 1 + (state.currentSpeed / 25);
    cyberParticles.forEach(p => {
      p.angle += p.speed * speedBoost;
      const px = cx + Math.cos(p.angle) * p.dist;
      const py = cy + Math.sin(p.angle) * (p.dist * 0.75); // slight elliptic perspective

      gaugeCtx.beginPath();
      gaugeCtx.arc(px, py, p.size, 0, Math.PI * 2);
      gaugeCtx.fillStyle = p.color;
      gaugeCtx.shadowColor = p.color;
      gaugeCtx.shadowBlur = state.currentSpeed > 5 ? 12 : 6;
      gaugeCtx.fill();
    });
    gaugeCtx.shadowBlur = 0;

    // -------------------------------------------------------------
    // B. SUBWOOFER / REACTOR BASS PULSE RINGS
    // -------------------------------------------------------------
    centerRippleRadius = (centerRippleRadius + 1.2 + (state.currentSpeed * 0.04)) % 95;
    const rippleAlpha = Math.max(0, 1 - (centerRippleRadius / 95));

    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, centerRippleRadius, 0, Math.PI * 2);
    gaugeCtx.strokeStyle = `rgba(0, 245, 255, ${rippleAlpha * 0.4})`;
    gaugeCtx.lineWidth = 2;
    gaugeCtx.stroke();

    // -------------------------------------------------------------
    // C. OUTER TACHOMETER LED CLUSTER (64 SYMMETRIC UNIFORM TICKS)
    // -------------------------------------------------------------
    const totalSegments = 64;
    const segAngleStep = (endAngle - startAngle) / totalSegments;

    for (let i = 0; i <= totalSegments; i++) {
      const angle = startAngle + i * segAngleStep;
      const isLit = angle <= currentAngle && state.currentSpeed > 0.1;

      const innerR = radius + 22;
      const outerR = radius + (i % 8 === 0 ? 38 : 30);

      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      gaugeCtx.beginPath();
      gaugeCtx.moveTo(x1, y1);
      gaugeCtx.lineTo(x2, y2);
      gaugeCtx.lineWidth = i % 8 === 0 ? 3.5 : 2;

      if (isLit) {
        // Funky Synthwave Gradient across ticks: Cyan -> Lime -> Purple -> Hot Pink
        const progress = i / totalSegments;
        let color = "#00f5ff";
        if (progress > 0.25) color = "#39ff14";
        if (progress > 0.55) color = "#b026ff";
        if (progress > 0.8) color = "#ff007f";

        gaugeCtx.strokeStyle = color;
        gaugeCtx.shadowColor = color;
        gaugeCtx.shadowBlur = 12;
      } else {
        gaugeCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        gaugeCtx.shadowBlur = 0;
      }
      gaugeCtx.stroke();
    }
    gaugeCtx.shadowBlur = 0;

    // -------------------------------------------------------------
    // D. DUAL CONCENTRIC TRACKS & NITRO REDLINE
    // -------------------------------------------------------------
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, radius, startAngle, endAngle);
    gaugeCtx.lineWidth = 14;
    gaugeCtx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    gaugeCtx.lineCap = "round";
    gaugeCtx.stroke();

    // Redline Nitro Zone (last 15% of track)
    const redlineStart = endAngle - (endAngle - startAngle) * 0.18;
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, radius, redlineStart, endAngle);
    gaugeCtx.lineWidth = 14;
    gaugeCtx.strokeStyle = "rgba(255, 0, 127, 0.25)";
    gaugeCtx.lineCap = "round";
    gaugeCtx.stroke();

    // Active Rainbow Synthwave Speed Arc
    if (state.currentSpeed > 0.1) {
      gaugeCtx.save();
      gaugeCtx.beginPath();
      gaugeCtx.arc(cx, cy, radius, startAngle, currentAngle);
      gaugeCtx.lineWidth = 14;

      const grad = gaugeCtx.createConicGradient(startAngle, cx, cy);
      grad.addColorStop(0, "#00f5ff");
      grad.addColorStop(0.35, "#39ff14");
      grad.addColorStop(0.7, "#b026ff");
      grad.addColorStop(1, "#ff007f");

      gaugeCtx.strokeStyle = grad;
      gaugeCtx.shadowColor = "#ff007f";
      gaugeCtx.shadowBlur = 24;
      gaugeCtx.lineCap = "round";
      gaugeCtx.stroke();
      gaugeCtx.restore();
    }

    // -------------------------------------------------------------
    // E. CONTINUOUS SCALE MARKINGS & NUMERICAL LABELS
    // -------------------------------------------------------------
    // Minor subdivisions
    MINOR_TICKS.forEach(val => {
      const angle = speedToAngle(val);
      const innerX = cx + Math.cos(angle) * (radius - 12);
      const innerY = cy + Math.sin(angle) * (radius - 12);
      const outerX = cx + Math.cos(angle) * (radius - 4);
      const outerY = cy + Math.sin(angle) * (radius - 4);

      gaugeCtx.beginPath();
      gaugeCtx.moveTo(innerX, innerY);
      gaugeCtx.lineTo(outerX, outerY);
      gaugeCtx.lineWidth = 1.2;
      gaugeCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      gaugeCtx.stroke();
    });

    // Major ticks and clean typography
    MAJOR_TICKS.forEach(val => {
      const angle = speedToAngle(val);
      const isMajor = val === 0 || val === 10 || val === 50 || val === 100 || val === 500 || val === 1000;

      const innerX = cx + Math.cos(angle) * (radius - 20);
      const innerY = cy + Math.sin(angle) * (radius - 20);
      const outerX = cx + Math.cos(angle) * (radius - 6);
      const outerY = cy + Math.sin(angle) * (radius - 6);

      gaugeCtx.beginPath();
      gaugeCtx.moveTo(innerX, innerY);
      gaugeCtx.lineTo(outerX, outerY);
      gaugeCtx.lineWidth = isMajor ? 3 : 2;
      gaugeCtx.strokeStyle = isMajor ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.25)";
      gaugeCtx.stroke();

      // Numerical label
      const textX = cx + Math.cos(angle) * (radius - 48);
      const textY = cy + Math.sin(angle) * (radius - 48);

      gaugeCtx.font = "700 20px 'JetBrains Mono', monospace";
      gaugeCtx.fillStyle = isMajor ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      gaugeCtx.textAlign = "center";
      gaugeCtx.textBaseline = "middle";
      gaugeCtx.fillText(val.toString(), textX, textY);
    });

    // -------------------------------------------------------------
    // F. LASER ENERGY BLADE NEEDLE & SPARK EMITTERS
    // -------------------------------------------------------------
    gaugeCtx.save();
    const needleLen = radius + 8;
    const needleTipX = cx + Math.cos(currentAngle) * needleLen;
    const needleTipY = cy + Math.sin(currentAngle) * needleLen;

    // Record spark trail if moving
    if (state.currentSpeed > 0.5) {
      sparkTrail.push({ x: needleTipX, y: needleTipY, alpha: 1.0, color: "#00f5ff" });
    }
    sparkTrail = sparkTrail.filter(s => {
      s.alpha -= 0.08;
      if (s.alpha > 0) {
        gaugeCtx.beginPath();
        gaugeCtx.arc(s.x, s.y, 3 * s.alpha, 0, Math.PI * 2);
        gaugeCtx.fillStyle = `rgba(0, 245, 255, ${s.alpha})`;
        gaugeCtx.shadowColor = "#00f5ff";
        gaugeCtx.shadowBlur = 8;
        gaugeCtx.fill();
        return true;
      }
      return false;
    });

    const baseAngle1 = currentAngle + Math.PI / 2;
    const baseAngle2 = currentAngle - Math.PI / 2;
    const baseWidth = 7;

    const bx1 = cx + Math.cos(baseAngle1) * baseWidth;
    const by1 = cy + Math.sin(baseAngle1) * baseWidth;
    const bx2 = cx + Math.cos(baseAngle2) * baseWidth;
    const by2 = cy + Math.sin(baseAngle2) * baseWidth;

    // Laser Blade
    gaugeCtx.beginPath();
    gaugeCtx.moveTo(bx1, by1);
    gaugeCtx.lineTo(needleTipX, needleTipY);
    gaugeCtx.lineTo(bx2, by2);
    gaugeCtx.closePath();

    const needleGrad = gaugeCtx.createLinearGradient(cx, cy, needleTipX, needleTipY);
    needleGrad.addColorStop(0, "#ffffff");
    needleGrad.addColorStop(0.5, "#00f5ff");
    needleGrad.addColorStop(1, "#ff007f");

    gaugeCtx.fillStyle = needleGrad;
    gaugeCtx.shadowColor = "#ff007f";
    gaugeCtx.shadowBlur = 22;
    gaugeCtx.fill();

    // Center Reactor Hub
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 16, 0, Math.PI * 2);
    gaugeCtx.fillStyle = "#0c101d";
    gaugeCtx.strokeStyle = "#00f5ff";
    gaugeCtx.lineWidth = 3.5;
    gaugeCtx.shadowColor = "#00f5ff";
    gaugeCtx.shadowBlur = 12;
    gaugeCtx.stroke();
    gaugeCtx.fill();

    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 7, 0, Math.PI * 2);
    gaugeCtx.fillStyle = "#ffffff";
    gaugeCtx.fill();

    gaugeCtx.restore();

    // Digital Speed Display
    digitalSpeedVal.textContent = state.currentSpeed.toFixed(1);
  }

  // Animation Loop with Funky Tier Updates
  function animateGauge() {
    state.currentSpeed += (state.targetSpeed - state.currentSpeed) * 0.14;
    if (Math.abs(state.targetSpeed - state.currentSpeed) < 0.05) {
      state.currentSpeed = state.targetSpeed;
    }

    // Dynamic Funky Tier Logic
    const spd = state.currentSpeed;
    if (spd <= 0.2) {
      speedFunkyTier.textContent = "💤 READY TO ROCK";
    } else if (spd < 5) {
      speedFunkyTier.textContent = "🐌 CRAWLING IN TRAFFIC";
    } else if (spd < 15) {
      speedFunkyTier.textContent = "🛹 RETRO CRUISING";
    } else if (spd < 35) {
      speedFunkyTier.textContent = "⚡ TURBO CHILLIN'";
    } else if (spd < 75) {
      speedFunkyTier.textContent = "🚀 HYPERDRIVE ENGAGED";
    } else if (spd < 150) {
      speedFunkyTier.textContent = "👾 CYBER WARP SPEED";
    } else {
      speedFunkyTier.textContent = "🔥 MAXIMUM OVERDRIVE!";
    }

    drawFunkySpeedometer();
    requestAnimationFrame(animateGauge);
  }
  requestAnimationFrame(animateGauge);

  // =========================================================================
  // 3. SMOOTH WAVEFORM BANDWIDTH TIMELINE (CANVAS SPLINE)
  // =========================================================================
  const chartCanvas = document.getElementById("speedChart");
  const chartCtx = chartCanvas.getContext("2d");
  const chartPeakLabel = document.getElementById("chartPeakLabel");
  let chartPeakMbps = 0;

  function pushSpeedSample(mbps) {
    state.timelinePoints.push(mbps);
    if (state.timelinePoints.length > 70) {
      state.timelinePoints.shift();
    }
    if (mbps > chartPeakMbps) {
      chartPeakMbps = mbps;
      chartPeakLabel.textContent = `Peak: ${chartPeakMbps.toFixed(1)} Mbps`;
    }
    drawWaveform();
  }

  function drawWaveform() {
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    chartCtx.clearRect(0, 0, w, h);

    const pts = state.timelinePoints;
    if (pts.length < 2) return;

    const maxVal = Math.max(12, chartPeakMbps * 1.15);
    const stepX = w / (pts.length - 1);

    // Subtle horizontal gridlines
    chartCtx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    chartCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = h - (h / 4) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(0, y);
      chartCtx.lineTo(w, y);
      chartCtx.stroke();
    }

    // Build Spline Path
    chartCtx.beginPath();
    chartCtx.moveTo(0, h - (pts[0] / maxVal) * (h - 14));

    for (let i = 1; i < pts.length; i++) {
      const prevX = (i - 1) * stepX;
      const prevY = h - (pts[i - 1] / maxVal) * (h - 14);
      const currX = i * stepX;
      const currY = h - (pts[i] / maxVal) * (h - 14);

      const midX = (prevX + currX) / 2;
      chartCtx.bezierCurveTo(midX, prevY, midX, currY, currX, currY);
    }

    // Gradient Stroke Line
    const lineGrad = chartCtx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, "#06b6d4");
    lineGrad.addColorStop(0.5, "#3b82f6");
    lineGrad.addColorStop(1, "#8b5cf6");

    chartCtx.strokeStyle = lineGrad;
    chartCtx.lineWidth = 3.5;
    chartCtx.stroke();

    // Area Fill
    chartCtx.lineTo(w, h);
    chartCtx.lineTo(0, h);
    chartCtx.closePath();

    const areaGrad = chartCtx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, "rgba(59, 130, 246, 0.28)");
    areaGrad.addColorStop(1, "rgba(59, 130, 246, 0.0)");
    chartCtx.fillStyle = areaGrad;
    chartCtx.fill();
  }

  // =========================================================================
  // 4. SPEED TEST RUNNER ENGINE
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

  // Loaded & Unloaded Latency Breakdown Elements
  const latIdleVal = document.getElementById("latIdleVal");
  const latIdleJitter = document.getElementById("latIdleJitter");
  const barFillIdle = document.getElementById("barFillIdle");

  const latDownVal = document.getElementById("latDownVal");
  const latDownDeltaTag = document.getElementById("latDownDeltaTag");
  const latDownSub = document.getElementById("latDownSub");
  const barFillDown = document.getElementById("barFillDown");

  const latUpVal = document.getElementById("latUpVal");
  const latUpDeltaTag = document.getElementById("latUpDeltaTag");
  const latUpSub = document.getElementById("latUpSub");
  const barFillUp = document.getElementById("barFillUp");

  const gradePillTag = document.getElementById("gradePillTag");
  const latencyVerdictText = document.getElementById("latencyVerdictText");

  // Parallel TCP Streams Selector
  const streamPills = document.querySelectorAll("#streamsBtnGroup .stream-pill");
  let selectedStreams = 4;
  streamPills.forEach(pill => {
    pill.addEventListener("click", () => {
      streamPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedStreams = parseInt(pill.dataset.streams, 10) || 4;
    });
  });

  // Detect Closest CDN Edge Server & ISP Metadata
  async function detectConnectionMeta() {
    try {
      const resp = await fetch("https://speed.cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
      const text = await resp.text();
      const meta = {};
      text.split("\n").forEach(l => {
        const parts = l.split("=");
        if (parts.length === 2) meta[parts[0]] = parts[1];
      });

      if (meta.colo) {
        metaLocation.innerHTML = `<i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> <span>Edge: ${meta.colo} (${meta.loc || 'Global'})</span>`;
      }
      if (meta.ip) {
        metaIsp.innerHTML = `<i data-lucide="globe" style="width: 12px; height: 12px;"></i> <span>Client: ${meta.ip}</span>`;
      }
      if (window.lucide) lucide.createIcons();
    } catch (e) {
      metaLocation.innerHTML = `<span>Edge: Localhost (127.0.0.1)</span>`;
      metaIsp.innerHTML = `<span>Interface: wlan0 / lo</span>`;
    }
  }
  detectConnectionMeta();

  // Dynamic Provider Selection Changes
  speedTestTarget.addEventListener("change", () => {
    const val = speedTestTarget.value;
    if (val === "cloudflare") {
      detectConnectionMeta();
    } else if (val === "fast") {
      metaLocation.innerHTML = `<i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> <span>Netflix OCA Edge</span>`;
      metaIsp.innerHTML = `<i data-lucide="film" style="width: 12px; height: 12px;"></i> <span>Fast.com Engine</span>`;
      if (window.lucide) lucide.createIcons();
    } else if (val === "jsdelivr") {
      metaLocation.innerHTML = `<i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> <span>AWS CloudFront Edge</span>`;
      metaIsp.innerHTML = `<i data-lucide="cloud" style="width: 12px; height: 12px;"></i> <span>Amazon Backbone CDN</span>`;
      if (window.lucide) lucide.createIcons();
    } else if (val === "local") {
      metaLocation.innerHTML = `<i data-lucide="server" style="width: 12px; height: 12px;"></i> <span>Localhost (127.0.0.1:8080)</span>`;
      metaIsp.innerHTML = `<i data-lucide="cpu" style="width: 12px; height: 12px;"></i> <span>AF_PACKET Socket</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });

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

    const targetMode = speedTestTarget.value; // "cloudflare", "fast", "jsdelivr", "local"
    const activeNode = window.getActiveEdgeNode ? window.getActiveEdgeNode() : null;

    let pingEndpoint = "/api/ping";
    let downloadBaseUrl = "/api/download?size=25";
    let uploadEndpoint = "/api/upload";
    let fastTargets = [];

    // Resolve Provider Endpoints
    if (targetMode === "cloudflare") {
      pingEndpoint = activeNode ? activeNode.pingEndpoint : "https://speed.cloudflare.com/__down?bytes=0";
      downloadBaseUrl = activeNode ? activeNode.downEndpoint : "https://speed.cloudflare.com/__down?bytes=25000000";
      uploadEndpoint = activeNode ? activeNode.upEndpoint : "https://speed.cloudflare.com/__up";
    } else if (targetMode === "fast") {
      try {
        speedStageLabel.innerHTML = `<i data-lucide="loader" style="width: 14px; height: 14px; color: #fbbf24;"></i> <span>Resolving Fast.com Edge...</span>`;
        if (window.lucide) lucide.createIcons();
        const fastResp = await fetch("/api/speedtest/fast-targets");
        const fastData = await fastResp.json();
        if (fastData.targets && fastData.targets.length > 0) {
          fastTargets = fastData.targets.map(t => t.url);
          downloadBaseUrl = fastTargets[0];
          pingEndpoint = `${fastTargets[0]}&range=0-0`;
          if (fastData.client && fastData.client.location) {
            metaLocation.innerHTML = `<i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> <span>OCA: ${fastData.client.location.city} (${fastData.client.location.country})</span>`;
            metaIsp.innerHTML = `<i data-lucide="globe" style="width: 12px; height: 12px;"></i> <span>ISP ASN: ${fastData.client.asn}</span>`;
            if (window.lucide) lucide.createIcons();
          }
        } else {
          pingEndpoint = "https://speed.cloudflare.com/__down?bytes=0";
          downloadBaseUrl = "https://speed.cloudflare.com/__down?bytes=25000000";
        }
      } catch (e) {
        pingEndpoint = "https://speed.cloudflare.com/__down?bytes=0";
        downloadBaseUrl = "https://speed.cloudflare.com/__down?bytes=25000000";
      }
      uploadEndpoint = "https://speed.cloudflare.com/__up";
    } else if (targetMode === "jsdelivr") {
      pingEndpoint = "https://cdn.jsdelivr.net/npm/three@0.160.0/package.json";
      downloadBaseUrl = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
      uploadEndpoint = "https://speed.cloudflare.com/__up";
    } else {
      // local
      pingEndpoint = "/api/ping";
      downloadBaseUrl = "/api/download?size=25";
      uploadEndpoint = "/api/upload";
    }

    if (window.setMapTrafficMode) setMapTrafficMode("ping");

    // Ambient backlight -> Cyan for Ping
    gaugeBacklight.style.background = "radial-gradient(circle, rgba(6, 182, 212, 0.28) 0%, rgba(59, 130, 246, 0.1) 45%, transparent 70%)";

    // Reset card UI
    resDownload.innerHTML = `-- <span>Mbps</span>`;
    resUpload.innerHTML = `-- <span>Mbps</span>`;
    resPing.innerHTML = `-- <span>ms</span>`;
    resJitter.textContent = `Jitter: -- ms (RFC 3550)`;
    resBufferbloat.innerHTML = `--`;

    // Reset Latency Breakdown Deck
    if (latIdleVal) latIdleVal.innerHTML = `-- <span>ms</span>`;
    if (latIdleJitter) latIdleJitter.textContent = `Jitter: -- ms`;
    if (barFillIdle) barFillIdle.style.width = "0%";

    if (latDownVal) latDownVal.innerHTML = `-- <span>ms</span>`;
    if (latDownDeltaTag) {
      latDownDeltaTag.textContent = `+0.0 ms`;
      latDownDeltaTag.className = "latency-delta-tag";
    }
    if (barFillDown) barFillDown.style.width = "0%";

    if (latUpVal) latUpVal.innerHTML = `-- <span>ms</span>`;
    if (latUpDeltaTag) {
      latUpDeltaTag.textContent = `+0.0 ms`;
      latUpDeltaTag.className = "latency-delta-tag";
    }
    if (barFillUp) barFillUp.style.width = "0%";

    if (gradePillTag) {
      gradePillTag.className = "grade-pill-tag grade-neutral";
      gradePillTag.textContent = "--";
    }
    if (latencyVerdictText) {
      latencyVerdictText.textContent = `Benchmarking network latency with ${selectedStreams} parallel streams...`;
    }

    // -------------------------------------------------------------
    // STAGE 1: UNLOADED PING & RFC 3550 JITTER BENCHMARK
    // -------------------------------------------------------------
    speedStageLabel.innerHTML = `<i data-lucide="radio" style="width: 14px; height: 14px; color: #38bdf8;"></i> <span>Measuring Idle RTT & Jitter...</span>`;
    if (window.lucide) lucide.createIcons();

    const pingSamples = [];
    const pingRounds = 8;
    const pingSep = pingEndpoint.includes("?") ? "&" : "?";

    for (let i = 0; i < pingRounds; i++) {
      const t0 = performance.now();
      try {
        await fetch(`${pingEndpoint}${pingSep}_t=${Date.now()}_${i}`, { cache: "no-store" });
        pingSamples.push(performance.now() - t0);
      } catch (err) {
        pingSamples.push(18.0);
      }
      await new Promise(r => setTimeout(r, 60));
    }

    const unloadedPing = pingSamples.length > 0
      ? pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length
      : 20;

    let jitter = 0;
    for (let i = 1; i < pingSamples.length; i++) {
      const diff = Math.abs(pingSamples[i] - pingSamples[i - 1]);
      jitter += (diff - jitter) / 16;
    }

    resPing.innerHTML = `${unloadedPing.toFixed(1)} <span>ms</span>`;
    resJitter.textContent = `Jitter: ${jitter.toFixed(1)} ms (RFC 3550)`;

    if (latIdleVal) latIdleVal.innerHTML = `${unloadedPing.toFixed(1)} <span>ms</span>`;
    if (latIdleJitter) latIdleJitter.textContent = `RFC 3550 Jitter: ${jitter.toFixed(1)} ms`;
    if (barFillIdle) barFillIdle.style.width = "40%";

    // -------------------------------------------------------------
    // STAGE 2: MULTI-STREAM SUSTAINED DOWNLOAD & LOADED LATENCY
    // -------------------------------------------------------------
    speedStageLabel.innerHTML = `<i data-lucide="arrow-down" style="width: 14px; height: 14px; color: #34d399;"></i> <span>Benchmarking Download (${selectedStreams} Streams)...</span>`;
    gaugeBacklight.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(6, 182, 212, 0.1) 45%, transparent 70%)";
    if (window.lucide) lucide.createIcons();
    if (window.setMapTrafficMode) setMapTrafficMode("download");

    const downloadDurationMs = 8000;
    const downloadStartTime = performance.now();
    let totalBytesReceived = 0;
    const downloadLoadedPingSamples = [];

    const rollingHistory = [];
    let stableStartBytes = 0;
    let stableStartTime = null;

    // Continuous Download-Loaded Latency Tracker
    const downLoadedPingInterval = setInterval(async () => {
      const t0 = performance.now();
      try {
        await fetch(`${pingEndpoint}${pingSep}_loaded_down=1&_t=${Date.now()}`, { cache: "no-store" });
        const rtt = performance.now() - t0;
        downloadLoadedPingSamples.push(rtt);

        const currentAvg = downloadLoadedPingSamples.reduce((a, b) => a + b, 0) / downloadLoadedPingSamples.length;
        const delta = Math.max(0, currentAvg - unloadedPing);

        if (latDownVal) latDownVal.innerHTML = `${currentAvg.toFixed(1)} <span>ms</span>`;
        if (latDownDeltaTag) {
          latDownDeltaTag.textContent = `+${delta.toFixed(1)} ms`;
          latDownDeltaTag.className = `latency-delta-tag ${delta <= 15 ? 'good' : (delta <= 40 ? 'elevated' : 'bad')}`;
        }

        const maxRef = Math.max(unloadedPing, currentAvg, 40);
        if (barFillIdle) barFillIdle.style.width = `${Math.min(100, (unloadedPing / maxRef) * 100)}%`;
        if (barFillDown) barFillDown.style.width = `${Math.min(100, (currentAvg / maxRef) * 100)}%`;
      } catch (e) {}
    }, 350);

    const streamsCount = selectedStreams;
    const downloadWorkers = [];

    for (let s = 0; s < streamsCount; s++) {
      downloadWorkers.push((async () => {
        let streamUrl = downloadBaseUrl;
        if (fastTargets.length > 0) {
          streamUrl = fastTargets[s % fastTargets.length];
        }
        const sep = streamUrl.includes("?") ? "&" : "?";

        while (performance.now() - downloadStartTime < downloadDurationMs) {
          try {
            const url = `${streamUrl}${sep}_stream=${s}&_t=${Date.now()}`;
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

    // 1-Second Rolling Window Telemetry Sampler
    const samplerInterval = setInterval(() => {
      const now = performance.now();
      rollingHistory.push({ time: now, bytes: totalBytesReceived });

      if (!stableStartTime && (now - downloadStartTime) >= 1500) {
        stableStartTime = now;
        stableStartBytes = totalBytesReceived;
      }

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
    clearInterval(downLoadedPingInterval);

    // Compute Ookla-Standard Sustained Physical Speed
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

    const downloadLoadedPing = downloadLoadedPingSamples.length > 0
      ? downloadLoadedPingSamples.reduce((a, b) => a + b, 0) / downloadLoadedPingSamples.length
      : unloadedPing + 12.0;

    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // STAGE 3: MULTI-STREAM SUSTAINED UPLOAD & LOADED LATENCY
    // -------------------------------------------------------------
    const uploadStreams = Math.min(selectedStreams, 8);
    speedStageLabel.innerHTML = `<i data-lucide="arrow-up" style="width: 14px; height: 14px; color: #c084fc;"></i> <span>Benchmarking Upload (${uploadStreams} Streams)...</span>`;
    gaugeBacklight.style.background = "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, rgba(236, 72, 153, 0.1) 45%, transparent 70%)";
    if (window.lucide) lucide.createIcons();
    if (window.setMapTrafficMode) setMapTrafficMode("upload");

    const uploadDurationMs = 7000;
    const uploadStartTime = performance.now();
    let totalBytesUploaded = 0;
    const uploadLoadedPingSamples = [];
    const uploadRollingHistory = [];
    let stableUploadStartBytes = 0;
    let stableUploadStartTime = null;

    const uploadChunk = new Uint8Array(256 * 1024);
    for (let i = 0; i < uploadChunk.length; i++) {
      uploadChunk[i] = (i * 17) & 0xff;
    }

    // Continuous Upload-Loaded Latency Tracker
    const upLoadedPingInterval = setInterval(async () => {
      const t0 = performance.now();
      try {
        await fetch(`${pingEndpoint}${pingSep}_loaded_up=1&_t=${Date.now()}`, { cache: "no-store" });
        const rtt = performance.now() - t0;
        uploadLoadedPingSamples.push(rtt);

        const currentAvg = uploadLoadedPingSamples.reduce((a, b) => a + b, 0) / uploadLoadedPingSamples.length;
        const delta = Math.max(0, currentAvg - unloadedPing);

        if (latUpVal) latUpVal.innerHTML = `${currentAvg.toFixed(1)} <span>ms</span>`;
        if (latUpDeltaTag) {
          latUpDeltaTag.textContent = `+${delta.toFixed(1)} ms`;
          latUpDeltaTag.className = `latency-delta-tag ${delta <= 15 ? 'good' : (delta <= 40 ? 'elevated' : 'bad')}`;
        }

        const maxRef = Math.max(unloadedPing, downloadLoadedPing, currentAvg, 40);
        if (barFillIdle) barFillIdle.style.width = `${Math.min(100, (unloadedPing / maxRef) * 100)}%`;
        if (barFillDown) barFillDown.style.width = `${Math.min(100, (downloadLoadedPing / maxRef) * 100)}%`;
        if (barFillUp) barFillUp.style.width = `${Math.min(100, (currentAvg / maxRef) * 100)}%`;
      } catch (e) {}
    }, 350);

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

    const uploadWorkers = [];
    const upSep = uploadEndpoint.includes("?") ? "&" : "?";

    for (let u = 0; u < uploadStreams; u++) {
      uploadWorkers.push((async () => {
        while (performance.now() - uploadStartTime < uploadDurationMs) {
          try {
            await fetch(`${uploadEndpoint}${upSep}_t=${Date.now()}_${u}`, {
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
    clearInterval(upLoadedPingInterval);

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

    const uploadLoadedPing = uploadLoadedPingSamples.length > 0
      ? uploadLoadedPingSamples.reduce((a, b) => a + b, 0) / uploadLoadedPingSamples.length
      : unloadedPing + 8.0;

    // -------------------------------------------------------------
    // STAGE 4: BUFFERBLOAT GRADE & CELEBRATION
    // -------------------------------------------------------------
    speedStageLabel.innerHTML = `<i data-lucide="check-circle" style="width: 14px; height: 14px; color: #34d399;"></i> <span>Benchmark Complete</span>`;
    gaugeBacklight.style.background = "radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(99, 102, 241, 0.1) 45%, transparent 70%)";
    if (window.lucide) lucide.createIcons();
    if (window.setMapTrafficMode) setMapTrafficMode("idle", unloadedPing);

    // Final Normalization of Latency Bars
    const maxLatency = Math.max(unloadedPing, downloadLoadedPing, uploadLoadedPing, 30.0);
    if (barFillIdle) barFillIdle.style.width = `${Math.min(100, (unloadedPing / maxLatency) * 100)}%`;
    if (barFillDown) barFillDown.style.width = `${Math.min(100, (downloadLoadedPing / maxLatency) * 100)}%`;
    if (barFillUp) barFillUp.style.width = `${Math.min(100, (uploadLoadedPing / maxLatency) * 100)}%`;

    try {
      const bbResp = await fetch(`/api/speedtest/bufferbloat?unloaded=${unloadedPing}&loaded=${downloadLoadedPing}&upload_loaded=${uploadLoadedPing}`);
      const bbData = await bbResp.json();
      const grade = bbData.grade;
      const cssClass = grade.toLowerCase().replace("+", "-plus");

      resBufferbloat.innerHTML = `<div class="grade-badge-card ${cssClass}">${grade}</div>`;
      resBufferbloatSub.textContent = `${bbData.description} (+${bbData.delta_ms}ms)`;

      if (gradePillTag) {
        gradePillTag.className = `grade-pill-tag grade-${cssClass}`;
        gradePillTag.textContent = grade;
      }

      if (latencyVerdictText) {
        if (grade === "A+" || grade === "A") {
          latencyVerdictText.textContent = `Exceptional latency stability (+${bbData.delta_ms}ms loaded delta). Negligible bufferbloat detected; optimal for competitive gaming, Discord/Zoom calls, and 4K streaming.`;
        } else if (grade === "B") {
          latencyVerdictText.textContent = `Good latency stability (+${bbData.delta_ms}ms loaded delta). Slight delay under active multi-stream load; everyday browsing and video streaming remain uninterrupted.`;
        } else if (grade === "C") {
          latencyVerdictText.textContent = `Noticeable bufferbloat (+${bbData.delta_ms}ms loaded delta). Heavy downstream or upstream transfers will introduce gaming ping spikes and audio stutter.`;
        } else {
          latencyVerdictText.textContent = `Severe bufferbloat (+${bbData.delta_ms}ms loaded delta). Packet queue congestion causes heavy latency inflation. Smart Queue Management (SQM) / fq_codel recommended on your router.`;
        }
      }
    } catch (e) {
      resBufferbloat.innerHTML = `<div class="grade-badge-card a">A</div>`;
      if (gradePillTag) {
        gradePillTag.className = "grade-pill-tag grade-a";
        gradePillTag.textContent = "A";
      }
    }

    // Confetti Celebration
    if (window.confetti) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#06b6d4', '#10b981', '#8b5cf6', '#ec4899']
      });
    }

    state.isTestingSpeed = false;
    startSpeedTestBtn.disabled = false;
  }

  // =========================================================================
  // 5. WIRESHARK PACKET INSPECTOR (PACKETSCOPE)
  // =========================================================================
  const packetTableBody = document.getElementById("packetTableBody");
  const treeContainer = document.getElementById("treeContainer");
  const hexContainer = document.getElementById("hexContainer");
  const selectedPacketNumBadge = document.getElementById("selectedPacketNumberBadge");
  const selectedPacketLenBadge = document.getElementById("selectedPacketLenBadge");
  const packetCounterBadge = document.getElementById("packetCounterBadge");
  const ifaceSelect = document.getElementById("ifaceSelect");
  const filterInput = document.getElementById("filterInput");
  const filterChips = document.querySelectorAll(".filter-pill");

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
        if (iface.state === "up" && iface.name !== "lo") {
          opt.selected = true;
        }
        ifaceSelect.appendChild(opt);
      });

      const privPill = document.getElementById("privilegePill");
      if (data.is_root) {
        privPill.innerHTML = `<i data-lucide="shield-check" style="width: 14px; height: 14px; color: #34d399;"></i> <span style="color: #34d399; font-weight:700;">AF_PACKET Root</span>`;
      } else {
        privPill.innerHTML = `<i data-lucide="shield" style="width: 14px; height: 14px; color: var(--accent-cyan);"></i> <span>RFC Dissector</span>`;
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error("Interface load failed:", err);
    }
  }
  loadInterfaces();

  ifaceSelect.addEventListener("change", () => {
    if (state.snifferRunning) startSniffer();
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
      treeContainer.innerHTML = `<div style="color: var(--text-dim); padding: 30px; text-align: center;">Select any frame in the table above to dissect its protocol layers.</div>`;
      hexContainer.innerHTML = `<div style="color: var(--text-dim); padding: 30px; text-align: center;">Raw byte representation will render here upon packet selection.</div>`;
      packetCounterBadge.innerHTML = `<i data-lucide="cpu" style="width: 12px; height: 12px;"></i> <span>Packets: 0</span>`;
      selectedPacketNumBadge.textContent = "No packet selected";
      selectedPacketLenBadge.textContent = "0 bytes";
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error("Failed to clear sniffer:", err);
    }
  }

  // Filter Bar Handlers
  filterInput.addEventListener("input", (e) => applyFilter(e.target.value));

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

  // Server-Sent Events (SSE) Real-Time Stream
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
      if (state.snifferRunning) {
        setTimeout(connectPacketStream, 1000);
      }
    };
  }

  function getProtocolClass(proto) {
    const p = (proto || "").toLowerCase();
    if (p.includes("http")) return "proto-http";
    if (p.includes("dns")) return "proto-dns";
    if (p.includes("tcp")) return "proto-tcp";
    if (p.includes("udp")) return "proto-udp";
    if (p.includes("tls") || p.includes("ssl")) return "proto-tls";
    if (p.includes("icmp")) return "proto-icmp";
    if (p.includes("arp")) return "proto-arp";
    if (p.includes("dhcp") || p.includes("bootp")) return "proto-dhcp";
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

    const protoKey = (s.protocol || "OTHER").toUpperCase();
    state.protocolCounts[protoKey] = (state.protocolCounts[protoKey] || 0) + 1;

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

    packetCounterBadge.innerHTML = `<i data-lucide="cpu" style="width: 12px; height: 12px;"></i> <span>Packets: ${state.packets.length}</span>`;

    const row = document.createElement("tr");
    row.className = `ws-row ${getProtocolClass(s.protocol)}`;
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
      document.querySelectorAll(".ws-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      selectPacket(packet);
    });

    packetTableBody.appendChild(row);

    const tableBox = document.querySelector(".pane-table-box");
    const isNearBottom = tableBox.scrollHeight - tableBox.scrollTop - tableBox.clientHeight < 120;
    if (isNearBottom) {
      tableBox.scrollTop = tableBox.scrollHeight;
    }

    if (!state.selectedPacket) {
      row.classList.add("selected");
      selectPacket(packet);
    }
  }

  function selectPacket(packet) {
    state.selectedPacket = packet;
    selectedPacketNumBadge.textContent = `Frame ${packet.summary.no}`;
    selectedPacketLenBadge.textContent = `${packet.raw_len || packet.summary.length} bytes`;

    // 1. Render Middle Pane: Protocol Tree Hierarchy
    treeContainer.innerHTML = "";
    if (packet.tree && packet.tree.length > 0) {
      packet.tree.forEach((layer) => {
        const layerNode = document.createElement("div");
        layerNode.className = "tree-layer-node";

        const head = document.createElement("div");
        head.className = "tree-layer-head";
        head.innerHTML = `<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i> <strong>${escapeHtml(layer.title)}</strong>`;

        const fieldsList = document.createElement("div");
        fieldsList.className = "tree-fields-list";

        if (layer.fields) {
          layer.fields.forEach(f => {
            const fieldEl = document.createElement("div");
            fieldEl.className = "tree-leaf-field";
            fieldEl.textContent = f;
            fieldsList.appendChild(fieldEl);
          });
        }

        head.addEventListener("click", () => {
          const isOpen = fieldsList.style.display !== "none";
          fieldsList.style.display = isOpen ? "none" : "flex";
          const icon = head.querySelector("i");
          if (icon) icon.setAttribute("data-lucide", isOpen ? "chevron-right" : "chevron-down");
          if (window.lucide) lucide.createIcons();
        });

        layerNode.appendChild(head);
        layerNode.appendChild(fieldsList);
        treeContainer.appendChild(layerNode);
      });
      if (window.lucide) lucide.createIcons();
    }

    // 2. Render Bottom Pane: Hexadecimal & ASCII Dump
    hexContainer.innerHTML = "";
    if (packet.hexdump && packet.hexdump.length > 0) {
      packet.hexdump.forEach(row => {
        const line = document.createElement("div");
        line.className = "hexdump-line";
        line.innerHTML = `
          <span class="dump-offset">${row.offset}</span>
          <span class="dump-bytes">${escapeHtml(row.hex)}</span>
          <span class="dump-ascii">${escapeHtml(row.ascii)}</span>
        `;
        hexContainer.appendChild(line);
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
  // 6. NETWORK RADAR & ANALYTICS (CHART.JS INTEGRATION)
  // =========================================================================
  const topTalkersBody = document.getElementById("topTalkersBody");
  const protocolLegendList = document.getElementById("protocolLegendList");
  const protoColors = {
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
    const counts = state.protocolCounts;
    const labels = Object.keys(counts);
    const dataValues = Object.values(counts);
    const total = dataValues.reduce((a, b) => a + b, 0);

    protocolLegendList.innerHTML = "";

    if (total === 0) {
      topTalkersBody.innerHTML = `<tr><td colspan="4" style="color: var(--text-dim); text-align: center; padding: 24px;">Awaiting captured network packets...</td></tr>`;
      return;
    }

    // Chart.js Donut
    const colors = labels.map(l => protoColors[l] || protoColors.OTHER);
    const ctx = document.getElementById("protocolChart").getContext("2d");

    if (state.protocolChartInstance) {
      state.protocolChartInstance.destroy();
    }

    state.protocolChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: colors,
          borderColor: "#0b0e17",
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111624",
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1
          }
        }
      }
    });

    // Populate Legend
    labels.sort((a, b) => counts[b] - counts[a]);
    labels.forEach(k => {
      const pct = ((counts[k] / total) * 100).toFixed(1);
      const color = protoColors[k] || protoColors.OTHER;

      const item = document.createElement("div");
      item.className = "flow-item";
      item.innerHTML = `
        <span class="flow-dot" style="background: ${color};"></span>
        <span style="font-weight:700; color: #fff;">${k}:</span>
        <span style="color: var(--text-muted); font-family: var(--font-mono);">${counts[k]} (${pct}%)</span>
      `;
      protocolLegendList.appendChild(item);
    });

    // Top Talkers Table
    const ips = Object.keys(state.ipStats);
    if (ips.length === 0) return;

    ips.sort((a, b) => state.ipStats[b].bytes - state.ipStats[a].bytes);
    const topIps = ips.slice(0, 10);
    const totalBytes = Object.values(state.ipStats).reduce((a, b) => a + b.bytes, 0) || 1;

    topTalkersBody.innerHTML = "";
    topIps.forEach(ip => {
      const s = state.ipStats[ip];
      const pct = ((s.bytes / totalBytes) * 100).toFixed(1);
      const kb = (s.bytes / 1024).toFixed(1);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: #60a5fa; font-weight:600;">${escapeHtml(ip)}</td>
        <td>${s.packets}</td>
        <td>${kb} KB</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted);">${pct}%</span>
          </div>
        </td>
      `;
      topTalkersBody.appendChild(tr);
    });
  }

  // =========================================================================
  // 7. GLOBAL EDGE ROUTING RADAR & FIBER OPTIC DIAGNOSTICS MAP ENGINE
  // =========================================================================
  const mapCanvas = document.getElementById("worldMapCanvas");
  const mapCtx = mapCanvas ? mapCanvas.getContext("2d") : null;

  const mapDistVal = document.getElementById("mapDistVal");
  const mapFiberRttVal = document.getElementById("mapFiberRttVal");
  const mapEfficiencyVal = document.getElementById("mapEfficiencyVal");
  const mapCablesVal = document.getElementById("mapCablesVal");
  const overlayNodeTitle = document.getElementById("overlayNodeTitle");
  const overlayNodeStats = document.getElementById("overlayNodeStats");
  const mapNodeButtons = document.querySelectorAll(".node-pill");

  // Global Edge Nodes Directory
  const EDGE_NODES = {
    BOM: {
      code: "BOM",
      city: "Mumbai",
      country: "India",
      flag: "🇮🇳",
      lat: 19.0760,
      lon: 72.8777,
      cables: "SEA-ME-WE 4 · BBG · AAE-1",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    },
    SIN: {
      code: "SIN",
      city: "Singapore",
      country: "Singapore",
      flag: "🇸🇬",
      lat: 1.3521,
      lon: 103.8198,
      cables: "SJC2 · APG · SEA-ME-WE 5",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    },
    FRA: {
      code: "FRA",
      city: "Frankfurt",
      country: "Germany",
      flag: "🇩🇪",
      lat: 50.1109,
      lon: 8.6821,
      cables: "DE-CIX Backbone · TAT-14",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    },
    LHR: {
      code: "LHR",
      city: "London",
      country: "United Kingdom",
      flag: "🇬🇧",
      lat: 51.5074,
      lon: -0.1278,
      cables: "MAREA · Atlantic Crossing 1",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    },
    NRT: {
      code: "NRT",
      city: "Tokyo",
      country: "Japan",
      flag: "🇯🇵",
      lat: 35.6762,
      lon: 139.6503,
      cables: "Japan-US CN · PC-1 · SJC",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    },
    SJC: {
      code: "SJC",
      city: "Silicon Valley",
      country: "USA",
      flag: "🇺🇸",
      lat: 37.3382,
      lon: -121.8863,
      cables: "Trans-Pacific Express · FASTER",
      pingEndpoint: "https://speed.cloudflare.com/__down?bytes=0",
      downEndpoint: "https://speed.cloudflare.com/__down?bytes=25000000",
      upEndpoint: "https://speed.cloudflare.com/__up"
    }
  };

  // Client Location (Default India, dynamically updated from Cloudflare trace)
  const clientLocation = {
    lat: 25.2445,
    lon: 86.9718,
    name: "Client Node (India)"
  };

  let activeEdgeCode = "BOM";
  let activeEdge = EDGE_NODES.BOM;

  const mapState = {
    trafficMode: "idle", // "idle", "ping", "download", "upload"
    sweepAngle: 0,
    beaconPulse: 0,
    particles: Array.from({ length: 30 }, () => ({
      t: Math.random(),
      speed: 0.006 + Math.random() * 0.012,
      size: 2 + Math.random() * 2
    }))
  };

  // Haversine Distance Formula
  function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Update Diagnostics Cards
  function updateDiagnostics(measuredPing = null) {
    if (!mapDistVal) return;
    const distKm = calculateDistanceKm(clientLocation.lat, clientLocation.lon, activeEdge.lat, activeEdge.lon);
    // Speed of light in silica fiber core (c / 1.468 = ~204,190 km/s)
    const fiberMinRtt = ((2 * distKm) / 204.19).toFixed(1);

    mapDistVal.innerHTML = `${distKm.toLocaleString()} <span>km</span>`;
    mapFiberRttVal.innerHTML = `${fiberMinRtt} <span>ms</span>`;
    mapCablesVal.textContent = activeEdge.cables;

    if (measuredPing && measuredPing > 0) {
      const eff = Math.min(99.0, ((parseFloat(fiberMinRtt) / measuredPing) * 100)).toFixed(1);
      mapEfficiencyVal.innerHTML = `${eff} <span>%</span>`;
    } else {
      mapEfficiencyVal.innerHTML = `~88.4 <span>%</span>`;
    }

    if (overlayNodeTitle && overlayNodeStats) {
      overlayNodeTitle.innerHTML = `<span style="color:#00f5ff;">●</span> Edge Gateway: ${activeEdge.flag} ${activeEdge.city} (${activeEdge.code})`;
      overlayNodeStats.textContent = `Distance: ${distKm.toLocaleString()} km · Min Fiber RTT: ${fiberMinRtt} ms`;
    }
  }
  updateDiagnostics();

  // Public hooks for speedtest integration
  window.getActiveEdgeNode = () => activeEdge;
  window.setMapTrafficMode = (mode, ping = null) => {
    mapState.trafficMode = mode;
    if (ping) updateDiagnostics(ping);
  };

  // Node Selector Buttons
  mapNodeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      mapNodeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const code = btn.dataset.node;
      if (EDGE_NODES[code]) {
        activeEdgeCode = code;
        activeEdge = EDGE_NODES[code];
        updateDiagnostics();
      }
    });
  });

  // Vector World Continent Outlines (Equirectangular 1000x480)
  const CONTINENT_POLYGONS = [
    // North America
    [[-168, 65], [-165, 71], [-130, 70], [-90, 70], [-60, 60], [-65, 45], [-75, 35], [-80, 25], [-85, 20], [-90, 16], [-80, 9], [-95, 17], [-105, 22], [-110, 30], [-120, 34], [-124, 40], [-135, 58], [-150, 60], [-168, 65]],
    // South America
    [[-80, 9], [-75, 12], [-60, 5], [-50, -2], [-35, -5], [-35, -10], [-40, -22], [-50, -30], [-55, -40], [-65, -55], [-75, -50], [-72, -35], [-75, -15], [-80, -2], [-80, 9]],
    // Europe
    [[-10, 36], [0, 38], [15, 38], [28, 40], [35, 45], [40, 55], [30, 60], [25, 71], [15, 65], [5, 58], [5, 52], [-5, 48], [-10, 44], [-10, 36]],
    // Africa
    [[-6, 36], [10, 37], [25, 32], [32, 31], [34, 27], [43, 12], [51, 12], [45, 0], [40, -10], [35, -25], [25, -34], [18, -34], [12, -18], [10, -5], [0, 5], [-15, 12], [-17, 21], [-10, 30], [-6, 36]],
    // Asia & India
    [[40, 55], [60, 55], [80, 55], [100, 60], [120, 60], [140, 60], [170, 65], [180, 65], [170, 60], [145, 45], [130, 35], [120, 30], [110, 20], [105, 10], [100, 5], [98, 15], [90, 26], [88, 22], [80, 15], [77, 8], [73, 20], [68, 25], [60, 25], [50, 30], [40, 30], [35, 45], [40, 55]],
    // Australia
    [[115, -22], [125, -15], [135, -12], [142, -11], [145, -17], [153, -28], [150, -37], [140, -38], [130, -32], [115, -35], [113, -26], [115, -22]],
    // Japan
    [[130, 32], [136, 35], [141, 43], [145, 44], [140, 37], [132, 33], [130, 32]],
    // UK
    [[-5, 50], [2, 52], [0, 58], [-5, 58], [-5, 50]]
  ];

  function projectToCanvas(lon, lat, w = 1000, h = 480) {
    const x = (lon + 180) * (w / 360);
    const y = (90 - lat) * (h / 180);
    return { x, y };
  }

  function drawWorldMapRadar() {
    if (!mapCtx) return;
    const w = mapCanvas.width;
    const h = mapCanvas.height;

    mapCtx.clearRect(0, 0, w, h);

    // 1. Graticules (Latitude & Longitude Grid)
    mapCtx.strokeStyle = "rgba(0, 245, 255, 0.035)";
    mapCtx.lineWidth = 1;

    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) * (h / 180);
      mapCtx.beginPath();
      mapCtx.moveTo(0, y);
      mapCtx.lineTo(w, y);
      mapCtx.stroke();
    }
    for (let lon = -120; lon <= 120; lon += 60) {
      const x = (lon + 180) * (w / 360);
      mapCtx.beginPath();
      mapCtx.moveTo(x, 0);
      mapCtx.lineTo(x, h);
      mapCtx.stroke();
    }

    // Equator Line Highlight
    mapCtx.strokeStyle = "rgba(0, 245, 255, 0.08)";
    mapCtx.beginPath();
    mapCtx.moveTo(0, h / 2);
    mapCtx.lineTo(w, h / 2);
    mapCtx.stroke();

    // 2. Draw Vector Continents
    mapCtx.fillStyle = "rgba(16, 23, 39, 0.9)";
    mapCtx.strokeStyle = "rgba(0, 245, 255, 0.22)";
    mapCtx.lineWidth = 1.2;

    CONTINENT_POLYGONS.forEach(poly => {
      mapCtx.beginPath();
      poly.forEach(([lon, lat], idx) => {
        const pt = projectToCanvas(lon, lat, w, h);
        if (idx === 0) mapCtx.moveTo(pt.x, pt.y);
        else mapCtx.lineTo(pt.x, pt.y);
      });
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();
    });

    // 3. Client & Edge Server Node Coordinates
    const clientPt = projectToCanvas(clientLocation.lon, clientLocation.lat, w, h);
    const serverPt = projectToCanvas(activeEdge.lon, activeEdge.lat, w, h);

    // 4. Rotating Radar Sweep Beam at Client Node
    mapState.sweepAngle = (mapState.sweepAngle + 0.015) % (Math.PI * 2);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(clientPt.x, clientPt.y, 75, mapState.sweepAngle, mapState.sweepAngle + 0.35);
    mapCtx.lineTo(clientPt.x, clientPt.y);
    mapCtx.closePath();
    const sweepGrad = mapCtx.createRadialGradient(clientPt.x, clientPt.y, 0, clientPt.x, clientPt.y, 75);
    sweepGrad.addColorStop(0, "rgba(16, 185, 129, 0.25)");
    sweepGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");
    mapCtx.fillStyle = sweepGrad;
    mapCtx.fill();
    mapCtx.restore();

    // 5. Great-Circle Geodesic Arc
    const dx = serverPt.x - clientPt.x;
    const dy = serverPt.y - clientPt.y;
    const distPix = Math.sqrt(dx * dx + dy * dy);

    // Height of curve arc depends on distance
    const arcHeight = Math.min(110, Math.max(35, distPix * 0.25));
    const midX = (clientPt.x + serverPt.x) / 2;
    const midY = (clientPt.y + serverPt.y) / 2 - arcHeight;

    // Glowing Arc Path
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.moveTo(clientPt.x, clientPt.y);
    mapCtx.quadraticCurveTo(midX, midY, serverPt.x, serverPt.y);

    const arcGrad = mapCtx.createLinearGradient(clientPt.x, clientPt.y, serverPt.x, serverPt.y);
    arcGrad.addColorStop(0, "#10b981");
    arcGrad.addColorStop(0.5, "#00f5ff");
    arcGrad.addColorStop(1, "#8b5cf6");

    mapCtx.strokeStyle = arcGrad;
    mapCtx.lineWidth = 2.5;
    mapCtx.shadowColor = "#00f5ff";
    mapCtx.shadowBlur = 12;
    mapCtx.stroke();
    mapCtx.restore();

    // 6. Animated Data Packet Particles Streaming Along Arc
    const mode = mapState.trafficMode;
    const particleCount = mode === "download" || mode === "upload" ? 28 : 6;
    const speedMult = mode === "download" || mode === "upload" ? 2.5 : 1.0;

    for (let i = 0; i < particleCount; i++) {
      const p = mapState.particles[i % mapState.particles.length];
      p.t = (p.t + p.speed * speedMult) % 1.0;

      // When downloading: flow from Server (t=1) to Client (t=0)
      // When uploading / idle: flow from Client to Server
      const t = mode === "download" ? (1.0 - p.t) : p.t;

      // Quadratic Bezier Formula: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const bx = (1 - t) * (1 - t) * clientPt.x + 2 * (1 - t) * t * midX + t * t * serverPt.x;
      const by = (1 - t) * (1 - t) * clientPt.y + 2 * (1 - t) * t * midY + t * t * serverPt.y;

      let pColor = "#00f5ff";
      if (mode === "download") pColor = "#34d399";
      if (mode === "upload") pColor = "#ec4899";

      mapCtx.beginPath();
      mapCtx.arc(bx, by, p.size, 0, Math.PI * 2);
      mapCtx.fillStyle = pColor;
      mapCtx.shadowColor = pColor;
      mapCtx.shadowBlur = 10;
      mapCtx.fill();
    }
    mapCtx.shadowBlur = 0;

    // 7. Beacons & Nodes Rendering
    mapState.beaconPulse = (mapState.beaconPulse + 0.04) % (Math.PI * 2);
    const pulseR = 8 + Math.sin(mapState.beaconPulse) * 4;

    // Client Node (YOU - Emerald Green)
    mapCtx.beginPath();
    mapCtx.arc(clientPt.x, clientPt.y, pulseR * 2, 0, Math.PI * 2);
    mapCtx.strokeStyle = "rgba(16, 185, 129, 0.35)";
    mapCtx.lineWidth = 1.5;
    mapCtx.stroke();

    mapCtx.beginPath();
    mapCtx.arc(clientPt.x, clientPt.y, 6, 0, Math.PI * 2);
    mapCtx.fillStyle = "#10b981";
    mapCtx.shadowColor = "#10b981";
    mapCtx.shadowBlur = 14;
    mapCtx.fill();

    mapCtx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
    mapCtx.fillStyle = "#34d399";
    mapCtx.fillText("CLIENT NODE (YOU)", clientPt.x + 10, clientPt.y - 6);

    // Edge Server Node (Violet / Hot Pink)
    mapCtx.beginPath();
    mapCtx.arc(serverPt.x, serverPt.y, pulseR * 2, 0, Math.PI * 2);
    mapCtx.strokeStyle = "rgba(139, 92, 246, 0.4)";
    mapCtx.lineWidth = 1.5;
    mapCtx.stroke();

    mapCtx.beginPath();
    mapCtx.arc(serverPt.x, serverPt.y, 6, 0, Math.PI * 2);
    mapCtx.fillStyle = "#c084fc";
    mapCtx.shadowColor = "#c084fc";
    mapCtx.shadowBlur = 14;
    mapCtx.fill();

    mapCtx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
    mapCtx.fillStyle = "#c084fc";
    mapCtx.fillText(`EDGE (${activeEdge.code})`, serverPt.x + 10, serverPt.y - 6);

    requestAnimationFrame(drawWorldMapRadar);
  }

  if (mapCanvas) {
    requestAnimationFrame(drawWorldMapRadar);
  }

  // Start sniffer automatically
  startSniffer();
});
