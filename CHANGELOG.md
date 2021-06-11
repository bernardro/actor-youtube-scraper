2021-06-11
*Features*:
- Subtitles are now downloadable (saved to KeyValueStore as `videoID_languageCode`)

2021-05-21
*Features*:
- Update SDK

*Fixes*
- Random zero results when searching
- Click consent dialog

2021-04-14
*Fixes*
- Fixed changed selector that completely prevented the scrape

2021-03-21
*Features*:
- Updated SDK version for session pool changes
- Add `handlePageTimeoutSecs` parameter to INPUT_SCHEMA


2021-03-15
*Fixes:*
- Fixed selector causing no data scraped
- Removed stealth causing issues with new layout

2020-09-27
- Increased waiting timeouts to better handle concurrency
- Added saving screenshots on errors
- Better handling of Captchas, a page is automatically retried and the browser is restarted with a new proxy
- `verboseLog` is off by default
- Added info how many videos were enqueued and overall better logging
