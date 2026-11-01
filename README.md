## What does Google Maps Reviews Scraper do?

Google Maps Reviews Scraper collects public customer reviews for any Google Maps place and saves them as a clean dataset. Paste a place URL, a place ID, or a Maps feature ID, choose how you want the reviews sorted, and run the Actor. Each record includes the rating, review text, reviewer name, review date, attached photos, Local Guide badge, and any business reply.

This Actor is built for local SEO audits, reputation monitoring, competitor research, and review analysis. Export the results to CSV, Excel, or JSON, or send them to a spreadsheet, webhook, or your own application.

## Why use Google Maps Reviews Scraper?

- **One input for every place URL style.** Full Maps URLs, `cid` links, short links, bare place IDs, and feature IDs all work.
- **Reviewer detail beyond the star rating.** Get the reviewer profile, review count, photo count, Local Guide status, and review language.
- **Business replies included.** Owner responses are captured with their text and date when the business replied.
- **Review photos included.** Photo URLs and captions are saved with the review when available.
- **Useful place context on every record.** Place name, place ID, and a canonical Maps URL make the dataset easy to join with other business data.
- **Simple filtering.** Choose the sort order, cap the number of reviews, and put a safety limit on pages.
- **Automation ready.** Run on a schedule, trigger webhooks, or pull the dataset from the Apify API.

## What data can you extract from Google Maps?

| Field                          | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `review_id`                    | Google review identifier                                           |
| `rating`                       | Star rating from 1 to 5                                            |
| `review_text`                  | Full review text when the reviewer wrote one                       |
| `review_language`              | Language code reported by Google                                   |
| `author_name`                  | Reviewer display name                                              |
| `author_id`                    | Google Maps contributor ID                                         |
| `author_url`                   | Reviewer profile link                                              |
| `author_avatar`                | Reviewer profile photo URL                                         |
| `author_review_count`          | Number of reviews written by the reviewer                          |
| `author_photo_count`           | Number of photos shared by the reviewer                            |
| `author_badge`                 | Local Guide badge text when present                                |
| `is_local_guide`               | True when the reviewer is a Google Local Guide                     |
| `published_at`                 | Review date in ISO 8601 format                                     |
| `edited_at`                    | Last edit date when the review was edited                          |
| `relative_date`                | Date label shown by Google, for example `2 weeks ago`              |
| `review_url`                   | Direct Maps link to the review                                     |
| `photos`                       | Review photos with URLs and captions when available                |
| `review_context`               | Guided details such as meal type, price per person, or food rating |
| `owner_response_text`          | Business reply text when the business replied                      |
| `owner_response_at`            | Business reply date in ISO 8601 format                             |
| `owner_response_relative_date` | Date label for the business reply                                  |
| `place_id`                     | Google Maps place ID                                               |
| `place_name`                   | Business or place name                                             |
| `place_url`                    | Canonical Maps URL for the place                                   |

## How to use Google Maps Reviews Scraper

1. Open the Actor in Apify Console.
2. Paste a Google Maps place URL into **Google Maps place URL**. A place ID or feature ID also works.
3. Choose a sort order, for example **Newest** for recent feedback or **Lowest rating** for service recovery.
4. Set the maximum number of reviews and, if needed, the page limit.
5. Keep the default proxy settings. If you need the full review history, add signed-in Google cookies to the **Google session cookies** field.
6. Start the Actor, then open the dataset to preview the results and download them in your preferred format.

## Input Parameters

| Parameter            | Type    | Required | Default                  | Description                                                     |
| -------------------- | ------- | -------- | ------------------------ | --------------------------------------------------------------- |
| `startUrl`           | String  | No       | Example place URL        | Google Maps place URL, `cid` URL, place ID, or feature ID       |
| `sort`               | String  | No       | `most_relevant`          | `most_relevant`, `newest`, `highest_rating`, or `lowest_rating` |
| `results_wanted`     | Integer | No       | `20`                     | Maximum number of reviews to save                               |
| `max_pages`          | Integer | No       | `10`                     | Safety cap on review pages, up to 10 reviews per page           |
| `proxyConfiguration` | Object  | No       | Apify Proxy, residential | Proxy settings for the run                                      |
| `cookies`            | Array   | No       | -                        | Signed-in Google cookies that unlock the full review history    |

## Output Data

| Field                          | Type    | Description                          |
| ------------------------------ | ------- | ------------------------------------ |
| `review_id`                    | String  | Google review identifier             |
| `rating`                       | Integer | Star rating from 1 to 5              |
| `review_text`                  | String  | Review text                          |
| `review_language`              | String  | Review language code                 |
| `author_name`                  | String  | Reviewer name                        |
| `author_id`                    | String  | Reviewer contributor ID              |
| `author_url`                   | String  | Reviewer profile URL                 |
| `author_avatar`                | String  | Reviewer avatar URL                  |
| `author_review_count`          | Integer | Reviews written by the reviewer      |
| `author_photo_count`           | Integer | Photos shared by the reviewer        |
| `author_badge`                 | String  | Local Guide badge text               |
| `is_local_guide`               | Boolean | Local Guide status                   |
| `published_at`                 | String  | Review date in ISO 8601 format       |
| `edited_at`                    | String  | Edit date in ISO 8601 format         |
| `relative_date`                | String  | Date label shown by Google           |
| `review_url`                   | String  | Direct review link                   |
| `photos`                       | Array   | Review photos with URLs and captions |
| `review_context`               | Object  | Guided review details                |
| `owner_response_text`          | String  | Business reply text                  |
| `owner_response_at`            | String  | Business reply date                  |
| `owner_response_relative_date` | String  | Business reply date label            |
| `place_id`                     | String  | Google Maps place ID                 |
| `place_name`                   | String  | Place name                           |
| `place_url`                    | String  | Canonical place URL                  |

Fields that Google does not provide for a review are omitted from that record instead of being saved as empty values.

## Usage Examples

### Collect the newest reviews for one place

Use a full place URL and sort by date to monitor recent feedback.

```json
{
    "startUrl": "https://www.google.com/maps/place/?q=place_id:ChIJeaIObIIFGTkRJpvlkZbkrpw",
    "sort": "newest",
    "results_wanted": 100,
    "max_pages": 10
}
```

### Collect reviews with a place ID

The same place can be supplied as a bare place ID, a `cid` URL, or a feature ID.

```json
{
    "startUrl": "ChIJeaIObIIFGTkRJpvlkZbkrpw",
    "sort": "most_relevant",
    "results_wanted": 50,
    "max_pages": 5
}
```

### Run a small test batch

Start with a small limit to confirm the place and the output before a larger run.

```json
{
    "startUrl": "https://www.google.com/maps?cid=11290212651208383270",
    "sort": "highest_rating",
    "results_wanted": 10,
    "max_pages": 1
}
```

### Review negative feedback first

Sort by lowest rating to surface complaints for a service recovery workflow.

```json
{
    "startUrl": "https://www.google.com/maps/place/Meta+dos+Leit%C3%B5es/@40.3933238,-8.4503946,551m/data=!3m1!1e3!4m6!3m5!1s0xd2254b398404225:0x13c80875de7b24c1!8m2!3d40.3940782!4d-8.4503927?entry=ttu",
    "sort": "lowest_rating",
    "results_wanted": 30,
    "max_pages": 3
}
```

### Collect the full review history

Google serves only the first few reviews to signed-out sessions. Add cookies from a signed-in Google account to unlock the full list. Export the cookies for `google.com` from a signed-in browser and pass them as an array. A working Google session normally needs `SID`, `HSID`, `SSID`, `APISID`, and `SAPISID`, plus the `__Secure-1PSID` and `__Secure-3PSID` variants.

```json
{
    "startUrl": "https://www.google.com/maps/place/?q=place_id:ChIJeaIObIIFGTkRJpvlkZbkrpw",
    "sort": "newest",
    "results_wanted": 200,
    "max_pages": 20,
    "cookies": [
        { "name": "SID", "value": "your-sid-value", "domain": ".google.com", "path": "/" },
        { "name": "HSID", "value": "your-hsid-value", "domain": ".google.com", "path": "/" },
        { "name": "SSID", "value": "your-ssid-value", "domain": ".google.com", "path": "/" },
        { "name": "APISID", "value": "your-apisid-value", "domain": ".google.com", "path": "/" },
        { "name": "SAPISID", "value": "your-sapisid-value", "domain": ".google.com", "path": "/" }
    ]
}
```

Use a dedicated Google account for this, never a personal or business account. Google may flag accounts that automate Maps. If a cookie session returns no reviews, the Actor retries signed out; the run summary then reports `limited: true`.

## Sample Output

Example record with reviewer details anonymized:

```json
{
    "review_id": "Ci9DQUlRQUNvZENodHljRjlvU2FtcGxlUmV2aWV3SWQxMjM0NQ",
    "rating": 5,
    "place_id": "ChIJeaIObIIFGTkRJpvlkZbkrpw",
    "place_name": "Baraza Coffee (Gulberg)",
    "place_url": "https://www.google.com/maps/place/?q=place_id:ChIJeaIObIIFGTkRJpvlkZbkrpw",
    "review_text": "Courteous and welcoming staff, nice menu with variety of options, overall good dining experience",
    "review_language": "en",
    "relative_date": "2 weeks ago",
    "published_at": "2026-10-15T03:14:49.181Z",
    "author_name": "Sample reviewer",
    "author_id": "000000000000000000000",
    "author_url": "https://www.google.com/maps/contrib/000000000000000000000?hl=en",
    "author_avatar": "https://lh3.googleusercontent.com/a/sample-avatar",
    "author_review_count": 128,
    "author_photo_count": 965,
    "author_badge": "Local Guide · 128 reviews",
    "is_local_guide": true,
    "review_url": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sCi9DQUlRQUNvZENodHljRjlvU2FtcGxlUmV2aWV3SWQxMjM0NQ",
    "photos": [
        {
            "url": "https://lh3.googleusercontent.com/grass-cs/sample-photo-url=k-no",
            "caption": "Indoor seating with decorative tree"
        }
    ],
    "review_context": {
        "Meal type": "Lunch",
        "Price per person": "Rs 5,000-6,000",
        "Wait time": "No wait"
    }
}
```

## Tips for Best Results

- Use the full place URL copied from Google Maps, or the place ID, to avoid resolving the wrong business.
- Start with 10 to 20 reviews to confirm the output, then raise the limit for a production run.
- Keep the page limit in place. It protects the run if Google keeps serving pages.
- Google decides how many reviews a place and a session will return. Signed-out sessions often receive a short list, even for places with hundreds of reviews.
- To collect beyond that short list, add cookies from a signed-in Google account. Use a dedicated account, not a personal or business one.
- Use residential proxies for scheduled runs and larger collections to reduce interruptions.
- Sort by newest for monitoring, lowest rating for recovery work, and highest rating for testimonials.
- Run one place per run. For a portfolio of locations, schedule several runs or launch them in parallel.

## Integrations

- **Google Sheets** - Send each run's reviews to a spreadsheet for reporting.
- **Webhooks** - Notify your systems when a run finishes.
- **Make or Zapier** - Route new reviews into alerts, CRM records, or support queues.
- **Apify API** - Read the dataset from your own application or dashboard.
- **CSV, Excel, JSON, XML** - Download the dataset in the format your team uses.

## Frequently Asked Questions

### Can I export Google Maps reviews to CSV or Excel?

Yes. Apify datasets can be downloaded as CSV, Excel, JSON, XML, and HTML, and the same data is available through the Apify API.

### Can I schedule the Actor to collect reviews every day?

Yes. Create a schedule in Apify Console and the Actor will collect new data at the interval you choose. Filter or deduplicate on `review_id` if you only want new reviews.

### Do the results include business replies?

Yes. When the business replied to a review, `owner_response_text`, `owner_response_at`, and `owner_response_relative_date` are added to that record.

### Why did I get fewer reviews than I requested?

Google caps signed-out sessions at the first few reviews for a place, even when the place has hundreds. The Actor saves every review Google returns and reports the place's total review count plus a `limited` flag in the run summary. To collect more, add cookies from a signed-in Google account to the `cookies` input. A signed-in session unlocks the full review list and the Actor pages through it until your limit or the end of the list.

### Does it work with short Google Maps links?

Yes. Short links such as `maps.app.goo.gl` and `goo.gl/maps` links are followed to the place page before collection.

### Can I collect reviews for more than one place in a single run?

One place per run keeps the dataset clean and the run predictable. To cover many locations, run the Actor in parallel or schedule separate runs for each place.

### Is it legal to scrape Google Maps reviews?

The reviews are public, but review data includes personal names and profile links. You are responsible for complying with applicable privacy laws, Google's terms, and the rules that apply to your use case.

## Related Actors

- [Google Maps Business Scraper](https://apify.com/shahidirfan/Google-Maps-Business-Scraper) - Collect business details such as address, phone, website, and hours.
- [Tripadvisor Reviews Scraper](https://apify.com/shahidirfan/tripadvisor-reviews-scraper) - Add travel and restaurant review data from Tripadvisor.
- [Trustpilot Reviews Scraper](https://apify.com/shahidirfan/Trustpilot-Reviews-Scraper) - Compare brand sentiment on Trustpilot.
- [Zomato Restaurant Reviews Scraper](https://apify.com/shahidirfan/Zomato-Restaurant-Reviews-Scraper) - Collect restaurant reviews from Zomato for food and dining research.

## Support

For issues, feature requests, or custom Actor work, use the Issues tab on the Actor page or contact the developer through Apify.

## Legal Notice

This Actor is designed for legitimate collection of publicly available review data. Users are responsible for using the data responsibly and for complying with applicable laws, Google's terms, and privacy rules. If you supply signed-in cookies, you are responsible for the account they belong to and for how the session is used.
