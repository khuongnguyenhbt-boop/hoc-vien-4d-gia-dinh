/**
 * Học Viện 4D Cinema Gia Đình — Mô-đun Hiệu Ứng 4D & Bảng Vẽ Dạ Quang (cinema4d_fx.js)
 * Thuần Vanilla JS (ES6) + Canvas 2D + Web Audio API (0 tệp MP3 ngoài, hoạt động ngoại tuyến 100%).
 * - Hạt sáng không gian 4D & pháo hoa chúc mừng khi trả lời đúng trắc nghiệm.
 * - Bảng vẽ tương tác phủ trực tiếp lên bài giảng (Bút tự do, Mũi tên, Hình tròn, Khung vuông, Dạ quang, Dải sao, Tẩy, Hoàn tác).
 * - Âm thanh tập trung 432Hz dịu nhẹ giúp học sinh tĩnh tâm & Hiệu ứng SFX khi lật thẻ / chuyển trang.
 */
(function (global) {
  'use strict';

  /* ==================== 1. WEB AUDIO API: SFX & 432HZ FOCUS ==================== */
  let audioCtx = null;
  let sfxEnabled = true;
  let healingActive = false;
  let healingNodes = null;

  function getAudioCtx() {
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, volume, delay) {
    if (!sfxEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.08, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration || 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + (duration || 0.18) + 0.02);
  }

  function playSFX(kind) {
    if (!sfxEnabled) return;
    if (kind === 'flip') {
      playTone(523.25, 0.12, 'triangle', 0.07, 0);
      playTone(659.25, 0.16, 'sine', 0.06, 0.06);
    } else if (kind === 'slide') {
      playTone(392, 0.11, 'sine', 0.05, 0);
      playTone(493.88, 0.13, 'sine', 0.045, 0.05);
    } else if (kind === 'correct') {
      playTone(523.25, 0.16, 'triangle', 0.09, 0);
      playTone(659.25, 0.18, 'triangle', 0.09, 0.09);
      playTone(783.99, 0.24, 'sine', 0.1, 0.18);
      playTone(1046.5, 0.34, 'sine', 0.08, 0.27);
    } else if (kind === 'wrong') {
      playTone(260, 0.16, 'sawtooth', 0.04, 0);
      playTone(210, 0.2, 'sine', 0.05, 0.1);
    } else if (kind === 'click') {
      playTone(620, 0.07, 'sine', 0.04, 0);
    }
  }

  function setSfxEnabled(flag) {
    sfxEnabled = Boolean(flag);
    return sfxEnabled;
  }

  function isSfxEnabled() {
    return sfxEnabled;
  }

  /**
   * Bật/Tắt nhạc sóng hài 432Hz êm dịu hỗ trợ học sinh tập trung đọc hiểu & làm bài.
   */
  function toggleHealing432() {
    const ctx = getAudioCtx();
    if (!ctx) return false;

    if (healingActive && healingNodes) {
      try {
        const now = ctx.currentTime;
        healingNodes.master.gain.cancelScheduledValues(now);
        healingNodes.master.gain.setTargetAtTime(0.0001, now, 0.25);
        const nodesToStop = healingNodes.oscs;
        setTimeout(() => {
          nodesToStop.forEach((o) => {
            try {
              o.stop();
            } catch (_e) {}
          });
        }, 900);
      } catch (_e) {}
      healingNodes = null;
      healingActive = false;
      return false;
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.032, ctx.currentTime + 1.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, ctx.currentTime);

    filter.connect(master);
    master.connect(ctx.destination);

    // Hợp âm 432Hz + quãng 5 êm ái (216Hz, 432Hz, 648Hz) với LFO nhẹ tạo cảm giác thở đều
    const freqs = [216, 432, 648];
    const oscs = freqs.map((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      g.gain.setValueAtTime(idx === 1 ? 0.55 : 0.22, ctx.currentTime);
      osc.connect(g);
      g.connect(filter);
      osc.start();
      return osc;
    });

    // LFO nhịp chậm 0.12Hz (nhịp hít thở thư giãn)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.012, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    oscs.push(lfo);

    healingNodes = { master, oscs };
    healingActive = true;
    return true;
  }

  /* ==================== 2. HẠT ÁNH SÁNG 4D & PHÁO HOA CHÚC MỪNG ==================== */
  let pCanvas = null;
  let pCtx = null;
  let ambientParticles = [];
  let burstParticles = [];
  let pAnimId = null;

  function initParticles(canvasEl) {
    if (!canvasEl) return;
    pCanvas = canvasEl;
    pCtx = canvasEl.getContext('2d');
    if (!pCtx) return;

    const resize = () => {
      pCanvas.width = global.innerWidth;
      pCanvas.height = global.innerHeight;
    };
    resize();
    global.addEventListener('resize', resize);

    ambientParticles = [];
    for (let i = 0; i < 36; i++) {
      ambientParticles.push({
        x: Math.random() * pCanvas.width,
        y: Math.random() * pCanvas.height,
        r: 1 + Math.random() * 2.2,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -0.15 - Math.random() * 0.35,
        alpha: 0.15 + Math.random() * 0.35
      });
    }

    const tick = () => {
      pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

      const isLight = document.body.classList.contains('theme-light') || document.body.classList.contains('theme-sketch');
      const dotColor = isLight ? '234, 88, 12' : '251, 191, 36';

      for (const p of ambientParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = pCanvas.height + 10;
          p.x = Math.random() * pCanvas.width;
        }
        if (p.x < -10) p.x = pCanvas.width + 10;
        if (p.x > pCanvas.width + 10) p.x = -10;

        pCtx.beginPath();
        pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(${dotColor}, ${isLight ? p.alpha * 0.45 : p.alpha})`;
        pCtx.fill();
      }

      // Pháo hoa sao khi học sinh trả lời đúng
      for (let i = burstParticles.length - 1; i >= 0; i--) {
        const b = burstParticles[i];
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.12;
        b.life -= 0.018;
        if (b.life <= 0) {
          burstParticles.splice(i, 1);
          continue;
        }
        pCtx.save();
        pCtx.globalAlpha = Math.max(0, b.life);
        pCtx.fillStyle = b.color;
        pCtx.beginPath();
        pCtx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        pCtx.fill();
        pCtx.restore();
      }

      pAnimId = requestAnimationFrame(tick);
    };

    if (pAnimId) cancelAnimationFrame(pAnimId);
    pAnimId = requestAnimationFrame(tick);
  }

  function triggerCelebrationBurst(originX, originY) {
    if (!pCanvas) return;
    const cx = Number.isFinite(originX) ? originX : pCanvas.width * 0.65;
    const cy = Number.isFinite(originY) ? originY : pCanvas.height * 0.6;
    const colors = ['#f59e0b', '#10b981', '#38bdf8', '#ec4899', '#a855f7', '#fde047'];
    for (let i = 0; i < 48; i++) {
      const angle = (Math.PI * 2 * i) / 48 + Math.random() * 0.25;
      const speed = 2.5 + Math.random() * 5.2;
      burstParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.4,
        size: 2.5 + Math.random() * 3.5,
        color: colors[i % colors.length],
        life: 1
      });
    }
  }

  /* ==================== 3. BẢNG VẼ DẠ QUANG PHỦ TOÀN MÀN HÌNH ==================== */
  const drawState = {
    canvas: null,
    ctx: null,
    active: false,
    tool: 'pen', // pen | arrow | circle | rect | eraser
    color: '#f59e0b',
    size: 4,
    neon: true,
    stars: false,
    drawing: false,
    startX: 0,
    startY: 0,
    currentPoints: [],
    strokes: [],
    redoStack: []
  };

  function initWhiteboard(canvasEl) {
    if (!canvasEl) return;
    drawState.canvas = canvasEl;
    drawState.ctx = canvasEl.getContext('2d');
    if (!drawState.ctx) return;

    const resize = () => {
      canvasEl.width = global.innerWidth;
      canvasEl.height = global.innerHeight;
      redrawAllStrokes();
    };
    resize();
    global.addEventListener('resize', resize);

    const getPos = (e) => {
      if (e.touches && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const onDown = (e) => {
      if (!drawState.active) return;
      e.preventDefault();
      const pos = getPos(e);
      drawState.drawing = true;
      drawState.startX = pos.x;
      drawState.startY = pos.y;
      drawState.currentPoints = [pos];
      drawState.redoStack = [];
    };

    const onMove = (e) => {
      if (!drawState.active || !drawState.drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
        drawState.currentPoints.push(pos);
        redrawAllStrokes();
        renderStroke(drawState.ctx, {
          tool: drawState.tool,
          color: drawState.color,
          size: drawState.size,
          neon: drawState.neon,
          stars: drawState.stars,
          points: drawState.currentPoints
        });
      } else {
        redrawAllStrokes();
        renderStroke(drawState.ctx, {
          tool: drawState.tool,
          color: drawState.color,
          size: drawState.size,
          neon: drawState.neon,
          x1: drawState.startX,
          y1: drawState.startY,
          x2: pos.x,
          y2: pos.y
        });
      }
    };

    const onUp = (e) => {
      if (!drawState.active || !drawState.drawing) return;
      drawState.drawing = false;
      const pos = e.changedTouches && e.changedTouches[0]
        ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
        : { x: e.clientX || drawState.startX, y: e.clientY || drawState.startY };

      if (drawState.tool === 'pen' || drawState.tool === 'eraser') {
        if (drawState.currentPoints.length > 0) {
          drawState.strokes.push({
            tool: drawState.tool,
            color: drawState.color,
            size: drawState.size,
            neon: drawState.neon,
            stars: drawState.stars,
            points: drawState.currentPoints.slice()
          });
        }
      } else {
        drawState.strokes.push({
          tool: drawState.tool,
          color: drawState.color,
          size: drawState.size,
          neon: drawState.neon,
          x1: drawState.startX,
          y1: drawState.startY,
          x2: pos.x,
          y2: pos.y
        });
      }
      drawState.currentPoints = [];
      redrawAllStrokes();
    };

    canvasEl.addEventListener('mousedown', onDown);
    global.addEventListener('mousemove', onMove);
    global.addEventListener('mouseup', onUp);

    canvasEl.addEventListener('touchstart', onDown, { passive: false });
    global.addEventListener('touchmove', onMove, { passive: false });
    global.addEventListener('touchend', onUp);
  }

  function renderStroke(ctx, s) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.tool === 'eraser' ? Math.max(18, s.size * 3.5) : s.size;

    if (s.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      if (s.neon) {
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 12;
      }
    }

    if (s.tool === 'pen' || s.tool === 'eraser') {
      const pts = s.points || [];
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();

        // Hiệu ứng Dải Sao lấp lánh cho học sinh nhỏ yêu thích
        if (s.stars && s.tool === 'pen') {
          for (let i = 0; i < pts.length; i += 6) {
            const pt = pts[i];
            ctx.beginPath();
            ctx.arc(pt.x + ((i % 3) - 1) * 6, pt.y - ((i % 2) * 5), 2.3, 0, Math.PI * 2);
            ctx.fillStyle = '#fde047';
            ctx.fill();
          }
        }
      }
    } else if (s.tool === 'circle') {
      const r = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.tool === 'rect') {
      ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
    } else if (s.tool === 'arrow') {
      const headLen = Math.max(14, s.size * 3.5);
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - headLen * Math.cos(angle - Math.PI / 6), s.y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - headLen * Math.cos(angle + Math.PI / 6), s.y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    ctx.restore();
  }

  function redrawAllStrokes() {
    if (!drawState.ctx || !drawState.canvas) return;
    drawState.ctx.clearRect(0, 0, drawState.canvas.width, drawState.canvas.height);
    for (const s of drawState.strokes) {
      renderStroke(drawState.ctx, s);
    }
  }

  function setDrawActive(flag) {
    drawState.active = Boolean(flag);
    if (drawState.canvas) {
      drawState.canvas.classList.toggle('active', drawState.active);
    }
    return drawState.active;
  }

  function setDrawConfig(partial) {
    Object.assign(drawState, partial || {});
  }

  function undoStroke() {
    if (drawState.strokes.length === 0) return;
    drawState.redoStack.push(drawState.strokes.pop());
    redrawAllStrokes();
  }

  function redoStroke() {
    if (drawState.redoStack.length === 0) return;
    drawState.strokes.push(drawState.redoStack.pop());
    redrawAllStrokes();
  }

  function clearDrawings() {
    drawState.strokes = [];
    drawState.redoStack = [];
    redrawAllStrokes();
  }

  global.CinemaFX = {
    playSFX,
    setSfxEnabled,
    isSfxEnabled,
    toggleHealing432,
    initParticles,
    triggerCelebrationBurst,
    initWhiteboard,
    setDrawActive,
    setDrawConfig,
    undoStroke,
    redoStroke,
    clearDrawings
  };
})(window);
