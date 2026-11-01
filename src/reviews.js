import { firefox } from 'playwright';

const SORT_LABELS = {
    most_relevant: /most relevant|relevance|relevant/i,
    newest: /newest|most recent|latest/i,
    highest_rating: /highest rating|highest/i,
    lowest_rating: /lowest rating|lowest/i,
};

const RESOURCE_BLOCKLIST = new Set(['image', 'media', 'font']);

function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toText(value) {
    if (typeof value !== 'string') return null;
    const cleaned = value
        .replace(/[\u200b\u202f]/g, ' ')
        .replace(/\u00a0/g, ' ')
        .trim();
    return cleaned || null;
}

function toLabel(value) {
    const text = toText(value);
    if (!text) return null;
    return (
        text
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\s+/g, ' ')
            .trim() || null
    );
}

function microsToIso(value) {
    const micros = toNumber(value);
    if (!micros) return null;
    return new Date(Math.round(micros / 1000)).toISOString();
}

function parseJsonResponse(text) {
    if (!text) return null;
    const cleaned = text.replace(/^\)\]\}'\s*/, '');
    try {
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

export function parseBatchexecuteResponse(text) {
    const cleaned = String(text || '').replace(/^\)\]\}'\s*/, '');
    for (const line of cleaned.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('[')) continue;
        let entries;
        try {
            entries = JSON.parse(trimmed);
        } catch {
            continue;
        }
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
            if (Array.isArray(entry) && entry[0] === 'wrb.fr' && typeof entry[2] === 'string') {
                try {
                    return JSON.parse(entry[2]);
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

function extractPhotos(review) {
    const photos = review?.[2]?.[2];
    if (!Array.isArray(photos)) return null;
    const result = [];
    for (const photo of photos) {
        const url = photo?.[1]?.[6]?.[0];
        if (typeof url !== 'string' || !url.includes('googleusercontent')) continue;
        const caption = toLabel(photo?.[1]?.[21]?.[3]?.[5]?.[0]);
        result.push({
            url,
            ...(caption ? { caption } : {}),
        });
    }
    return result.length ? result : null;
}

function extractContext(review) {
    const rows = review?.[2]?.[6];
    if (!Array.isArray(rows)) return null;
    const context = {};
    for (const row of rows) {
        const label = toLabel(row?.[5]) || toLabel(row?.[1]);
        if (!label) continue;
        const answer = row?.[2]?.[0]?.[0];
        let value = Array.isArray(answer) ? toLabel(answer[1] ?? answer[0]) : null;
        if (!value) {
            const score = row?.[11]?.[0] ?? row?.[10]?.[0];
            if (typeof score === 'number' && score > 0) value = `${score}/5`;
        }
        if (value) context[label] = value;
    }
    return Object.keys(context).length ? context : null;
}

export function mapReview(review, place) {
    if (!Array.isArray(review)) return null;
    const reviewId = toText(review[0]);
    if (!reviewId) return null;

    const rating = toNumber(review?.[2]?.[0]?.[0]);
    if (!rating) return null;

    const author = review?.[1]?.[4]?.[5];
    const badge = toLabel(author?.[10]?.[0]);
    const publishedAt = microsToIso(review?.[1]?.[2]);
    const editedAt = microsToIso(review?.[1]?.[3]);
    const ownerReply = review?.[3]?.[14]?.[0];

    const item = {
        review_id: reviewId,
        rating,
        ...(place.placeId ? { place_id: place.placeId } : {}),
        ...(place.name ? { place_name: place.name } : {}),
        ...(place.url ? { place_url: place.url } : {}),
    };

    const text = toText(review?.[2]?.[15]?.[0]?.[0]);
    if (text) item.review_text = text;
    const language = toText(review?.[2]?.[14]?.[0]);
    if (language) item.review_language = language;

    const relativeDate = toText(review?.[1]?.[6]);
    if (relativeDate) item.relative_date = relativeDate;
    if (publishedAt) item.published_at = publishedAt;
    if (editedAt && editedAt !== publishedAt) item.edited_at = editedAt;

    const authorName = toText(author?.[0]);
    if (authorName) item.author_name = authorName;
    const authorId = toText(author?.[3]);
    if (authorId) item.author_id = authorId;
    const authorUrl = toText(author?.[2]?.[0]);
    if (authorUrl) item.author_url = authorUrl;
    const authorAvatar = toText(author?.[1]);
    if (authorAvatar) item.author_avatar = authorAvatar;
    const authorReviews = toNumber(author?.[5]);
    if (authorReviews !== null) item.author_review_count = authorReviews;
    const authorPhotos = toNumber(author?.[6]);
    if (authorPhotos !== null) item.author_photo_count = authorPhotos;
    if (badge && /local guide/i.test(badge)) {
        item.author_badge = badge;
        item.is_local_guide = true;
    }

    const photos = extractPhotos(review);
    if (photos) item.photos = photos;

    const reviewUrl = toText(review?.[4]?.[3]?.[0]);
    if (reviewUrl) item.review_url = reviewUrl;

    const context = extractContext(review);
    if (context) item.review_context = context;

    if (Array.isArray(ownerReply)) {
        const responseText = toText(ownerReply[0]);
        if (responseText) {
            item.owner_response_text = responseText;
            const responseAt = microsToIso(review?.[3]?.[1]);
            if (responseAt) item.owner_response_at = responseAt;
            const responseRelative = toText(review?.[3]?.[3]);
            if (responseRelative) item.owner_response_relative_date = responseRelative;
        }
    }

    return item;
}

function collectReviewArrays(node, depth = 0, out = []) {
    if (depth > 6 || !node) return out;
    if (Array.isArray(node)) {
        if (
            typeof node[0] === 'string' &&
            node[0].startsWith('Ci9') &&
            Array.isArray(node[1]) &&
            Array.isArray(node[2])
        ) {
            out.push(node);
            return out;
        }
        for (const child of node) collectReviewArrays(child, depth + 1, out);
    }
    return out;
}

export function extractFeedPage(payload) {
    const node = payload?.[2];
    if (!Array.isArray(node)) return { reviews: [], cursor: null, ended: true };
    const reviews = [];
    for (const wrapper of node) {
        if (Array.isArray(wrapper?.[0])) reviews.push(wrapper[0]);
        else if (Array.isArray(wrapper)) reviews.push(wrapper);
    }
    const rawCursor = payload?.[1];
    let cursor = null;
    if (typeof rawCursor === 'string' && rawCursor) {
        cursor = rawCursor;
    } else if (Array.isArray(rawCursor) && typeof rawCursor[0] === 'string' && rawCursor[0]) {
        cursor = rawCursor[0];
    }
    return { reviews, cursor, ended: payload?.[5] === true || !cursor };
}

async function launchBrowser(proxyUrl) {
    const options = { headless: true };
    if (proxyUrl) {
        try {
            const parsed = new URL(proxyUrl);
            options.proxy = {
                server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
                ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
                ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
            };
        } catch {
            options.proxy = { server: proxyUrl };
        }
    }
    return firefox.launch(options);
}

function buildPlaceAddress(place, hl) {
    if (place.placeId) return `https://${place.host}/maps/place/?q=place_id:${place.placeId}&hl=${hl}`;
    return `https://${place.host}/maps?cid=${place.cid}&hl=${hl}`;
}

async function dismissInterstitials(page) {
    const dismiss = page.getByRole('button', { name: /^(dismiss|not now|no thanks)$/i }).first();
    if (await dismiss.count().catch(() => 0)) {
        await dismiss.click({ timeout: 2000 }).catch(() => {});
    }
}

async function openReviewsTab(page) {
    const tab = page.getByRole('tab', { name: /review/i }).first();
    if (await tab.count().catch(() => 0)) {
        await tab.click({ timeout: 5000 }).catch(() => {});
        return;
    }
    await page
        .evaluate(() => {
            const candidates = [...document.querySelectorAll('button, [role="tab"], [role="button"]')];
            const target = candidates.find((element) => /review/i.test(element.getAttribute('aria-label') || ''));
            target?.click();
        })
        .catch(() => {});
}

async function applySort(page, sort) {
    const pattern = SORT_LABELS[sort];
    if (!pattern) return false;

    const button = page.getByRole('button', { name: /sort/i }).first();
    if (!(await button.count().catch(() => 0))) return false;

    try {
        await button.click({ timeout: 4000 });
        const option = page
            .getByRole('menuitemradio', { name: pattern })
            .or(page.getByRole('menuitem', { name: pattern }))
            .or(page.getByRole('option', { name: pattern }))
            .or(page.getByText(pattern).last());
        await option.click({ timeout: 4000 });
        return true;
    } catch {
        await page.keyboard.press('Escape').catch(() => {});
        return false;
    }
}

function sortLocally(reviews, sort) {
    if (sort === 'newest') {
        return [...reviews].sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    }
    if (sort === 'highest_rating') return [...reviews].sort((a, b) => b.rating - a.rating);
    if (sort === 'lowest_rating') return [...reviews].sort((a, b) => a.rating - b.rating);
    return reviews;
}

async function postRpc(page, rpc, payload, headers) {
    const body = new URLSearchParams({
        'f.req': JSON.stringify([[['qv9Egd', JSON.stringify(payload), null, 'generic']]]),
    }).toString();

    return page.evaluate(
        async ({ url, bodyText, extraHeaders }) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'x-same-domain': '1',
                    ...extraHeaders,
                },
                body: bodyText,
            });
            return response.text();
        },
        { url: rpc.url, bodyText: body, extraHeaders: headers },
    );
}

export function applyCursor(payload, cursor) {
    const next = JSON.parse(JSON.stringify(payload));
    if (Array.isArray(next[1])) {
        next[1][1] = cursor;
    } else {
        next[1] = [10, cursor];
    }
    return next;
}

export async function expandShortLink(url, proxyUrl) {
    const browser = await launchBrowser(proxyUrl);
    try {
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-US' });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        for (let attempt = 0; attempt < 30; attempt += 1) {
            const current = page.url();
            if (/0x[0-9a-f]+:(?:0x)?[0-9a-f]+/i.test(current) || current.includes('/maps/place/')) return current;
            await page.waitForTimeout(500);
        }
        return page.url();
    } finally {
        await browser.close().catch(() => {});
    }
}

export async function collectReviews({
    place,
    sort,
    resultsWanted,
    maxPages,
    proxyUrl,
    hl,
    cookies = [],
    log,
    allowCookieFallback = true,
}) {
    const browser = await launchBrowser(proxyUrl);
    const placeInfo = { ...place };
    const collected = new Map();
    let pagesFetched = 0;
    let fallbackReviews = [];

    try {
        const context = await browser.newContext({
            viewport: { width: 1366, height: 960 },
            locale: 'en-US',
            timezoneId: 'UTC',
        });
        if (cookies.length) {
            await context.addCookies(cookies);
            log.info(`Signed-in session cookies applied: ${cookies.length}`);
        }
        const page = await context.newPage();

        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (RESOURCE_BLOCKLIST.has(type)) return route.abort();
            return route.continue();
        });

        let rpc = null;
        let rpcResponse = null;
        let rpcHeaders = {};
        let previewPromise = null;

        page.on('request', (request) => {
            if (!request.url().includes('qv9Egd')) return;
            const postData = request.postData();
            if (!postData) return;
            let decoded;
            try {
                decoded = decodeURIComponent(postData);
            } catch {
                decoded = postData;
            }
            const match = decoded.match(/f\.req=(\[.*\])(?:&|$)/);
            if (!match) return;
            try {
                const outer = JSON.parse(match[1]);
                const payload = JSON.parse(outer[0][0][1]);
                rpc = { url: request.url(), payload };
                const bgkey = request.headers()['x-maps-bgkey'];
                if (bgkey) rpcHeaders = { 'x-maps-bgkey': bgkey };
            } catch {
                /* malformed capture */
            }
        });

        page.on('response', (response) => {
            const url = response.url();
            if (url.includes('qv9Egd')) {
                rpcResponse = response.text().catch(() => null);
            }
            if (url.includes('/maps/preview/place')) {
                previewPromise = response.text().catch(() => null);
            }
        });

        const address = buildPlaceAddress(place, hl);
        await page.goto(address, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(4000);

        const pageTitle = (await page.title().catch(() => '')) || '';
        const resolvedName = pageTitle.replace(/\s*-\s*Google Maps\s*$/i, '').trim();
        if (!placeInfo.name && resolvedName) placeInfo.name = resolvedName;
        log.info(`Opened place page | name=${placeInfo.name || 'unknown'}`);

        await dismissInterstitials(page);
        await openReviewsTab(page);

        for (let attempt = 0; attempt < 24 && !rpc; attempt += 1) {
            await page.waitForTimeout(500);
        }

        if (!rpc) {
            log.warning('Google did not expose the review feed for this page; falling back to the place payload.');
        }

        let serverSorted = false;
        if (rpc && sort !== 'most_relevant') {
            const before = JSON.stringify(rpc.payload);
            serverSorted = await applySort(page, sort);
            if (serverSorted) {
                for (let attempt = 0; attempt < 16; attempt += 1) {
                    await page.waitForTimeout(500);
                    if (JSON.stringify(rpc.payload) !== before) break;
                }
                if (JSON.stringify(rpc.payload) === before) {
                    serverSorted = false;
                } else {
                    rpcResponse = null;
                }
            }
        }

        if (rpc) {
            let { payload } = rpc;
            let responseText = rpcResponse ? await rpcResponse.catch(() => null) : null;

            for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
                if (!responseText) {
                    responseText = await postRpc(page, rpc, payload, rpcHeaders).catch(() => null);
                }
                if (!responseText) break;

                const parsed = parseBatchexecuteResponse(responseText);
                if (!parsed) break;

                const { reviews: rawReviews, cursor, ended } = extractFeedPage(parsed);
                if (!rawReviews.length) break;

                for (const rawReview of rawReviews) {
                    const mapped = mapReview(rawReview, placeInfo);
                    if (mapped && !collected.has(mapped.review_id)) collected.set(mapped.review_id, mapped);
                }

                pagesFetched = pageNumber;
                log.info(`Fetched reviews page ${pageNumber}: ${rawReviews.length} reviews (${collected.size} unique)`);

                if (collected.size >= resultsWanted) break;
                if (ended || !cursor) break;

                payload = applyCursor(payload, cursor);
                responseText = null;
            }

            if (rpc && !serverSorted && sort !== 'most_relevant') {
                log.info(`Sort order "${sort}" applied locally because Google returned its default order.`);
            }
        }

        if (!collected.size) {
            if (!previewPromise) {
                for (let attempt = 0; attempt < 8 && !previewPromise; attempt += 1) {
                    await page.waitForTimeout(400);
                }
            }
            const previewBody = previewPromise ? await previewPromise.catch(() => null) : null;
            const previewData = parseJsonResponse(previewBody);
            if (previewData) {
                fallbackReviews = collectReviewArrays(previewData);
                for (const rawReview of fallbackReviews) {
                    const mapped = mapReview(rawReview, placeInfo);
                    if (mapped && !collected.has(mapped.review_id)) collected.set(mapped.review_id, mapped);
                }
                if (collected.size) log.info(`Recovered ${collected.size} reviews from the place payload.`);
            }
        }

        await page.close().catch(() => {});
        await context.close().catch(() => {});
    } finally {
        await browser.close().catch(() => {});
    }

    const reviews = [...collected.values()];
    const ordered = sort === 'most_relevant' || collected.size === 0 ? reviews : sortLocally(reviews, sort);

    if (!ordered.length && cookies.length && allowCookieFallback) {
        log.warning('The signed-in session returned no reviews. Retrying without cookies.');
        return collectReviews({
            place,
            sort,
            resultsWanted,
            maxPages,
            proxyUrl,
            hl,
            cookies: [],
            log,
            allowCookieFallback: false,
        });
    }

    return { reviews: ordered.slice(0, resultsWanted), pagesFetched, placeName: placeInfo.name || null };
}
