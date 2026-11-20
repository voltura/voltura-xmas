export function weather(canvas, background, board, daylightLevel) {
  const context = canvas.getContext('2d');
  const snow = background.getContext('2d');
  if (!context || !snow) return { spark() {}, fireworks() {} };
  const snowBands = [25, 25, 34, 37].map(count => ({
    x: 0, y: 0, width: 0, height: 0,
    flakes: Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(), speed: 10 + Math.random() * 23,
      radius: 2.4 + Math.random() ** 1.6 * 5, phase: Math.random() * 6,
      angle: Math.random() * 2 * Math.PI, turnTime: 8 + Math.random() * 6,
      direction: Math.random() < .5 ? -1 : 1,
      tone: Math.random(), alpha: .46 + Math.random() * .42,
    })),
  }));
  const bulbs = [
    [.861, .491, '255,78,44'], [.85, .532, '80,164,255'], [.886, .531, '53,243,146'],
    [.851, .592, '76,171,255'], [.897, .581, '255,79,43'], [.87, .645, '61,240,137'],
    [.835, .666, '255,87,52'], [.88, .686, '73,173,255'], [.922, .699, '255,71,43'],
    [.833, .738, '70,245,151'], [.881, .745, '255,83,49'],
  ];
  const snowGlints = [[.16,.82],[.26,.91],[.35,.88],[.47,.84],[.57,.79],[.63,.92],[.68,.84],[.73,.86],[.81,.81],[.91,.9]];
  const sparks = [];
  let width = 1, height = 1, previous = 0;
  let snowWidth = 1, snowHeight = 1;
  function size(layer, drawing) {
    const rect = layer.getBoundingClientRect();
    const dp = Math.min(devicePixelRatio, 2);
    layer.width = Math.round(rect.width * dp);
    layer.height = Math.round(rect.height * dp);
    drawing.setTransform(dp, 0, 0, dp, 0, 0);
    return [rect.width, rect.height];
  }
  new ResizeObserver(() => { [width, height] = size(canvas, context); }).observe(canvas);
  function positionSnow() {
    const bounds = board.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min(snowWidth, bounds.right);
    const top = Math.max(0, Math.min(snowHeight, bounds.top));
    const bottom = Math.max(top, Math.min(snowHeight, bounds.bottom));
    const areas = [
      [0, top, left, bottom - top],
      [right, top, snowWidth - right, bottom - top],
      [0, 0, snowWidth, top],
      [0, bottom, snowWidth, snowHeight - bottom],
    ];
    areas.forEach(([x, y, width, height], index) => Object.assign(snowBands[index], { x, y, width, height }));
  }
  const snowResize = new ResizeObserver(() => {
    [snowWidth, snowHeight] = size(background, snow);
    positionSnow();
  });
  snowResize.observe(background);
  snowResize.observe(board);
  addEventListener('scroll', positionSnow, { passive: true });

  function snowCrystal(x, y, radius, angle) {
    snow.beginPath();
    for (let arm = 0; arm < 6; arm++) {
      const bearing = angle + arm * Math.PI / 3;
      const dx = Math.cos(bearing);
      const dy = Math.sin(bearing);
      const length = radius * (arm === 0 ? 1 : arm === 3 ? .72 : .83);
      snow.moveTo(x, y);
      snow.lineTo(x + dx * length, y + dy * length);
      if (radius >= 3.4) {
        const branchX = x + dx * length * .62;
        const branchY = y + dy * length * .62;
        for (const side of [-1, 1]) {
          snow.moveTo(branchX, branchY);
          snow.lineTo(branchX + (dx * .18 - dy * side * .24) * length,
            branchY + (dy * .18 + dx * side * .24) * length);
        }
      }
    }
    snow.stroke();
  }

  function drawSnow(dt, time, daylight) {
    const shade = 179 - 41 * daylight;
    const variation = 76 + 22 * daylight;
    for (const { x, y, width, height, flakes } of snowBands) {
      if (width < 4 || height < 12) continue;
      const count = Math.min(flakes.length, Math.max(4, Math.round(width * height / 1750)));
      for (let i = 0; i < count; i++) {
        const flake = flakes[i];
        flake.y = (flake.y + flake.speed * dt / height) % 1;
        const sway = Math.sin(time * .8 + flake.phase) * Math.min(.13, 14 / width);
        const px = x + ((flake.x + sway + 1) % 1) * width;
        const py = y + flake.y * height;
        snow.globalAlpha = flake.alpha;
        const gray = Math.round(shade + flake.tone * variation);
        snow.strokeStyle = 'rgb(' + gray + ',' + (gray + 2) + ',' + (gray + 5) + ')';
        snow.lineWidth = flake.radius < 2.5 ? 1.15 : 1.45;
        snow.lineCap = 'round';
        const angle = flake.angle + flake.direction * time * 2 * Math.PI / flake.turnTime;
        snowCrystal(px, py, flake.radius, angle);
      }
    }
    snow.globalAlpha = 1;
  }
  function glow(x, y, radius, color, alpha) {
    const radial = context.createRadialGradient(x, y, 0, x, y, radius);
    radial.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    radial.addColorStop(1, 'rgba(' + color + ',0)');
    context.fillStyle = radial;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function twinkleTree(mapX, cover, time) {
    const interval = 1.65;
    const slot = Math.floor(time / interval);
    const progress = (time - slot * interval) / .85;
    if (progress >= 1) return;
    // Step through the bulbs out of order, leaving a pause between brief twinkles.
    const [x, y, color] = bulbs[(slot * 7) % bulbs.length];
    const pulse = Math.sin(Math.PI * progress);
    const radius = Math.max(2.4, cover * .0038);
    const centerX = mapX(x);
    const centerY = y * height;
    glow(centerX, centerY, radius * 2, color, .82 * pulse);
    glow(centerX, centerY, radius * 1.35, '255,251,231', pulse);
    context.fillStyle = 'rgba(255,253,241,' + .88 * pulse + ')';
    context.beginPath();
    context.arc(centerX, centerY, radius * .53, 0, Math.PI * 2);
    context.fill();
  }
  function chimneySmoke(x, y, scale, time, daylight) {
    const color = [201 + 46 * daylight, 217 + 21 * daylight, 239 - 19 * daylight].map(Math.round).join(',');
    for (let puff = 0; puff < 9; puff++) {
      const age = (time / 9 + puff / 9) % 1;
      const centerX = x + scale * (.04 * age + Math.sin(age * 8 - time * .58) * .007 * age);
      const centerY = y - scale * (.08 * age + .014 * age ** 2);
      const spread = scale * (.004 + age * .012);
      const opacity = (.25 + .07 * daylight) * Math.sin(Math.PI * age) * (1 - age * .46);
      glow(centerX, centerY, spread, color, opacity);
      glow(centerX - spread * .52, centerY + spread * .37, spread * .72, color, opacity * .6);
      glow(centerX + spread * .43, centerY - spread * .48, spread * .85, color, opacity * .54);
    }
  }
  function glint(x, y, size, strength) {
    glow(x, y, size * 1.85, '255,230,166', strength * .65);
    context.fillStyle = 'rgba(255,251,231,' + strength + ')';
    context.beginPath();
    context.moveTo(x, y - size);
    context.lineTo(x + size * .19, y - size * .17);
    context.lineTo(x + size * .77, y);
    context.lineTo(x + size * .19, y + size * .17);
    context.lineTo(x, y + size);
    context.lineTo(x - size * .19, y + size * .17);
    context.lineTo(x - size * .77, y);
    context.lineTo(x - size * .19, y - size * .17);
    context.closePath();
    context.fill();
  }
  function frame(ms) {
    const time = ms / 1000;
    const dt = Math.min(.06, time - previous);
    previous = time;
    context.clearRect(0, 0, width, height);
    snow.clearRect(0, 0, snowWidth, snowHeight);
    if (!document.hidden) {
      const daylight = daylightLevel();
      const cover = matchMedia('(max-width:700px)').matches ? Math.max(width, height * 1.777) : width;
      const offset = (width - cover) * .89;
      function mapX(x) { return x * cover + offset; }
      chimneySmoke(mapX(.652), height * .327, Math.min(cover, height * 1.777), time, daylight);
      twinkleTree(mapX, cover, time);
      for (const [i, [x, y]] of snowGlints.entries()) {
        const strength = Math.pow(Math.max(0, Math.sin(time * (1.05 + i * .026) + i * 3.7)), 5);
        if (strength > .1) glint(mapX(x), y * height, Math.max(4, Math.min(8, width * .006)) * (i % 3 === 0 ? 1.25 : 1), strength);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) { sparks.splice(i, 1); continue; }
        const fade = 1 - p.age / p.life;
        glow(p.x + p.dx * p.age, p.y + p.dy * p.age + 35 * p.age ** 2, 2 + 3 * fade, p.color, fade);
      }
      drawSnow(dt, time, daylight);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function burst(x, y, color, count, velocity) {
    for (let i = 0; i < count; i++) {
      const angle = i * 2 * Math.PI / count;
      const speed = velocity * (.42 + Math.random() * .58);
      sparks.push({ x: x * width, y: y * height, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
        color, age: 0, life: .55 + Math.random() * .62 });
    }
  }
  return {
    spark: (x, y) => burst(x, y, '255,210,104', 25, 70),
    fireworks() {
      burst(.68, .19, '255,205,114', 45, 180);
      setTimeout(() => burst(.8, .25, '248,118,133', 38, 135), 210);
      setTimeout(() => burst(.57, .23, '128,196,255', 38, 123), 350);
    },
  };
}

export function scheduleTomte(tomte) {
  const later = (min, max) => setTimeout(walk, (min + Math.random() * (max - min)) * 1000);
  function walk() {
    if (document.hidden || document.querySelector('dialog[open]')) {
      later(35, 55);
      return;
    }
    tomte.style.setProperty('--tomte-duration', Math.max(12, (innerWidth + 54) / 64) + 's');
    tomte.hidden = false;
  }
  tomte.addEventListener('animationend', event => {
    if (event.animationName !== 'tomte-cross') return;
    tomte.hidden = true;
    later(300, 540);
  });
  later(75, 135);
}

let bellAudio;
export async function ringBell() {
  try {
    bellAudio ??= new AudioContext();
    await bellAudio.resume();
    const start = bellAudio.currentTime + .015;
    for (const strike of [0, .14]) {
      for (const [frequency, level, decay] of [[820, .12, .59], [1298, .042, .4], [1956, .028, .28], [2710, .017, .16]]) {
        const time = start + strike;
        const tone = bellAudio.createOscillator();
        const envelope = bellAudio.createGain();
        tone.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, time);
        envelope.gain.exponentialRampToValueAtTime(level * (strike ? .54 : 1), time + .006);
        envelope.gain.exponentialRampToValueAtTime(.0001, time + decay);
        tone.connect(envelope).connect(bellAudio.destination);
        tone.start(time);
        tone.stop(time + decay);
      }
    }
  } catch {
    // The bell still works when audio is unavailable.
  }
}

// The source for orb-se-xmas in Voltura Music's station catalogue.
const christmasStream = 'https://azura.linkodev.ch/listen/xmas/radio.mp3';

export function christmasRadio(onUnavailable) {
  let audio;
  function suspend() {
    if (!audio) return;
    const previous = audio;
    audio = null;
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
  }
  function fail(session) {
    if (audio !== session) return;
    suspend();
    onUnavailable();
  }
  return {
    async resume() {
      if (!audio) {
        const session = new Audio();
        audio = session;
        audio.volume = .52;
        audio.preload = 'none';
        audio.addEventListener('error', () => fail(session), { once: true });
        audio.addEventListener('ended', () => fail(session), { once: true });
        audio.src = christmasStream;
      }
      const session = audio;
      try {
        await session.play();
        return audio === session;
      } catch (error) {
        if (error.name !== 'NotAllowedError') fail(session);
        return false;
      }
    },
    suspend,
  };
}
