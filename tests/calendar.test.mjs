import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, createHandler } from '../dist/server/index.js';

const origin = 'https://x-mas.voltura.se';
const env = { CALENDAR_SIGNING_KEY: 'calendar-test-fixture' };
const at = iso => new Date(iso).getTime();

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
    const artwork = await fetch(project.image, { headers });
    assert.equal(artwork.status, 200);
    assert.equal(artwork.headers.get('Content-Type'), 'image/webp');
  }
  assert.equal((await fetch('/api/door/24', { headers: { Authorization: 'Bearer ' + token.replace(/.$/, 'A') } })).status, 403);
  assert.equal((await fetch('/api/door/24')).status, 403);
  clock += 12 * 60 * 60 * 1000;
  assert.equal((await fetch('/api/door/24', { headers })).status, 403);
});
