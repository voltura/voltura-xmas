export function weather(canvas, reducedMotion) {
  const context = canvas.getContext('2d');
  if (!context) return { spark() {}, fireworks() {} };
  const flakes = Array.from({ length: 62 }, () => ({
    x: Math.random(), y: Math.random(), speed: .01 + Math.random() * .034,
    radius: .4 + Math.random() * 1.6, phase: Math.random() * 6, alpha: .23 + Math.random() * .65,
  }));
  const bulbs = [
    [.861, .491, '255,78,44'], [.85, .532, '80,164,255'], [.886, .531, '53,243,146'],
    [.851, .592, '76,171,255'], [.897, .581, '255,79,43'], [.87, .645, '61,240,137'],
    [.835, .666, '255,87,52'], [.88, .686, '73,173,255'], [.922, .699, '255,71,43'],
    [.833, .738, '70,245,151'], [.881, .745, '255,83,49'],
  ];
  const snowGlints = [[.16,.82],[.26,.91],[.35,.88],[.47,.84],[.63,.92],[.73,.86],[.81,.81]];
  const sparks = [];
  let width = 1, height = 1, previous = 0;
  function size() {
    const rect = canvas.getBoundingClientRect();
    const dp = Math.min(devicePixelRatio, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dp);
    canvas.height = Math.round(height * dp);
    context.setTransform(dp, 0, 0, dp, 0, 0);
  }
  new ResizeObserver(size).observe(canvas);
  function glow(x, y, radius, color, alpha) {
    const radial = context.createRadialGradient(x, y, 0, x, y, radius);
    radial.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    radial.addColorStop(1, 'rgba(' + color + ',0)');
    context.fillStyle = radial;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function frame(ms) {
    const time = ms / 1000;
    const dt = Math.min(.06, time - previous);
    previous = time;
    context.clearRect(0, 0, width, height);
    if (!document.hidden && !reducedMotion.matches) {
      const cover = matchMedia('(max-width:700px)').matches ? Math.max(width, height * 1.777) : width;
      const offset = (width - cover) * .63;
      function mapX(x) { return x * cover + offset; }
      for (const [i, [x, y, color]] of bulbs.entries()) {
        glow(mapX(x), y * height, Math.max(5, width * .009), color, .17 + .13 * Math.sin(time * 1.7 + i * 5.3));
      }
      for (const [i, [x, y]] of snowGlints.entries()) {
        const strength = Math.pow(Math.max(0, Math.sin(time * 1.1 + i * 5)), 9);
        if (strength > .12) glow(mapX(x), y * height, 4, '255,245,217', strength * .85);
      }
      for (const f of flakes) {
        f.y = (f.y + f.speed * dt) % 1;
        f.x = (f.x + (Math.sin(time * .7 + f.phase) * .008 + .005) * dt + 1) % 1;
        context.fillStyle = 'rgba(255,251,237,' + f.alpha + ')';
        context.beginPath();
        context.arc(f.x * width, f.y * height, f.radius, 0, Math.PI * 2);
        context.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) { sparks.splice(i, 1); continue; }
        const fade = 1 - p.age / p.life;
        glow(p.x + p.dx * p.age, p.y + p.dy * p.age + 35 * p.age ** 2, 2 + 3 * fade, p.color, fade);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function burst(x, y, color, count, velocity) {
    if (reducedMotion.matches) return;
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

// James Pierpont's Jingle Bells chorus. A quiet oscillator arrangement played on demand.
const chorus = [
  [64,1],[64,1],[64,2],[64,1],[64,1],[64,2],[64,1],[67,1],[60,1.5],[62,.5],[64,4],
  [65,1],[65,1],[65,1.5],[65,.5],[65,1],[64,1],[64,1],[64,.5],[64,.5],[64,1],[62,1],[62,1],[64,1],[62,2],[67,2],
  [64,1],[64,1],[64,2],[64,1],[64,1],[64,2],[64,1],[67,1],[60,1.5],[62,.5],[64,4],
  [65,1],[65,1],[65,1.5],[65,.5],[65,1],[64,1],[64,1],[64,.5],[64,.5],[67,1],[67,1],[65,1],[62,1],[60,4],
];

export function musicBox() {
  let audio, timer, index = 0, next = 0, generation = 0;
  function note(pitch, time) {
    for (const [multiple, volume, decay] of [[1, .06, .65], [2.01, .013, .22], [3, .004, .12]]) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = multiple * 440 * 2 ** ((pitch - 69) / 12);
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime(volume, time + .016);
      gain.gain.exponentialRampToValueAtTime(.0001, time + decay);
      tone.connect(gain).connect(audio.destination);
      tone.start(time);
      tone.stop(time + decay);
    }
  }
  function schedule() {
    while (next < audio.currentTime + .18) {
      const [pitch, length] = chorus[index];
      note(pitch, next);
      if (index % 6 === 0) note(pitch - 12, next);
      index = (index + 1) % chorus.length;
      next += length * .36 + (index === 0 ? 2 : 0);
    }
  }
  return {
    async resume() {
      const request = ++generation;
      try {
        if (timer) return true;
        audio ??= new AudioContext();
        await audio.resume();
        if (request !== generation) return false;
        next = audio.currentTime + .08;
        schedule();
        timer = setInterval(schedule, 100);
        return true;
      } catch { return false; }
    },
    suspend() {
      generation++;
      clearInterval(timer);
      timer = null;
      if (audio?.state === 'running') void audio.suspend().catch(() => {});
    },
  };
}
