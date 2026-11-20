import { weather, christmasRadio, ringBell, scheduleTomte } from '/effects.js';

const $ = id => document.getElementById(id);
const text = {
  sv: {
    title: 'Julkalender', month: 'december', night: 'Natt', day: 'Dag', cycle: 'Dygn', lighting: 'Ljusläge', music: 'Musik på', off: 'Musik av',
    radioError: 'Julradion går inte att spela just nu. Försök igen.',
    countdown: n => n === 0 ? 'God jul!' : n === 1 ? '1 dag kvar till julafton' : n + ' dagar kvar till julafton',
    door: n => 'Lucka ' + n, locked: n => 'Öppnas ' + n + ' december', ready: 'Redo att öppnas', shut: n => 'Stäng lucka ' + n,
    opensIn: n => n === 1 ? 'Öppnas i morgon' : 'Öppnas om ' + n + ' dagar',
    bell: 'Julbjällra', found: 'Du hittade den hemliga julbjällran! Nu kan du öppna alla 24 luckor.',
    relocked: 'Kommande luckor är stängda och låsta igen.',
    error: 'Det gick inte att öppna just nu. Försök igen.', close: 'Stäng',
    visit: 'Besök projektet', started: 'Startat', born: 'Född', settings: 'Inställningar', switchLanguage: 'Switch to English', merry: 'God jul!',
    before: 'Första luckan öppnas den 1 december.',
    share: 'Dela julkalendern', shareLink: 'Länk till julkalendern', copy: 'Kopiera länk',
    copied: 'Länken kopierades.', copyHelp: 'Markera och kopiera länken ovan.', email: 'E-post',
  },
  en: {
    title: 'Christmas Calendar', month: 'December', night: 'Night', day: 'Day', cycle: 'Cycle', lighting: 'Lighting', music: 'Music on', off: 'Music off',
    radioError: 'Xmas radio is unavailable right now. Try again.',
    countdown: n => n === 0 ? 'Merry Christmas!' : n === 1 ? '1 day until Christmas Eve' : n + ' days until Christmas Eve',
    door: n => 'Door ' + n, locked: n => 'Opens December ' + n, ready: 'Ready to open', shut: n => 'Close door ' + n,
    opensIn: n => n === 1 ? 'Opens tomorrow' : 'Opens in ' + n + ' days',
    bell: 'Christmas bell', found: 'You found the hidden Christmas bell! All 24 doors are now yours to open.',
    relocked: 'Future doors are closed and locked again.',
    error: 'That could not be opened right now. Try again.', close: 'Close',
    visit: 'Visit project', started: 'Started', born: 'Born', settings: 'Settings', switchLanguage: 'Byt till svenska', merry: 'Merry Christmas!',
    before: 'The first door opens on December 1.',
    share: 'Share calendar', shareLink: 'Calendar link', copy: 'Copy link',
    copied: 'Link copied.', copyHelp: 'Select and copy the link above.', email: 'Email',
  },
};
const positions = [
  [12, 34], [4, 15], [24, 50], [3, 70], [36, 33], [16, 67],
  [3, 42], [28, 74], [80, 10], [11, 85], [33, 57], [46, 46],
  [21, 25], [45, 79], [55, 25], [20, 87], [76, 78], [69, 42],
  [89, 29], [63, 84], [89, 85], [36, 87], [7, 55], [78, 25],
];
const mobileOrder = [2, 13, 15, 9, 19, 7, 1, 11, 24, 3, 8, 6, 4, 23, 14, 12, 22, 10, 5, 16, 18, 20, 17, 21];
const revealBorders = ['fir', 'woodcut', 'holly'];
const lightOptions = new Map([['night', 'on'], ['day', 'off'], ['cycle', 'cycle']]);
const halfCycle = 15 * 60 * 1000;
const doors = new Map();
const projectImages = new Map();
const card = $('picture');
const reveal = $('reveal');
const doorTooltip = $('door-tooltip');
const effects = weather($('weather'), $('background-snow'), card.closest('.calendar'), () => daylight);
const music = christmasRadio(() => {
  musicOn = false;
  removeMusicStartListeners();
  updateOption('music', 'off');
  feedback = 'radioError';
  render();
});
const read = (store, key, fallback) => {
  try { return JSON.parse(window[store].getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (store, key, value) => {
  try { window[store].setItem(key, JSON.stringify(value)); } catch { /* storage can be disabled */ }
};
const local = 'localStorage';
const session = 'sessionStorage';
const key = 'julkalender-2026-';
const initialOptions = new URLSearchParams(location.search);
const requestedLanguage = initialOptions.get('language');
let language = Object.hasOwn(text, requestedLanguage)
  ? requestedLanguage
  : read(local, key + 'language', 'sv') === 'en' ? 'en' : 'sv';
const requestedNight = initialOptions.get('night');
const savedLight = read(local, key + 'light', 'night');
let light = [...lightOptions].find(([, option]) => option === requestedNight)?.[0]
  ?? (lightOptions.has(savedLight) ? savedLight : 'night');
let daylight = 0;
let cycleElapsed = 0;
let cycleResumedAt = null;
let cycleTimer;
let token = read(session, key + 'bell', '');
let state = { available: 0, remaining: null, unlocked: false };
const daySet = (store, name) => {
  const days = read(store, key + name, []);
  return new Set(Array.isArray(days) ? days.filter(n => Number.isInteger(n) && n >= 1 && n <= 24) : []);
};
const opened = daySet(local, 'opened');
function syncOpenedDoors() {
  for (const day of doors.keys()) {
    const saved = read(local, key + 'opened-' + day, null);
    if (saved === true) opened.add(day);
    else if (saved === false) opened.delete(day);
  }
}
function setOpened(day, isOpened) {
  if (isOpened) opened.add(day);
  else opened.delete(day);
  save(local, key + 'opened-' + day, isOpened);
}
const early = daySet(session, 'early');
function promoteEarlyDoors() {
  for (const day of early) {
    if (day > state.available) continue;
    if (read(local, key + 'opened-' + day, null) === null) setOpened(day, true);
    early.delete(day);
  }
  save(session, key + 'early', [...early]);
}
let active = null;
let busy = false;
let ringing = false;
let musicOn = initialOptions.get('music') === 'on';
let stopClip = () => {};
let presentationRequest = null;
let feedback = '';
let tooltipAnchor = null;
let tooltipTimer;
let sharing = false;
const t = () => text[language];
const isAvailable = day => day <= state.available || state.unlocked;
const isOpen = day => isAvailable(day) && (opened.has(day) || early.has(day));
const auth = () => token ? { Authorization: 'Bearer ' + token } : {};
const dateLabel = day => language === 'sv' ? day + ' december' : 'December ' + day;
const urlFor = project => project.urlByLanguage?.[language] ?? project.url;
function waitLabel(day) {
  const remaining = state.remaining === null ? null : state.remaining - (24 - day);
  return remaining > 0 ? t().opensIn(remaining) : t().locked(day);
}

function updateOption(option, value) {
  const url = new URL(location.href);
  url.searchParams.set(option, value);
  history.replaceState(history.state, '', url);
}

function updateDaylight() {
  if (light === 'cycle') {
    const elapsed = cycleElapsed + (cycleResumedAt === null ? 0 : performance.now() - cycleResumedAt);
    const phase = elapsed % (2 * halfCycle);
    const progress = Math.min(phase, 2 * halfCycle - phase) / halfCycle;
    daylight = progress * progress * (3 - 2 * progress);
  } else {
    daylight = light === 'day' ? 1 : 0;
  }
  document.documentElement.style.setProperty('--daylight', daylight.toFixed(4));
  document.documentElement.dataset.light = daylight >= .5 ? 'day' : 'night';
}

function syncDaylightCycle() {
  clearInterval(cycleTimer);
  const now = performance.now();
  if (cycleResumedAt !== null) cycleElapsed += now - cycleResumedAt;
  cycleResumedAt = light === 'cycle' && !document.hidden ? now : null;
  updateDaylight();
  if (cycleResumedAt !== null) cycleTimer = setInterval(updateDaylight, 1000);
}

function padlock(open) {
  return '<svg class="padlock" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="2"/><path d="' +
    (open ? 'M9 9V6.4a3.7 3.7 0 017.2-1.2' : 'M6.5 9V6a3.5 3.5 0 017 0v3') + '"/></svg>';
}

function hideDoorTooltip(anchor = tooltipAnchor) {
  if (!anchor || anchor !== tooltipAnchor) return;
  clearTimeout(tooltipTimer);
  anchor.removeAttribute('aria-describedby');
  tooltipAnchor = null;
  doorTooltip.hidden = true;
}

function showDoorTooltip(anchor, label, placement = anchor, duration = 3000) {
  if (!label || anchor.hidden || reveal.open) return;
  hideDoorTooltip();
  const target = placement.getBoundingClientRect();
  doorTooltip.textContent = label;
  doorTooltip.hidden = false;
  const { width, height } = doorTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(target.left + (target.width - width) / 2, document.documentElement.clientWidth - width - 8));
  const top = target.top >= height + 12 ? target.top - height - 7 : target.bottom + 7;
  doorTooltip.style.left = left + 'px';
  doorTooltip.style.top = top + 'px';
  tooltipAnchor = anchor;
  anchor.setAttribute('aria-describedby', doorTooltip.id);
  tooltipTimer = setTimeout(() => hideDoorTooltip(anchor), duration);
}

function setupDoors() {
  positions.forEach(([x, y], index) => {
    const day = index + 1;
    const place = mobileOrder.indexOf(day);
    const door = document.createElement('div');
    door.className = 'door' + (day === 24 ? ' large' : '');
    const mobileX = 4 + place % 6 * 15.35;
    const mobileY = [28, 40, 70, 83][Math.floor(place / 6)] + place % 3 * 1.35;
    for (const [variable, value] of Object.entries({
      x, y, mx: mobileX, my: mobileY,
    })) door.style.setProperty('--' + variable, value / 100);
    const image = document.createElement('button');
    image.type = 'button';
    image.className = 'door-image';
    image.setAttribute('aria-haspopup', 'dialog');
    image.hidden = true;
    image.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') showDoorTooltip(image, projectImages.get(day)?.title);
    });
    image.addEventListener('pointerleave', () => {
      if (document.activeElement !== image) hideDoorTooltip(image);
    });
    image.addEventListener('focus', () => {
      if (image.matches(':focus-visible')) showDoorTooltip(image, projectImages.get(day)?.title);
    });
    image.addEventListener('blur', () => hideDoorTooltip(image));
    image.addEventListener('click', () => {
      const project = projectImages.get(day);
      if (!busy && !ringing && !reveal.open && isOpen(day) && project) showPostcard(project, day, image);
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'door-button';
    button.addEventListener('blur', () => hideDoorTooltip(button));
    const flap = document.createElement('span');
    flap.className = 'flap';
    flap.setAttribute('aria-hidden', 'true');
    flap.innerHTML = `<span class="flap-face flap-front"></span>
      <span class="flap-face flap-back"></span>
      <span class="flap-tip"><span class="flap-face flap-front"></span><span class="flap-face flap-back"></span>
        <span class="flap-lock"></span></span>
      <span class="flap-number">${day}</span>`;
    const lock = flap.querySelector('.flap-lock');
    button.append(flap);
    function showCloseTooltip() {
      if (door.classList.contains('open')) showDoorTooltip(button, t().shut(day), flap);
    }
    button.addEventListener('focus', showCloseTooltip);
    flap.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') showCloseTooltip();
    });
    flap.addEventListener('pointerleave', () => {
      if (document.activeElement !== button && door.classList.contains('open')) hideDoorTooltip(button);
    });
    button.addEventListener('click', () => {
      if (isOpen(day)) void closeDoor(day);
      else void openDoor(day);
    });
    door.append(image, button);
    $('doors').append(door);
    doors.set(day, { door, button, flap, lock, image });
  });
}

function render() {
  const word = t();
  document.documentElement.lang = language;
  document.title = 'Voltura ' + word.title;
  const brand = document.querySelector('.brand');
  brand.setAttribute('aria-label', document.title);
  const home = new URL('/', location.origin);
  home.search = location.search;
  home.searchParams.set('language', language);
  brand.href = home.href;
  $('title').textContent = word.title;
  $('month').textContent = word.month.toUpperCase();
  $('countdown').textContent = state.remaining === null ? '' : word.countdown(state.remaining);
  $('day-note').textContent = state.note?.[language] ?? word.before;
  const lightSelect = $('light');
  lightSelect.value = light;
  lightSelect.setAttribute('aria-label', word.lighting);
  for (const option of lightSelect.options) option.textContent = word[option.value];
  $('music').setAttribute('aria-pressed', String(musicOn));
  $('music-label').textContent = musicOn ? word.music : word.off;
  $('lang').textContent = language === 'sv' ? 'EN' : 'SV';
  $('lang').setAttribute('lang', language === 'sv' ? 'en' : 'sv');
  $('lang').setAttribute('aria-label', word.switchLanguage);
  $('bell').setAttribute('aria-label', word.bell);
  $('bell').setAttribute('aria-pressed', String(state.unlocked));
  $('close').setAttribute('aria-label', word.close);
  $('share-header').setAttribute('aria-label', word.share);
  $('share-header').title = word.share;
  $('share-footer').textContent = word.share;
  $('share-title').textContent = word.share;
  $('share-close').setAttribute('aria-label', word.close);
  $('share-link').setAttribute('aria-label', word.shareLink);
  $('share-copy').textContent = word.copy;
  $('share-email').textContent = word.email;
  $('cv').href = language === 'sv' ? 'https://voltura.se/?lang=sv' : 'https://voltura.se/';
  document.querySelector('.controls').setAttribute('aria-label', word.settings);
  $('feedback').textContent = typeof feedback === 'number'
    ? (isAvailable(feedback) ? '' : waitLabel(feedback))
    : word[feedback] ?? '';
  for (const [day, { door, button, lock, image }] of doors) {
    const available = isAvailable(day);
    const project = projectImages.get(day);
    const visible = isOpen(day) && project;
    door.classList.toggle('available', available);
    if (tooltipAnchor === button) {
      const label = visible ? word.shut(day) : available ? '' : waitLabel(day);
      if (doorTooltip.textContent !== label) hideDoorTooltip(button);
    }
    if (!door.classList.contains('closing')) door.classList.toggle('open', Boolean(visible));
    button.setAttribute('aria-label', visible ? word.shut(day) : word.door(day) + ', ' + (available ? word.ready : word.locked(day)));
    if (lock.dataset.status !== String(available)) {
      lock.dataset.status = String(available);
      lock.innerHTML = padlock(available);
    }
    if (!door.classList.contains('closing')) {
      image.hidden = !visible;
      if (image.hidden) hideDoorTooltip(image);
    }
    if (visible) {
      image.setAttribute('aria-label', word.door(day) + ', ' + project.title);
      if (!image.firstElementChild) {
        const thumbnail = document.createElement('img');
        thumbnail.alt = '';
        thumbnail.src = project.thumbnail;
        image.append(thumbnail);
      }
    }
  }
}

async function loadProject(day) {
  if (projectImages.has(day)) return projectImages.get(day);
  const request = await fetch('/api/door/' + day, { headers: auth() });
  if (!request.ok) throw new Error('Door unavailable');
  const project = await request.json();
  const artwork = await fetch(project.image, { headers: auth() });
  if (!artwork.ok) throw new Error('Artwork unavailable');
  project.thumbnail = URL.createObjectURL(await artwork.blob());
  projectImages.set(day, project);
  return project;
}

async function refresh() {
  try {
    const requestedToken = token;
    const response = await fetch('/api/calendar', { headers: auth() });
    if (!response.ok) throw new Error('Calendar unavailable');
    const updated = await response.json();
    if (requestedToken !== token) return;
    state = updated;
    if (token && !state.unlocked) {
      token = '';
      save(session, key + 'bell', '');
    }
    syncOpenedDoors();
    promoteEarlyDoors();
    render();
    await Promise.allSettled([...new Set([...opened, ...early])].filter(isOpen).map(loadProject));
    render();
  } catch {
    feedback = 'error';
    render();
  }
}

async function presentation(project, day) {
  presentationRequest?.abort();
  const request = new AbortController();
  presentationRequest = request;
  const stillShowing = () => presentationRequest === request && reveal.open;
  const word = t();
  $('reveal-date').textContent = dateLabel(day) + (day === 24 ? ' · ' + word.merry : '');
  $('reveal-title').textContent = project.title;
  const year = project.born ?? project.started;
  $('reveal-start-label').textContent = (project.born ? word.born : word.started) + ' ';
  $('reveal-start-year').dateTime = String(year);
  $('reveal-start-year').textContent = year;
  $('reveal-note').textContent = project.note[language];
  $('reveal-description').textContent = project.description[language];
  $('project-link').textContent = word.visit + ' ↗';
  $('project-link').href = urlFor(project);
  const media = $('reveal-media');
  const image = document.createElement('img');
  image.alt = project.title;
  image.src = project.thumbnail;
  const promo = () => {
    if (!stillShowing()) return;
    stopClip();
    media.replaceChildren(image);
  };
  media.replaceChildren(image);
  if (!project.video) return;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = project.thumbnail;
  let videoUrl = project.video;
  if (videoUrl.startsWith('/')) {
    try {
      const response = await fetch(videoUrl, { headers: auth(), signal: request.signal });
      if (!response.ok) throw new Error('Preview unavailable');
      videoUrl = URL.createObjectURL(await response.blob());
    } catch {
      promo();
      return;
    }
    if (!stillShowing()) {
      URL.revokeObjectURL(videoUrl);
      return;
    }
  }
  video.src = videoUrl;
  video.addEventListener('error', promo, { once: true });
  video.addEventListener('ended', promo, { once: true });
  video.addEventListener('timeupdate', () => { if (video.currentTime >= 8) promo(); });
  media.replaceChildren(video);
  const timeout = setTimeout(promo, 11_000);
  stopClip = () => {
    clearTimeout(timeout);
    video.pause();
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    stopClip = () => {};
  };
  video.play().catch(() => { if (video.isConnected) promo(); });
}

async function waitForFlap(flap) {
  // Flush styles so the swing has started before reading its completion.
  void getComputedStyle(flap).transform;
  await Promise.allSettled(flap.getAnimations().map(animation => animation.finished));
}

async function closeDoor(day) {
  if (busy || ringing || !isOpen(day)) return;
  busy = true;
  const { door, flap, button, image } = doors.get(day);
  hideDoorTooltip(button);
  hideDoorTooltip(image);
  door.classList.add('closing');
  door.classList.remove('open');
  if (day <= state.available) setOpened(day, false);
  early.delete(day);
  save(session, key + 'early', [...early]);
  await waitForFlap(flap);
  door.classList.remove('closing');
  render();
  button.focus({ preventScroll: true });
  busy = false;
}

function showPostcard(project, day, opener) {
  active = { project, day, opener };
  hideDoorTooltip();
  const borders = revealBorders.filter(border => border !== reveal.dataset.border);
  reveal.dataset.border = borders[Math.floor(Math.random() * borders.length)];
  reveal.showModal();
  void presentation(project, day);
  reveal.scrollTop = 0;
  reveal.animate([
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 230, easing: 'ease-out' });
  $('close').focus({ preventScroll: true });
}

async function openDoor(day) {
  if (busy || ringing || reveal.open || isOpen(day)) return;
  const { door, flap, button } = doors.get(day);
  if (!isAvailable(day)) {
    feedback = day;
    render();
    showDoorTooltip(button, waitLabel(day), button, 4200);
    return;
  }
  busy = true;
  try {
    const project = await loadProject(day);
    if (!isAvailable(day)) return;
    const normal = day <= state.available;
    if (normal) setOpened(day, true);
    else {
      early.add(day);
      save(session, key + 'early', [...early]);
    }
    feedback = '';
    door.classList.add('opening');
    render();
    await waitForFlap(flap);
    if (day === 24) effects.fireworks();
    if (day === 24) await new Promise(resolve => setTimeout(resolve, 1000));
    if (isOpen(day)) showPostcard(project, day, button);
  } catch {
    feedback = 'error';
    render();
  } finally {
    door.classList.remove('opening');
    busy = false;
  }
}

$('bell').addEventListener('click', async () => {
  if (ringing || busy) return;
  ringing = true;
  void ringBell();
  $('bell').classList.remove('ringing');
  void $('bell').offsetWidth;
  $('bell').classList.add('ringing');
  const bell = $('bell').getBoundingClientRect();
  const board = card.getBoundingClientRect();
  effects.spark((bell.left + bell.width / 2 - board.left) / board.width, (bell.top + bell.height / 2 - board.top) / board.height);
  try {
    if (state.unlocked) {
      const closing = [...doors].filter(([day, entry]) => day > state.available && entry.door.classList.contains('open'));
      for (const [, { door, image }] of closing) {
        hideDoorTooltip(image);
        door.classList.add('closing');
        door.classList.remove('open');
      }
      promoteEarlyDoors();
      early.clear();
      token = '';
      state.unlocked = false;
      save(session, key + 'early', []);
      save(session, key + 'bell', '');
      feedback = 'relocked';
      render();
      await Promise.all(closing.map(([, { flap }]) => waitForFlap(flap)));
      for (const [, { door }] of closing) door.classList.remove('closing');
      render();
    } else {
      const response = await fetch('/api/bell', { method: 'POST' });
      if (!response.ok) throw new Error('Bell unavailable');
      token = (await response.json()).token;
      save(session, key + 'bell', token);
      state.unlocked = true;
      feedback = 'found';
      render();
    }
  } catch {
    feedback = 'error';
    render();
  } finally {
    ringing = false;
  }
});
$('light').addEventListener('change', event => {
  light = event.currentTarget.value;
  cycleElapsed = 0;
  cycleResumedAt = null;
  syncDaylightCycle();
  save(local, key + 'light', light);
  updateOption('night', lightOptions.get(light));
});
const startRequestedMusic = event => {
  if (!musicOn || !event.isTrusted || event.key === 'Escape' || event.target.closest?.('#music')) return;
  void music.resume().then(playing => {
    if (playing) removeMusicStartListeners();
  });
};
function removeMusicStartListeners() {
  document.removeEventListener('click', startRequestedMusic, true);
  document.removeEventListener('keydown', startRequestedMusic, true);
}
$('music').addEventListener('click', () => {
  removeMusicStartListeners();
  if (feedback === 'radioError') feedback = '';
  musicOn = !musicOn;
  if (musicOn) void music.resume();
  else music.suspend();
  updateOption('music', musicOn ? 'on' : 'off');
  render();
});
$('lang').addEventListener('click', () => {
  hideDoorTooltip();
  language = language === 'sv' ? 'en' : 'sv';
  save(local, key + 'language', language);
  updateOption('language', language);
  render();
  if (active) {
    stopClip();
    void presentation(active.project, active.day);
  }
});
async function shareCalendar() {
  const dialog = $('share-dialog');
  if (sharing || dialog.open) return;
  const url = new URL('https://x-mas.voltura.se/');
  url.search = new URLSearchParams({
    language,
    night: lightOptions.get(light),
    music: musicOn ? 'on' : 'off',
  });
  const title = document.title;
  const data = { title, url: url.href };
  sharing = true;
  try {
    if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
  } finally {
    sharing = false;
  }
  $('share-link').value = url.href;
  $('share-email').href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url.href);
  $('share-result').textContent = '';
  dialog.showModal();
}
$('share-header').addEventListener('click', () => void shareCalendar());
$('share-footer').addEventListener('click', () => void shareCalendar());
$('share-copy').addEventListener('click', async () => {
  const input = $('share-link');
  try {
    await navigator.clipboard.writeText(input.value);
    $('share-result').textContent = t().copied;
  } catch {
    input.focus();
    input.select();
    $('share-result').textContent = t().copyHelp;
  }
});
$('close').addEventListener('click', () => reveal.close());
reveal.addEventListener('close', () => {
  presentationRequest?.abort();
  presentationRequest = null;
  stopClip();
  const closing = active;
  active = null;
  $('reveal-media').replaceChildren();
  if (closing) {
    const opener = closing.opener.hidden ? doors.get(closing.day).button : closing.opener;
    opener.focus({ preventScroll: true });
  }
});
addEventListener('visibilitychange', () => {
  if (light === 'cycle') syncDaylightCycle();
  if (!document.hidden) void refresh();
});
addEventListener('storage', event => {
  if (!event.key?.startsWith(key + 'opened-')) return;
  syncOpenedDoors();
  render();
  void refresh();
});
addEventListener('scroll', () => hideDoorTooltip(), { passive: true });
addEventListener('resize', () => hideDoorTooltip());
document.addEventListener('pointerdown', event => {
  if (tooltipAnchor && !tooltipAnchor.contains(event.target)) hideDoorTooltip();
}, true);
addEventListener('keydown', event => {
  if (event.key === 'Escape') hideDoorTooltip();
});
setupDoors();
scheduleTomte($('tomte'));
syncOpenedDoors();
syncDaylightCycle();
render();
if (musicOn) {
  document.addEventListener('click', startRequestedMusic, true);
  document.addEventListener('keydown', startRequestedMusic, true);
  void music.resume();
}
void refresh();
setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
