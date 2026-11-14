import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, createHandler } from '../dist/server/index.js';

const origin = 'https://x-mas.voltura.se';
const env = { CALENDAR_SIGNING_KEY: 'calendar-test-fixture' };
const at = iso => new Date(iso).getTime();

test('share crawlers receive localized metadata and a public card', async () => {
  const handler = createHandler();
  for (const [language, title] of [['sv', 'Voltura Julkalender'], ['en', 'Voltura Christmas Calendar']]) {
    const url = origin + '/?language=' + language + '&night=off&music=on';
    const html = await (await handler(new Request(url), env)).text();
    assert(html.includes('<html lang="' + language + '"'));
    assert(html.includes('<h1 id="title">' + title.slice('Voltura '.length) + '</h1>'));
    assert(html.includes('<meta property="og:title" content="' + title + '">'));
    const card = origin + '/assets/social-' + language + '.jpg';
    assert(html.includes('<meta property="og:image" content="' + card + '">'));
    assert(html.includes('<meta name="twitter:image" content="' + card + '">'));
    const image = await handler(new Request(card, { method: 'HEAD' }), env);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('Content-Type'), 'image/jpeg');
  }
  const icon = await handler(new Request(origin + '/favicon.ico'), env);
  assert.equal(icon.status, 200);
  assert.equal(icon.headers.get('Content-Type'), 'image/x-icon');
});

test('availability follows Stockholm midnight through Christmas Eve', () => {
  const available = iso => calendarDate(at(iso)).available;
  assert.equal(available('2026-11-30T22:59:59Z'), 0);
  assert.equal(available('2026-11-30T23:00:00Z'), 1);
  assert.equal(available('2026-12-12T23:00:00Z'), 13);
  assert.equal(available('2026-12-23T22:59:59Z'), 23);
  assert.equal(available('2026-12-23T23:00:00Z'), 24);
  assert.equal(available('2027-01-01T00:00:00Z'), 24);
});

test('the bell unlocks all projects for its signed, expiring session', async () => {
  let clock = at('2026-11-14T14:00:00Z');
  const handler = createHandler(() => clock);
  const fetch = (route, init) => handler(new Request(origin + route, init), env);
  assert.equal((await fetch('/api/door/24')).status, 403);
  assert.equal((await fetch('/reveal/24.webp')).status, 403);
  assert.equal((await fetch('/assets/worlds.webp')).status, 404);
  assert.equal((await fetch('/api/bell', { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
  const bell = await fetch('/api/bell', { method: 'POST', headers: { Origin: origin } });
  assert.equal(bell.status, 200);
  const { token } = await bell.json();
  const headers = { Authorization: 'Bearer ' + token };
  for (let day = 1; day <= 24; day++) {
    const door = await fetch('/api/door/' + day, { headers });
    assert.equal(door.status, 200);
    assert.match(door.headers.get('Cache-Control'), /no-store/);
    const project = await door.json();
    assert(Number.isInteger(project.started));
    if (day === 8 || day === 15) assert.equal(project.started, 2021);
    if (day === 10) assert.equal(project.started, 2022);
    const artwork = await fetch(project.image, { headers });
    assert.equal(artwork.status, 200);
    assert.equal(artwork.headers.get('Content-Type'), 'image/webp');
  }
  assert.equal((await fetch('/api/door/24', { headers: { Authorization: 'Bearer ' + token.replace(/.$/, 'A') } })).status, 403);
  assert.equal((await fetch('/api/door/24')).status, 403);
  clock += 12 * 60 * 60 * 1000;
  assert.equal((await fetch('/api/door/24', { headers })).status, 403);
});
