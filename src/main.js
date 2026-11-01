import { Actor, log } from 'apify';

import { resolvePlace, searchPlaceInfo } from './place.js';
import { collectReviews, expandShortLink } from './reviews.js';

const SORT_ORDERS = new Set(['most_relevant', 'newest', 'highest_rating', 'lowest_rating']);
const SHORT_LINK = /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i;

function toBoundedInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeCookies(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(
            (cookie) => cookie && typeof cookie.name === 'string' && cookie.name.trim() && cookie.value !== undefined,
        )
        .map((cookie) => ({
            name: cookie.name.trim(),
            value: String(cookie.value),
            domain: typeof cookie.domain === 'string' && cookie.domain ? cookie.domain : '.google.com',
            path: typeof cookie.path === 'string' && cookie.path ? cookie.path : '/',
        }));
}

await Actor.init();

try {
    const input = (await Actor.getInput()) || {};
    const startUrl = String(input.startUrl || '').trim();

    if (!startUrl) {
        throw new Error('Provide a Google Maps place URL, place ID, or feature ID in the Start URL field.');
    }

    const sort = SORT_ORDERS.has(input.sort) ? input.sort : 'most_relevant';
    const resultsWanted = toBoundedInt(input.results_wanted, 20, 1, 10000);
    const maxPages = toBoundedInt(input.max_pages, 10, 1, 100);
    const hl = String(input.language || 'en').trim() || 'en';
    const gl = String(input.countryCode || 'us').trim() || 'us';
    const cookies = normalizeCookies(input.cookies);

    let proxyConfiguration;
    let proxyUrl;
    if (input.proxyConfiguration) {
        proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
        if (proxyConfiguration) {
            try {
                proxyUrl = await proxyConfiguration.newUrl(`place_${Date.now()}`);
            } catch (error) {
                log.warning(`Proxy is unavailable for this run, continuing without it: ${error.message}`);
            }
        }
    }

    log.info(`Start run | target=${startUrl} | sort=${sort} | limit=${resultsWanted}`);

    let resolvedInput = startUrl;
    if (SHORT_LINK.test(startUrl)) {
        log.info('Expanding Google Maps short link.');
        resolvedInput = await expandShortLink(startUrl, proxyUrl);
        log.info(`Short link resolved to ${resolvedInput}`);
    }

    const place = await resolvePlace(resolvedInput, { proxyUrl, hl, gl });
    if (!place.placeId && !place.cid) {
        throw new Error('Place resolved without a usable identifier.');
    }

    const resolvedHost = new URL(place.placeUrl || `https://www.google.com/maps?cid=${place.cid}`).hostname;
    let host = resolvedHost;
    if (cookies.length) {
        const cookieDomain = cookies.find((cookie) => cookie.domain.includes('google.'))?.domain;
        host = cookieDomain ? cookieDomain.replace(/^\./, '') : 'www.google.com';
        if (host === 'google.com') host = 'www.google.com';
    }

    const canonicalUrl = place.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${place.placeId}`
        : `https://www.google.com/maps?cid=${place.cid}`;

    const target = {
        ...place,
        host,
        url: canonicalUrl,
        name: place.name || null,
    };

    log.info(`Place resolved | place_id=${target.placeId || 'n/a'} | cid=${target.cid}`);

    const { reviews, pagesFetched, placeName } = await collectReviews({
        place: target,
        sort,
        resultsWanted,
        maxPages,
        proxyUrl,
        hl,
        cookies,
        log,
    });

    if (!target.name && placeName) target.name = placeName;

    if (!target.rating && target.name) {
        const infos = await searchPlaceInfo(target.name, { proxyUrl, hl, gl });
        const match = infos?.find((info) => info.featureId === target.featureId) || null;
        if (match) {
            target.rating = match.rating ?? target.rating ?? null;
            target.reviewsCount = match.reviewsCount ?? target.reviewsCount ?? null;
            target.placeId = target.placeId || match.placeId || null;
        }
    }

    for (const review of reviews) {
        if (!review.place_id && target.placeId) review.place_id = target.placeId;
        if (!review.place_name && target.name) review.place_name = target.name;
        if (!review.place_url) review.place_url = canonicalUrl;
    }

    const requestedCount = target.reviewsCount ? Math.min(resultsWanted, target.reviewsCount) : resultsWanted;
    const limited = reviews.length > 0 && reviews.length < requestedCount;
    if (limited) {
        log.warning(
            cookies.length
                ? `Google returned ${reviews.length} of ${target.reviewsCount} reviews. The session may have expired or the rest are not public.`
                : `Google returned ${reviews.length} of ${target.reviewsCount} reviews. Signed-out sessions are limited to the first few reviews; add signed-in cookies to the "cookies" input to collect more.`,
        );
    }

    if (!reviews.length) {
        log.warning(
            'No reviews were returned for this place. The listing may have no reviews, or Google limited the response.',
        );
    } else {
        await Actor.pushData(reviews);
    }

    const summary = {
        ...(target.placeId ? { place_id: target.placeId } : {}),
        ...(target.name ? { place_name: target.name } : {}),
        ...(target.rating !== null && target.rating !== undefined ? { rating: target.rating } : {}),
        ...(target.reviewsCount !== null && target.reviewsCount !== undefined
            ? { reviews_count: target.reviewsCount }
            : {}),
        sort,
        saved: reviews.length,
        pages_fetched: pagesFetched,
        limited,
        scraped_at: new Date().toISOString(),
    };

    await Actor.setValue('SUMMARY', summary);
    log.info(
        `Done | saved=${reviews.length} | pages=${pagesFetched} | place=${target.name || target.placeId || 'unknown'}`,
    );
} catch (error) {
    log.error(`Actor failed: ${error.message}`);
    process.exitCode = 1;
} finally {
    await Actor.exit();
}
