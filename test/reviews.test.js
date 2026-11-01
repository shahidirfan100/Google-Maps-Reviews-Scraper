import { describe, expect, it } from 'vitest';

import { applyCursor, extractFeedPage, mapReview, parseBatchexecuteResponse } from '../src/reviews.js';

const PLACE = {
    placeId: 'ChIJtestplaceid',
    name: 'Test Coffee',
    url: 'https://www.google.com/maps/place/?q=place_id:ChIJtestplaceid',
};

function buildReview(overrides = {}) {
    const review = [
        'Ci9DQUlRQUNvZENodHljRjlvVGVzdFJldmlld0lkEAE',
        [
            '0x0:0xabc',
            null,
            1792034089181155,
            1792034089181155,
            [
                null,
                null,
                ['https://www.google.com/maps/contrib/1/reviews?hl=en'],
                null,
                null,
                [
                    'Test User',
                    'https://lh3.googleusercontent.com/a/avatar=s120',
                    ['https://www.google.com/maps/contrib/1?hl=en'],
                    '1',
                    null,
                    128,
                    965,
                    null,
                    [true, 7, true],
                    91,
                    ['Local Guide · 128 reviews'],
                ],
            ],
            null,
            '2 weeks ago',
        ],
        [
            [5],
            null,
            [
                [
                    'photoId',
                    [
                        'photoId',
                        10,
                        12,
                        null,
                        null,
                        null,
                        ['https://lh3.googleusercontent.com/photo-1', null, [2268, 4032]],
                        null,
                        [[3, 74.3, 31.5], [0, 90], [2268, 4032], 75],
                        'token',
                        'tracking',
                        ['report'],
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        [null, null, null, [null, null, null, null, null, ['Indoor seating'], null, ['Test Coffee']]],
                        [null, [10, 'photoId']],
                        [10, 3, [4032, 2268]],
                    ],
                ],
            ],
            null,
            null,
            null,
            [
                [
                    ['GUIDED_DINING_MEAL_TYPE'],
                    'What did you get?',
                    [[[['E:LUNCH'], 'Lunch', 2]]],
                    null,
                    null,
                    'Meal type',
                ],
                [['GUIDED_DINING_FOOD_ASPECT'], 'Food', null, null, null, 'Food', null, 'x', null, null, null, [4]],
            ],
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            ['en'],
            [['Great coffee and friendly staff', null, [0, 34]]],
        ],
        [
            null,
            1788698307000000,
            1788698681000000,
            'a month ago',
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            [['Thanks for the review', null]],
        ],
        [null, null, null, ['https://www.google.com/maps/reviews/data=!test']],
        'tracking-token',
    ];

    return Object.assign(review, overrides);
}

describe('parseBatchexecuteResponse', () => {
    it('reads the JSON payload from a chunked batchexecute response', () => {
        const payload = [null, null, [], null, null, true];
        const text = `)]}'\n\n42\n[["wrb.fr","qv9Egd","${JSON.stringify(JSON.stringify(payload)).slice(1, -1)}",null,null,null,"generic"]]\n\n12\n[["di",7]]`;
        const parsed = parseBatchexecuteResponse(text);
        expect(parsed).toEqual(payload);
    });

    it('returns null for an error payload without a data row', () => {
        const text = `)]}'\n\n51\n[["wrb.fr","qv9Egd",null,null,null,[3],"generic"],["di",7]]`;
        expect(parseBatchexecuteResponse(text)).toBeNull();
    });
});

describe('extractFeedPage', () => {
    it('returns reviews and marks the feed as ended when no cursor is present', () => {
        const payload = [null, null, [[buildReview()]], null, null, true];
        const page = extractFeedPage(payload);
        expect(page.reviews).toHaveLength(1);
        expect(page.cursor).toBeNull();
        expect(page.ended).toBe(true);
    });

    it('returns the next cursor when Google provides one', () => {
        const payload = [null, 'CAESnextpage', [[buildReview()]], null, null];
        const page = extractFeedPage(payload);
        expect(page.cursor).toBe('CAESnextpage');
        expect(page.ended).toBe(false);
    });
});

describe('applyCursor', () => {
    it('writes the cursor into the page-size block without mutating the template', () => {
        const template = [null, [10, ''], null, null, ['token']];
        const next = applyCursor(template, 'CAESnextpage');
        expect(next[1]).toEqual([10, 'CAESnextpage']);
        expect(template[1]).toEqual([10, '']);
    });

    it('creates a page-size block when the template has none', () => {
        const next = applyCursor([null, null, []], 'CAESnextpage');
        expect(next[1]).toEqual([10, 'CAESnextpage']);
    });
});

describe('mapReview', () => {
    it('maps every populated field and keeps the review text intact', () => {
        const item = mapReview(buildReview(), PLACE);

        expect(item).toMatchObject({
            review_id: 'Ci9DQUlRQUNvZENodHljRjlvVGVzdFJldmlld0lkEAE',
            rating: 5,
            place_id: 'ChIJtestplaceid',
            place_name: 'Test Coffee',
            review_text: 'Great coffee and friendly staff',
            review_language: 'en',
            relative_date: '2 weeks ago',
            author_name: 'Test User',
            author_id: '1',
            author_url: 'https://www.google.com/maps/contrib/1?hl=en',
            author_review_count: 128,
            author_photo_count: 965,
            author_badge: 'Local Guide · 128 reviews',
            is_local_guide: true,
            review_url: 'https://www.google.com/maps/reviews/data=!test',
            owner_response_text: 'Thanks for the review',
            owner_response_relative_date: 'a month ago',
        });
        expect(item.published_at).toBe('2026-10-15T03:14:49.181Z');
        expect(item.photos).toEqual([{ url: 'https://lh3.googleusercontent.com/photo-1', caption: 'Indoor seating' }]);
        expect(item.review_context).toEqual({ 'Meal type': 'Lunch', Food: '4/5' });
        expect(item).not.toHaveProperty('edited_at');
    });

    it('omits empty fields instead of writing nulls', () => {
        const review = buildReview();
        review[3] = null;
        review[2][2] = null;
        review[2][6] = null;
        review[2][15] = null;
        review[4] = null;

        const item = mapReview(review, {});
        expect(item).not.toHaveProperty('owner_response_text');
        expect(item).not.toHaveProperty('photos');
        expect(item).not.toHaveProperty('review_context');
        expect(item).not.toHaveProperty('review_text');
        expect(item).not.toHaveProperty('review_url');
        expect(Object.values(item).every((value) => value !== null && value !== undefined)).toBe(true);
    });

    it('rejects entries without a rating', () => {
        const review = buildReview();
        review[2][0] = [0];
        expect(mapReview(review, PLACE)).toBeNull();
    });
});
