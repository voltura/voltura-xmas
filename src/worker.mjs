const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
});
const premiere = '2026-12-01';
const finale = '2026-12-24';
const encoder = new TextEncoder();
const tokenLifetime = 12 * 60 * 60 * 1000;
const canonicalSite = 'https://x-mas.voltura.se/';
const sharePreviews = {
  sv: {
    title: 'Voltura Julkalender',
    heading: 'Julkalender',
    description: 'Öppna en ny lucka varje dag fram till julafton. Bakom varje lucka finns ett Voltura-projekt.',
    locale: 'sv_SE',
    imageAlt: 'Voltura Julkalender med ett rött hus, snö och en upplyst julgran.',
  },
  en: {
    title: 'Voltura Christmas Calendar',
    heading: 'Christmas Calendar',
    description: 'Open a new door every day through Christmas Eve and discover a different Voltura project.',
    locale: 'en_GB',
    imageAlt: 'Voltura Christmas Calendar with a red Swedish cottage, snow, and a lit Christmas tree.',
  },
};
const types = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  jpg: 'image/jpeg', png: 'image/png', ico: 'image/x-icon', webp: 'image/webp', woff2: 'font/woff2', svg: 'image/svg+xml', mp4: 'video/mp4',
};
const json = (data, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});

export function calendarDate(now) {
  const date = dateFormat.format(now);
  const available = date < premiere ? 0 : date >= finale ? 24 : Number(date.slice(8));
  const remaining = Math.max(0, Math.round((Date.parse(finale) - Date.parse(date)) / 86_400_000));
  return { date, available, remaining, note: calendar[available - 1]?.note };
}

function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function unlockToken(secret, now) {
  const payload = (now + tokenLifetime) + '.' + crypto.randomUUID();
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(payload));
  return payload + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function validToken(secret, header, now) {
  const token = /^Bearer ((\d{13})\.[0-9a-f-]{36})\.([A-Za-z0-9+/]{43}=)$/.exec(header ?? '');
  if (!secret || !token || Number(token[2]) <= now) return false;
  const signature = Uint8Array.from(atob(token[3]), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', await signingKey(secret), signature, encoder.encode(token[1]));
}

export function createHandler(clock = Date.now) {
  return async (request, env) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = clock();
    if (path === '/api/calendar') {
      const { date, available, remaining, note } = calendarDate(now);
      const unlocked = await validToken(env.CALENDAR_SIGNING_KEY, request.headers.get('Authorization'), now);
      return json({ date, available, remaining, note, unlocked });
    }
    if (path === '/api/bell') {
      if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) {
        return json({ error: 'forbidden' }, 403);
      }
      if (!env.CALENDAR_SIGNING_KEY) return json({ error: 'unavailable' }, 503);
      return json({ token: await unlockToken(env.CALENDAR_SIGNING_KEY, now) });
    }
    const door = /^\/api\/door\/(\d{1,2})$/.exec(path);
    const media = /^\/reveal\/(\d{1,2})\.(webp|mp4)$/.exec(path);
    if (door || media) {
      const day = Number((door ?? media)[1]);
      const project = calendar[day - 1];
      if (!project) return json({ error: 'not-found' }, 404);
      const unlocked = day <= calendarDate(now).available ||
        await validToken(env.CALENDAR_SIGNING_KEY, request.headers.get('Authorization'), now);
      if (!unlocked) return json({ error: 'locked' }, 403);
      if (media?.[2] === 'webp') return asset('/assets/' + project.image + '.webp', true);
      if (media?.[2] === 'mp4') {
        return day === 24 ? asset('/assets/christmas.mp4', true) : json({ error: 'not-found' }, 404);
      }
      const { image, ...details } = project;
      return json({ ...details, image: '/reveal/' + day + '.webp' });
    }
    if (path.startsWith('/api/') || /^\/assets\/.*\.(?:webp|mp4)$/.test(path)) {
      return json({ error: 'not-found' }, 404);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method' }, 405);
    const head = request.method === 'HEAD';
    if (path === '/' || path === '/index.html') return calendarPage(url.searchParams.get('language'), head);
    return asset(path === '/favicon.ico' ? '/assets/favicon.ico' : path, false, head);
  };
}

function calendarPage(requestedLanguage, head) {
  const language = requestedLanguage === 'en' ? 'en' : 'sv';
  const { title, heading, description, locale, imageAlt } = sharePreviews[language];
  const canonical = language === 'en' ? canonicalSite + '?language=en' : canonicalSite;
  const image = canonicalSite + 'assets/social-' + language + '.jpg';
  const html = new TextDecoder().decode(Uint8Array.from(atob(files['/index.html']), c => c.charCodeAt(0)))
    .replace('<html lang="sv"', '<html lang="' + language + '"')
    .replace(/<title>.*?<\/title>/, '<title>' + title + '</title>')
    .replace('<h1 id="title">Julkalender</h1>', '<h1 id="title">' + heading + '</h1>')
    .replace(/(<meta name="description" content=")[^"]*"/, '$1' + description + '"')
    .replace('<!-- social-preview -->', `
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="sv" href="${canonicalSite}?language=sv">
  <link rel="alternate" hreflang="en" href="${canonicalSite}?language=en">
  <link rel="alternate" hreflang="x-default" href="${canonicalSite}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Voltura">
  <meta property="og:locale" content="${locale}">
  <meta property="og:locale:alternate" content="${language === 'en' ? 'sv_SE' : 'en_GB'}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${imageAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${imageAlt}">`);
  return new Response(head ? null : html, { headers: {
    'Content-Type': types.html,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  } });
}

function asset(path, privateAsset, head = false) {
  if (!Object.hasOwn(files, path)) return json({ error: 'not-found' }, 404);
  const type = types[path.split('.').at(-1)] ?? 'application/octet-stream';
  const blob = head ? null : Uint8Array.from(atob(files[path]), c => c.charCodeAt(0));
  const headers = {
    'Content-Type': type,
    'Cache-Control': privateAsset ? 'private, no-store' : path.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  return new Response(blob, { headers });
}

export default { fetch: createHandler() };
