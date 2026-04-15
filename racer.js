/**
 * MoneyPit — 8-bit Pixel Racer
 * Draws a pixel-art race car that drives across the screen bottom,
 * with exhaust smoke puffs and speed lines. Pure canvas, no deps.
 */
(function () {
  const canvas = document.getElementById('pixelRacer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const SCALE = 4; // each "pixel" = 4 real pixels

  // --- Pixel art car sprite (facing right) ---
  // 0 = transparent, colour codes below
  const PALETTE = {
    1: '#ff6b35', // body orange
    2: '#ffd700', // accent gold
    3: '#0d0d1a', // dark window
    4: '#00b4d8', // window blue
    5: '#ffffff', // highlight
    6: '#2a2a3a', // wheel dark
    7: '#ff4757', // tail light
  };

  const CAR = [
    [0,0,0,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,2,4,4,4,1,1,1,0,0],
    [0,1,1,1,1,4,4,4,1,1,1,1,0],
    [1,1,7,1,1,1,1,1,1,1,1,2,1],
    [0,6,6,0,1,1,1,1,0,6,6,0,0],
    [0,6,6,0,0,0,0,0,0,6,6,0,0],
  ];

  // Car size in real pixels
  const CAR_W = CAR[0].length * SCALE;
  const CAR_H = CAR.length * SCALE;

  // Speed lines (drawn behind car)
  const LINES = Array.from({ length: 6 }, (_, i) => ({
    y: 2 + i * 3,
    len: 8 + Math.random() * 12,
    alpha: 0.15 + Math.random() * 0.2,
  }));

  // Smoke particles
  const smokes = [];
  let lastSmoke = 0;

  function spawnSmoke(x, y) {
    smokes.push({
      x, y,
      vx: -(0.4 + Math.random() * 0.6),
      vy: -(0.2 + Math.random() * 0.3),
      r: 2 + Math.random() * 3,
      alpha: 0.5,
      life: 1,
    });
  }

  // Car position
  let carX = -CAR_W - 40;
  const SPEED = 3.2;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = 60;
  }

  function drawCar(x, y) {
    CAR.forEach((row, ry) => {
      row.forEach((cell, rx) => {
        if (!cell) return;
        ctx.fillStyle = PALETTE[cell];
        ctx.fillRect(x + rx * SCALE, y + ry * SCALE, SCALE, SCALE);
      });
    });
  }

  function drawSpeedLines(x, y) {
    ctx.save();
    LINES.forEach(line => {
      ctx.globalAlpha = line.alpha;
      ctx.fillStyle = '#ff6b35';
      ctx.fillRect(x - line.len * SCALE, y + line.y * SCALE, line.len * SCALE, SCALE);
    });
    ctx.restore();
  }

  function tick(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const groundY = canvas.height - CAR_H - 4;

    // Spawn smoke at exhaust (left side of car)
    if (now - lastSmoke > 60) {
      spawnSmoke(carX + SCALE, groundY + CAR_H - SCALE * 2);
      lastSmoke = now;
    }

    // Update & draw smoke
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.025;
      s.alpha = s.life * 0.5;
      s.r *= 1.015;
      if (s.life <= 0) { smokes.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Speed lines
    drawSpeedLines(carX, groundY);

    // Draw car
    drawCar(carX, groundY);

    // Ground line (thin neon stripe)
    ctx.save();
    ctx.strokeStyle = 'rgba(0,180,216,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 3);
    ctx.lineTo(canvas.width, canvas.height - 3);
    ctx.stroke();
    ctx.restore();

    // Move car
    carX += SPEED;
    if (carX > canvas.width + 40) {
      carX = -CAR_W - 40;
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
})();
