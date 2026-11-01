import { describe, expect, it } from 'vitest';

import { extractFeatureId, extractPlaceName, featureIdToCid, normalizeTarget, titleFromHtml } from '../src/place.js';

const FEATURE_ID = '0x391905826c0ea279:0x9caee49691e59b26';
const PLACE_ID = 'ChIJeaIObIIFGTkRJpvlkZbkrpw';

describe('normalizeTarget', () => {
    it('recognizes feature IDs, place IDs, URLs, and search queries', () => {
        expect(normalizeTarget(FEATURE_ID)).toEqual({ kind: 'feature', value: FEATURE_ID });
        expect(normalizeTarget(PLACE_ID)).toEqual({ kind: 'placeId', value: PLACE_ID });
        expect(normalizeTarget('https://www.google.com/maps?cid=11290212651208383270')).toEqual({
            kind: 'url',
            value: 'https://www.google.com/maps?cid=11290212651208383270',
        });
        expect(normalizeTarget('Baraza Coffee Lahore')).toEqual({
            kind: 'query',
            value: 'Baraza Coffee Lahore',
        });
        expect(normalizeTarget('   ')).toBeNull();
    });

    it('finds a feature ID inside a full place URL', () => {
        const url = `https://www.google.com/maps/place/Name/@40.39,-8.45,551m/data=!3m1!1e3!4m6!3m5!1s${FEATURE_ID}!8m2!3d40.39!4d-8.45`;
        expect(normalizeTarget(url)).toEqual({ kind: 'feature', value: FEATURE_ID });
    });
});

describe('extractFeatureId', () => {
    it('keeps both halves and normalizes the low half to 0x form', () => {
        expect(extractFeatureId(`prefix ${FEATURE_ID} suffix`)).toBe(FEATURE_ID);
        expect(extractFeatureId('0x0:9caee49691e59b26')).toBe('0x0:0x9caee49691e59b26');
        expect(extractFeatureId('no id here')).toBeNull();
    });
});

describe('featureIdToCid', () => {
    it('converts the low half of a feature ID to the decimal cid', () => {
        expect(featureIdToCid(FEATURE_ID)).toBe('11290212651208383270');
    });
});

describe('titleFromHtml', () => {
    it('reads a place name and rejects the generic Maps title', () => {
        expect(titleFromHtml('<title>Baraza Coffee (Gulberg) - Google Maps</title>')).toBe('Baraza Coffee (Gulberg)');
        expect(titleFromHtml('<title>Google Maps</title>')).toBeNull();
        expect(titleFromHtml('<title>  </title>')).toBeNull();
        expect(titleFromHtml('no title')).toBeNull();
    });
});

describe('extractPlaceName', () => {
    it('reads the place name from a Maps path', () => {
        expect(extractPlaceName('https://www.google.com/maps/place/Meta+dos+Leit%C3%B5es/@40.39,-8.45,551m')).toBe(
            'Meta dos Leitões',
        );
    });

    it('returns null for URLs without a place path', () => {
        expect(extractPlaceName('https://www.google.com/maps?cid=11290212651208383270')).toBeNull();
        expect(extractPlaceName('not a url')).toBeNull();
    });
});
