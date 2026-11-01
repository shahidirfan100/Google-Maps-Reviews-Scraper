import { Impit } from 'impit';

const GOOGLE_HOST_FALLBACKS = ['www.google.com', 'www.google.co.uk', 'www.google.ca', 'www.google.com.hk'];

const SEARCH_PB =
    '!1s{query}!7i20!10b1!12m6!1m1!18b1!2m1!20e3!6m1!114b1!17m1!3e1!20m57!2m2!1i203!2i100!3m2!2i4!5b1' +
    '!6m6!1m2!1i86!2i86!1m2!1i408!2i240!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3' +
    '!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e4!1m3!1e9!2b1!3e2!2b1!9b0' +
    '!15m8!1m7!1m2!1m1!1e2!2m2!1i195!2i195!3i20';

const BROWSER_HEADERS = {
    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'accept-language': 'en-US,en;q=0.9',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export function isGoogleHost(hostname) {
    return /(^|\.)google\.[a-z.]+$/i.test(hostname) || hostname === 'maps.google.com';
}

export function pickHost(inputUrl) {
    try {
        const host = new URL(inputUrl).hostname.toLowerCase();
        if (isGoogleHost(host)) return host;
    } catch {
        /* not a URL */
    }
    return 'www.google.com';
}

export function createHttpClient(proxyUrl, headers = {}) {
    return new Impit({
        browser: 'chrome',
        ignoreTlsErrors: true,
        ...(proxyUrl ? { proxyUrl } : {}),
        headers: { ...BROWSER_HEADERS, ...headers },
    });
}

export async function fetchText(client, url, { timeoutMs = 30000 } = {}) {
    const response = await client.fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: response.status, url: response.url || url, body: await response.text() };
}

export async function fetchWithFallback(url, proxyUrl, options = {}) {
    const preferred = pickHost(url);
    const hosts = [preferred, ...GOOGLE_HOST_FALLBACKS.filter((host) => host !== preferred)];
    let lastError;

    for (const host of hosts) {
        const candidate = url.replace(/^https?:\/\/[^/]+/i, `https://${host}`);
        const client = createHttpClient(proxyUrl);
        try {
            const result = await fetchText(client, candidate, options);
            if (!isGoogleHost(new URL(result.url).hostname)) result.url = candidate;
            return result;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`Could not fetch ${url}`);
}

export function normalizeTarget(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;

    const featureId = value.match(/0x[0-9a-f]+:(?:0x)?[0-9a-f]+/i);
    if (featureId) return { kind: 'feature', value: featureId[0] };

    if (/^ChI[A-Za-z0-9_-]{10,}$/.test(value)) return { kind: 'placeId', value };

    if (value.startsWith('http://') || value.startsWith('https://')) return { kind: 'url', value };

    return { kind: 'query', value };
}

export function featureIdToCid(featureId) {
    const low = featureId.split(':')[1].replace(/^0x/i, '');
    return BigInt(`0x${low}`).toString(10);
}

export function extractFeatureId(text) {
    const match = String(text || '').match(/0x[0-9a-f]+:(?:0x)?[0-9a-f]+/i);
    if (!match) return null;
    const [high, low] = match[0].split(':');
    return `${high.toLowerCase()}:${low.toLowerCase().startsWith('0x') ? low.toLowerCase() : `0x${low.toLowerCase()}`}`;
}

export function extractPlaceName(url) {
    try {
        const parsed = new URL(url);
        const marker = parsed.pathname.match(/\/maps\/place\/([^/@]+)/);
        if (!marker) return null;
        return decodeURIComponent(marker[1].replace(/\+/g, ' ')).trim() || null;
    } catch {
        return null;
    }
}

export function titleFromHtml(html) {
    const match = String(html || '').match(/<title>([^<]+)<\/title>/i);
    if (!match) return null;
    const title = match[1].replace(/\s*-\s*Google Maps\s*$/i, '').trim();
    if (!title || /^google maps$/i.test(title)) return null;
    return title;
}

function metadataFromNode(node) {
    if (!Array.isArray(node)) return null;
    const website = node?.[7]?.[0];
    const phone = node?.[178]?.[0]?.[0];
    const address = node?.[39];
    const category = node?.[13]?.[0];

    return {
        featureId: node?.[10] || null,
        placeId: node?.[78] || null,
        name: node?.[11] || null,
        rating: node?.[4]?.[7] ?? null,
        reviewsCount: node?.[4]?.[8] ?? null,
        address: typeof address === 'string' ? address : null,
        category: typeof category === 'string' ? category : null,
        website: typeof website === 'string' ? website : null,
        phone: typeof phone === 'string' ? phone : null,
        latitude: node?.[9]?.[2] ?? null,
        longitude: node?.[9]?.[3] ?? null,
    };
}

export async function searchPlaceInfo(query, { proxyUrl, hl = 'en', gl = 'us' } = {}) {
    if (!query) return null;
    const pb = SEARCH_PB.replace('{query}', encodeURIComponent(query));
    const url = `https://www.google.com/search?tbm=map&authuser=0&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}&pb=${encodeURIComponent(pb)}`;

    let result;
    try {
        result = await fetchWithFallback(url, proxyUrl, { timeoutMs: 30000 });
    } catch {
        return null;
    }

    const body = result.body.replace(/^\)\]\}'\s*/, '');
    let data;
    try {
        data = JSON.parse(body);
    } catch {
        return null;
    }

    const candidates = [];
    if (Array.isArray(data?.[64])) {
        for (const entry of data[64]) if (Array.isArray(entry?.[1])) candidates.push(entry[1]);
    }
    if (Array.isArray(data?.[0]?.[1]?.[0]?.[14])) candidates.push(data[0][1][0][14]);

    const infos = candidates.map(metadataFromNode).filter((info) => info && info.featureId);
    return infos.length ? infos : null;
}

async function resolveFromPage(url, proxyUrl) {
    const result = await fetchWithFallback(url, proxyUrl, { timeoutMs: 30000 });
    return {
        featureId: extractFeatureId(result.url) || extractFeatureId(result.body),
        finalUrl: result.url,
        body: result.body,
    };
}

export async function resolvePlace(target, { proxyUrl, hl = 'en', gl = 'us' } = {}) {
    const normalized = normalizeTarget(target);
    if (!normalized) throw new Error('Provide a Google Maps place URL, place ID, or feature ID.');

    let featureId = null;
    let placeId = null;
    let placeUrl = null;
    let query = null;

    if (normalized.kind === 'feature') {
        featureId = extractFeatureId(normalized.value);
    } else if (normalized.kind === 'placeId') {
        placeId = normalized.value;
        const resolved = await resolveFromPage(
            `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=${hl}`,
            proxyUrl,
        );
        featureId = resolved.featureId;
        placeUrl = resolved.finalUrl;
        query = titleFromHtml(resolved.body);
    } else if (normalized.kind === 'url') {
        placeUrl = normalized.value;
        const directFeatureId = extractFeatureId(normalized.value);
        const placeIdMatch = normalized.value.match(/place_id:(ChI[A-Za-z0-9_-]+)/);
        if (placeIdMatch) placeId = placeIdMatch[1];
        query = extractPlaceName(normalized.value);

        if (directFeatureId) {
            featureId = directFeatureId;
        } else {
            const cidMatch = normalized.value.match(/[?&]cid=(\d+)/);
            if (cidMatch) {
                featureId = `0x0:0x${BigInt(cidMatch[1]).toString(16)}`;
            }
            const resolved = await resolveFromPage(normalized.value, proxyUrl);
            featureId = resolved.featureId || featureId;
            placeUrl = resolved.finalUrl || normalized.value;
            query = query || titleFromHtml(resolved.body);
        }
    } else {
        query = normalized.value;
    }

    if (!query && placeUrl) {
        query = extractPlaceName(placeUrl);
    }

    if (!featureId && (placeId || query)) {
        const infos = await searchPlaceInfo(query, { proxyUrl, hl, gl });
        if (infos?.length) {
            const match = placeId ? infos.find((info) => info.placeId === placeId) : infos[0];
            if (match?.featureId) featureId = match.featureId;
        }
    }

    if (!featureId && placeUrl) {
        const resolved = await resolveFromPage(placeUrl, proxyUrl);
        featureId = resolved.featureId;
        placeUrl = resolved.finalUrl || placeUrl;
        query = query || titleFromHtml(resolved.body);
    }

    if (!featureId) {
        throw new Error('Could not resolve this input to a Google Maps place. Provide a full place URL or place ID.');
    }

    const cid = featureIdToCid(featureId);
    const lookups = [query, extractPlaceName(placeUrl)].filter(Boolean);

    let info = null;
    for (const lookup of lookups) {
        const placeInfoList = await searchPlaceInfo(lookup, { proxyUrl, hl, gl });
        if (!placeInfoList?.length) continue;
        if (placeId) {
            info = placeInfoList.find((item) => item.placeId === placeId || item.featureId === featureId) || null;
        } else {
            info = placeInfoList.find((item) => item.featureId === featureId) || null;
            if (!info && placeInfoList.length === 1) info = placeInfoList[0];
        }
        if (info) break;
    }

    if (!info && placeId) info = { featureId, placeId };
    if (!info) info = { featureId };
    if (!info.featureId) info.featureId = featureId;
    if (placeId) info.placeId = placeId;

    return {
        ...info,
        featureId,
        cid,
        placeUrl: placeUrl || `https://www.google.com/maps?cid=${cid}&hl=${hl}`,
        query: extractPlaceName(placeUrl) || info.name || null,
    };
}
