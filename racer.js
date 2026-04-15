/**
 * MoneyPit — 8-bit Pixel Racer Strip
 * Two cars race across the bottom. Car 2 catches up and overtakes.
 * Exhaust flames + smoke + speed lines. Pure canvas.
 */
(function () {
  const canvas = document.getElementById('pixelRacer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const S = 4; // pixel scale

  const PAL = {
    // Car 1 (MoneyPit orange)
    a1:'#ff6b35', a2:'#ffd700', a3:'#0a0a18', a4:'#00b4d8', a5:'#ff0a54', a6:'#2a2a3a',
    // Car 2 (Stark blue — rival)
    b1:'#00b4d8', b2:'#48cae4', b3:'#0a0a18', b4:'#ff6b35', b5:'#ffffff', b6:'#1a1a30',
  };

  // Sprites — top-down/side view, facing right
  const CAR_A = [
    [0,0, 'a6','a6','a6','a6','a6','a6','a6','a6',0,0],
    [0,'a2','a1','a1','a1','a1','a1','a1','a1','a2',0,0],
    ['a5','a1','a3','a4','a4','a4','a4','a3','a1','a5',0,0],
    ['a1','a1','a1','a3','a4','a4','a3','a1','a1','a1',0,0],
    [0,'a2','a1','a1','a1','a1','a1','a1','a1','a2',0,0],
    [0,0,'a6','a6',0,0,0,0,'a6','a6',0,0],
  ];

  const CAR_B = [
    [0,0,'b6','b6','b6','b6','b6','b6','b6','b6',0,0],
    [0,'b2','b1','b1','b1','b1','b1','b1','b1','b2',0,0],
    ['b5','b1','b3','b4','b4','b4','b4','b3','b1','b5',0,0],
    ['b1','b1','b1','b3','b4','b4','b3','b1','b1','b1',0,0],
    [0,'b2','b1','b1','b1','b1','b1','b1','b1','b2',0,0],
    [0,0,'b6','b6',0,0,0,0,'b6','b6',0,0],
  ];

  const CW = CAR_A[0].length * S;
  const CH = CAR_A.length * S;

  // Particle pools
  const smokes = [];
  const flames = [];

  function drawCar(sprite, x, y) {
    sprite.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (!cell || cell === 0) return;
        ctx.fillStyle = PAL[cell] || cell;
        ctx.fillRect(x + rx * S, y + ry * S, S, S);
      });
    });
  }

  function spawnSmoke(x, y, fast) {
    smokes.push({
      x, y,
      vx: -(0.5 + Math.random() * (fast ? 1.2 : 0.7)),
      vy: -(0.1 + Math.random() * 0.35),
      r: 1.5 + Math.random() * 2.5,
      life: 1.0,
      col: fast ? '#666' : '#444',
    });
  }

  function spawnFlame(x, y) {
    flames.push({
      x, y,
      vx: -(1.5 + Math.random() * 2),
      vy: (Math.random() - 0.5) * 0.6,
      r: 2 + Math.random() * 3,
      life: 1.0,
      hue: 20 + Math.random() * 30,
    });
  }

  let t = 0;

  // Car A — always slightly ahead
  let axPos = 120;
  const AX_BASE = 3.0;

  // Car B — starts behind, cycles through: chase → overtake → lead → reset
  let bxPos = 0;
  const PHASE_LEN = 260; // frames per cycle phase
  let phase = 0; // 0=chasing, 1=overtaking, 2=leading, 3=reset

  let lastSmoke = 0;
  let lastFlame = 0;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = 64;
  }

  function tick(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gY = canvas.height - CH - 6;

    // --- Phase logic ---
    phase = Math.floor(t / PHASE_LEN) % 4;

    let avx = AX_BASE;
    let bvx;
    switch (phase) {
      case 0: bvx = AX_BASE * 1.35; break; // chasing
      case 1: bvx = AX_BASE * 1.6;  break; // overtaking
      case 2: bvx = AX_BASE * 1.0;  break; // leading
      case 3:
        // Reset B behind A when both off screen or B far ahead
        if (bxPos > canvas.width + 80) {
          bxPos = -CW * 3;
        }
        bvx = AX_BASE * 1.3;
        break;
      default: bvx = AX_BASE;
    }

    axPos += avx;
    bxPos += bvx;

    // Wrap A
    if (axPos > canvas.width + 80) {
      axPos = -CW - 20;
    }

    // Smoke — both cars
    if (now - lastSmoke > 55) {
      spawnSmoke(axPos, gY + CH - S, phase === 1);
      if (bxPos > -CW && bxPos < canvas.width + CW) {
        spawnSmoke(bxPos, gY + CH - S, phase >= 1);
      }
      lastSmoke = now;
    }

    // Flames on Car B when overtaking (boost)
    if ((phase === 1 || phase === 2) && now - lastFlame > 30) {
      spawnFlame(bxPos, gY + CH / 2);
      lastFlame = now;
    }

    // Draw smokes
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.x += s.vx; s.y += s.vy;
      s.life -= 0.028; s.r *= 1.018;
      if (s.life <= 0) { smokes.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = s.life * 0.42;
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Draw flames
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i];
      f.x += f.vx; f.y += f.vy;
      f.life -= 0.07; f.r *= 1.04;
      if (f.life <= 0) { flames.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = f.life * 0.85;
      ctx.fillStyle = `hsl(${f.hue}, 100%, ${55 + (1 - f.life) * 20}%)`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Speed lines for Car A
    for (let i = 0; i < 5; i++) {
      const lineY = gY + 4 + i * 5;
      const lineLen = (10 + i * 4) * S;
      ctx.save();
      ctx.globalAlpha = 0.08 + i * 0.015;
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(axPos - lineLen, lineY, lineLen, S);
      ctx.restore();
    }

    // Speed lines for Car B (blue)
    if (phase >= 1 && bxPos > 0) {
      for (let i = 0; i < 5; i++) {
        const lineY = gY + 4 + i * 5;
        const lineLen = (12 + i * 5) * S * (phase === 1 ? 1.4 : 1);
        ctx.save();
        ctx.globalAlpha = 0.1 + i * 0.018;
        ctx.fillStyle = '#00b4d8';
        ctx.fillRect(bxPos - lineLen, lineY, lineLen, S);
        ctx.restore();
      }
    }

    // Draw cars (B under A so A appears on top when side-by-side)
    if (bxPos > -CW) drawCar(CAR_B, bxPos, gY);
    drawCar(CAR_A, axPos, gY);

    // Road stripe
    ctx.save();
    ctx.strokeStyle = 'rgba(0,180,216,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -t * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 4);
    ctx.lineTo(canvas.width, canvas.height - 4);
    ctx.stroke();
    ctx.restore();

    t++;
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
})();
