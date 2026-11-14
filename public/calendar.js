import { weather, musicBox, ringBell, scheduleTomte } from '/effects.js';

const $ = id => document.getElementById(id);
const text = {
  sv: {
    title: 'Julkalender', month: 'december', night: 'Natt', day: 'Dag', music: 'Musik', off: 'Musik av',
    countdown: n => n === 0 ? 'God jul!' : n === 1 ? '1 dag kvar till julafton' : n + ' dagar kvar till julafton',
    door: n => 'Lucka ' + n, locked: n => 'Öppnas ' + n + ' december', ready: 'Redo att öppnas', shut: n => 'Stäng lucka ' + n,
    bell: 'Julbjällra', found: 'Du hittade den hemliga julbjällran! Nu kan du öppna alla 24 luckor.',
    relocked: 'Kommande luckor är stängda och låsta igen.',
    error: 'Det gick inte att öppna just nu. Försök igen.', close: 'Stäng', skip: 'Hoppa över',
    visit: 'Besök projektet', started: 'Startat', settings: 'Inställningar', switchLanguage: 'Switch to English', merry: 'God jul!',
    before: 'Första luckan öppnas den 1 december.',
    share: 'Dela julkalendern', shareLink: 'Länk till julkalendern', copy: 'Kopiera länk',
    copied: 'Länken kopierades.', copyHelp: 'Markera och kopiera länken ovan.', email: 'E-post',
  },
  en: {
    title: 'Christmas Calendar', month: 'December', night: 'Night', day: 'Day', music: 'Music', off: 'Music off',
    countdown: n => n === 0 ? 'Merry Christmas!' : n === 1 ? '1 day until Christmas Eve' : n + ' days until Christmas Eve',
    door: n => 'Door ' + n, locked: n => 'Opens December ' + n, ready: 'Ready to open', shut: n => 'Close door ' + n,
    bell: 'Christmas bell', found: 'You found the hidden Christmas bell! All 24 doors are now yours to open.',
    relocked: 'Future doors are closed and locked again.',
    error: 'That could not be opened right now. Try again.', close: 'Close', skip: 'Skip',
    visit: 'Visit project', started: 'Started', settings: 'Settings', switchLanguage: 'Byt till svenska', merry: 'Merry Christmas!',
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
const doors = new Map();
const projectImages = new Map();
const card = $('picture');
const reveal = $('reveal');
const doorTooltip = $('door-tooltip');
const effects = weather($('weather'), $('background-snow'), card.closest('.calendar'));
const music = musicBox();
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
let light = requestedNight === 'on' ? 'night' : requestedNight === 'off' ? 'day' :
  read(local, key + 'light', 'night') === 'day' ? 'day' : 'night';
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
let lastDoor = null;
let tooltipAnchor = null;
let touchPreview = null;
let sharing = false;
const t = () => text[language];
const isAvailable = day => day <= state.available || state.unlocked;
const isOpen = day => isAvailable(day) && (opened.has(day) || early.has(day));
const auth = () => token ? { Authorization: 'Bearer ' + token } : {};
const dateLabel = day => language === 'sv' ? day + ' december' : 'December ' + day;
const urlFor = project => project.urlByLanguage?.[language] ?? project.url;

function updateOption(option, value) {
  const url = new URL(location.href);
  url.searchParams.set(option, value);
  history.replaceState(history.state, '', url);
}

function padlock(open) {
  return '<svg class="padlock" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="2"/><path d="' +
    (open ? 'M9 9V6.4a3.7 3.7 0 017.2-1.2' : 'M6.5 9V6a3.5 3.5 0 017 0v3') + '"/></svg>';
}

function hideDoorTooltip(anchor = tooltipAnchor) {
  if (!anchor || anchor !== tooltipAnchor) return;
  anchor.removeAttribute('aria-describedby');
  if (touchPreview === anchor) touchPreview = null;
  tooltipAnchor = null;
  doorTooltip.hidden = true;
}

function showDoorTooltip(anchor, project) {
  if (!project || anchor.hidden || reveal.open) return;
  hideDoorTooltip();
  const target = anchor.getBoundingClientRect();
  doorTooltip.textContent = project.title;
  doorTooltip.hidden = false;
  const { width, height } = doorTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(target.left + (target.width - width) / 2, document.documentElement.clientWidth - width - 8));
  const top = target.top >= height + 12 ? target.top - height - 7 : target.bottom + 7;
  doorTooltip.style.left = left + 'px';
  doorTooltip.style.top = top + 'px';
  tooltipAnchor = anchor;
  anchor.setAttribute('aria-describedby', doorTooltip.id);
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
    const image = document.createElement('a');
    image.className = 'door-image';
    image.target = '_blank';
    image.rel = 'noopener';
    image.hidden = true;
    image.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') showDoorTooltip(image, projectImages.get(day));
    });
    image.addEventListener('pointerleave', () => {
      if (document.activeElement !== image) hideDoorTooltip(image);
    });
    let touched = false;
    image.addEventListener('pointerdown', event => {
      touched = event.pointerType === 'touch';
    });
    image.addEventListener('focus', () => {
      if (!touched) showDoorTooltip(image, projectImages.get(day));
    });
    image.addEventListener('blur', () => hideDoorTooltip(image));
    image.addEventListener('click', event => {
      if (touched && event.detail !== 0 && touchPreview !== image) {
        event.preventDefault();
        showDoorTooltip(image, projectImages.get(day));
        touchPreview = image;
      } else {
        hideDoorTooltip(image);
      }
      touched = false;
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'door-button';
    const flap = document.createElement('span');
    flap.className = 'flap';
    button.append(flap);
    button.addEventListener('click', () => {
      if (isOpen(day)) void closeDoor(day);
      else void openDoor(day);
    });
    door.append(image, button);
    $('doors').append(door);
    doors.set(day, { door, button, flap, image });
  });
}

function render() {
  const word = t();
  document.documentElement.lang = language;
  document.documentElement.dataset.light = light;
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
  $('light').setAttribute('aria-pressed', String(light === 'day'));
  $('light').firstElementChild.textContent = light === 'day' ? '☀' : '☾';
  $('light-label').textContent = light === 'day' ? word.day : word.night;
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
  $('feedback').textContent = typeof feedback === 'number' ? word.locked(feedback) : word[feedback] ?? '';
  for (const [day, { door, button, flap, image }] of doors) {
    const available = isAvailable(day);
    const project = projectImages.get(day);
    const visible = isOpen(day) && project;
    door.classList.toggle('available', available);
    if (!door.classList.contains('closing')) door.classList.toggle('open', Boolean(visible));
    button.setAttribute('aria-label', visible ? word.shut(day) : word.door(day) + ', ' + (available ? word.ready : word.locked(day)));
    if (flap.dataset.status !== String(available)) {
      flap.dataset.status = String(available);
      flap.innerHTML = '<span>' + day + '</span>' + padlock(available);
    }
    if (!door.classList.contains('closing')) {
      image.hidden = !visible;
      if (image.hidden) hideDoorTooltip(image);
    }
    if (visible) {
      image.href = urlFor(project);
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
  $('reveal-start-label').textContent = word.started + ' ';
  $('reveal-start-year').dateTime = project.started.toString();
  $('reveal-start-year').textContent = project.started;
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
    $('reveal-description').hidden = false;
    $('project-link').hidden = false;
  };
  if (!project.video) {
    promo();
    return;
  }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = project.thumbnail;
  let videoUrl = project.video;
  if (videoUrl.startsWith('/')) {
    media.replaceChildren(image);
    $('reveal-description').hidden = false;
    $('project-link').hidden = false;
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
  const skip = document.createElement('button');
  skip.className = 'skip';
  skip.type = 'button';
  skip.textContent = word.skip;
  skip.addEventListener('click', promo);
  video.addEventListener('error', promo, { once: true });
  video.addEventListener('ended', promo, { once: true });
  video.addEventListener('timeupdate', () => { if (video.currentTime >= 8) promo(); });
  $('reveal-description').hidden = true;
  $('project-link').hidden = true;
  media.replaceChildren(video, skip);
  music.suspend();
  const timeout = setTimeout(promo, 11_000);
  stopClip = () => {
    clearTimeout(timeout);
    video.pause();
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    if (musicOn) void music.resume();
    stopClip = () => {};
  };
  video.play().catch(() => { if (video.isConnected) promo(); });
}

async function waitForFlap(flap) {
  // Flush styles so the transition is present before reading its completion.
  void getComputedStyle(flap).transform;
  await Promise.allSettled(flap.getAnimations().map(animation => animation.finished));
}

async function closeDoor(day) {
  if (busy || ringing || !isOpen(day)) return;
  busy = true;
  const { door, flap, button, image } = doors.get(day);
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

async function openDoor(day) {
  if (busy || ringing || isOpen(day)) return;
  if (!isAvailable(day)) {
    feedback = day;
    render();
    return;
  }
  busy = true;
  try {
    const project = await loadProject(day);
    const normal = day <= state.available;
    if (normal) setOpened(day, true);
    else {
      early.add(day);
      save(session, key + 'early', [...early]);
    }
    feedback = '';
    render();
    const { flap, image } = doors.get(day);
    lastDoor = image;
    await waitForFlap(flap);
    if (day === 24) effects.fireworks();
    if (day === 24) await new Promise(resolve => setTimeout(resolve, 1000));
    active = { project, day };
    const target = lastDoor.getBoundingClientRect();
    hideDoorTooltip();
    reveal.showModal();
    const box = reveal.getBoundingClientRect();
    reveal.animate([
      { opacity: .2, transform: 'translate(' + (target.left + target.width / 2 - box.left - box.width / 2) + 'px,' +
        (target.top + target.height / 2 - box.top - box.height / 2) + 'px) scale(.12)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 420, easing: 'cubic-bezier(.2,.75,.3,1)' });
    void presentation(project, day);
    $('close').focus();
  } catch {
    feedback = 'error';
    render();
  } finally {
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
$('light').addEventListener('click', () => {
  light = light === 'day' ? 'night' : 'day';
  save(local, key + 'light', light);
  updateOption('night', light === 'night' ? 'on' : 'off');
  render();
});
const startRequestedMusic = event => {
  if (!musicOn || event.target.closest?.('#music')) return;
  removeMusicStartListeners();
  void music.resume();
};
function removeMusicStartListeners() {
  document.removeEventListener('click', startRequestedMusic, true);
  document.removeEventListener('keydown', startRequestedMusic, true);
}
$('music').addEventListener('click', () => {
  removeMusicStartListeners();
  musicOn = !musicOn;
  if (musicOn) void music.resume();
  else music.suspend();
  updateOption('music', musicOn ? 'on' : 'off');
  render();
});
$('lang').addEventListener('click', () => {
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
    night: light === 'night' ? 'on' : 'off',
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
  active = null;
  $('reveal-media').replaceChildren();
  lastDoor?.focus();
});
addEventListener('visibilitychange', () => {
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
addEventListener('keydown', event => {
  if (event.key === 'Escape') hideDoorTooltip();
});
setupDoors();
scheduleTomte($('tomte'));
syncOpenedDoors();
render();
if (musicOn) {
  document.addEventListener('click', startRequestedMusic, true);
  document.addEventListener('keydown', startRequestedMusic, true);
  void music.resume();
}
void refresh();
setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
