# Youtube Scraper

## Youtube Scraper powered by Apify's Puppeteer crawler

Youtube has an API that gives access to search data as well as detailed data on each video. However, it requires you to log in and imposes quota limits on each API endpoint.

That is why Youtube Scraper was created and implemented as an [actor](https://apify.com/actors) to run on the [Apify platform](https://apify.com). This scraper is open-source and you can easily run it locally or on your system. Contributions are welcome.

Features of Youtube Scraper:
- Scrape videos by specifying a search keyword(s) or URLs to get [video details](#scraper-output):
- Limit the videos returned by upload date by entering a date in an easy-read format e.g "2 weeks ago"
- Limit the number of videos returned for each search or channel (focusing on the top videos)

## Table of contents
- [Input parameters](#input-parameters)
- [During the run](#during-the-run)
- [Scraper output](#scraper-output)
- [Planned features](#planned-features)
- [Changelog](#changelog)
- [Notes for developers](#notes-for-developers)

## Input parameters
The input of this actor should be JSON specifying what to search for on Youtube.
If this actor is run on the Apify platform a user-friendly graphical interface will be provided for you to configure the scraper before running it.
This actor recognizes the following input fields:

| Field | Type | Description |
| ----- | ---- | ----------- |
| searchKeywords | String | (optional) Query to search Youtube for |
| maxResults | Integer | (optional) How many videos should be loaded from each search or channel, default is 50 |
| postsFromDate | String | (optional) How far back in history to go, default is "5 years ago". You can also use *minutes*,*hours*,*days*,*weeks* and *months* |
| startUrls | String | (optional) Starting Youtube URLs, you can provide search, channel or videos urls |
| proxyConfiguration | Object | Proxy configuration |
| verboseLog | Boolean | Whether to turn on verbose logging |


This solution requires the use of **Proxy servers**, either your own proxy servers or you can use <a href="https://www.apify.com/docs/proxy">Apify Proxy</a>.

### Youtube scraper Input example

```jsonc
{
    "searchKeywords": "Terminator dark fate",
    "maxResults": 30,
    "postsFromDate": "2 weeks ago",
    "startUrls": [{
        "url": "https://www.youtube.com/channel/UC8w/videos" // channel videos
    }, {
        "url": "https://www.youtube.com/results?search_query=finances" // search queries
    }, {
        "url": "https://www.youtube.com/watch?v=kJQP7kiw5Fk" // videos
    }],
    "proxyConfiguration": {
        "useApifyProxy": true
    },
    "verboseLog": false
}
```
## During the run

During the run, the actor will output messages letting you know what it is doing and which youtube URL is being processed.

If an error occurs there will be a detail error log in the run console as well as in the output dataset.


## Scraper output

As the actor runs, the actor stores results into a dataset. Each Youtube video becomes a separate item in the dataset (example below).

The actor converts Youtube data into a form that can be compared and analyzed as exemplified in the table below:

| # Likes | Output |
| ----- | ---- |
| 1.2M | 1200000 |
| 1.65K | 1650 |
| 1.65M | 1650000 |

The output can then be easily manipulated in any language (Python, PHP, Node JS/NPM).

See the <a href="https://www.apify.com/docs/api" target="blank">Apify API reference</a> to learn more about getting results from this Youtube actor.

Here is a sample of the output (long lines shortened):

```json
{
  "title": "Terminator: Dark Fate - Official Trailer (2019) - Paramount Pictures",
  "id": "oxy8udgWRmo",
  "url": "https://www.youtube.com/watch?v=oxy8udgWRmo",
  "viewCount": 15432,
  "date": "2019-08-29T00:00:00+00:00",
  "likes": 121000,
  "dislikes": 23000,
  "channelName": "Paramount Pictures",
  "channelUrl": "https://www.youtube.com/channel/UCF9imwPMSGz4Vq1NiTWCC7g",
  "numberOfSubscribers": 1660000,
  "details": "Welcome to the day after <a class=\"yt-simple-endpoint style-sco..."
}
```

## Planned features
- Scraping comments on a video
- Scraping channel details

## Changelog
Changes related to the new versions are listed in the [CHANGELOG.md](https://github.com/bernardro/actor-youtube-scraper/blob/master/CHANGELOG.md) file.

## Notes for developers

Typical usage on Apify platform using 4096MB for memory is shown below:

| Resource | Average | Max |
| ----- | ---- | ----------- |
| Memory | 480.3 MB | 1.1 GB |
| CPU | 53% | 140% |

This actor manipulates the mouse and keyboard like a real user would.

It uses xPaths to find DOM elements; they are all stored in one file for easy update.

All xPath variables and functions end in 'Xp'.

The logic of the actor makes use of Youtube's own date filters because:
 - Youtube does not by default show videos in chronological order.
   The order of videos is related to the number of likes, subscribers, etc.
 - There is no way to give Youtube an exact cutoff date (unless you use Youtube's developer API)
 - Youtube has a separate filter that toggles sorting by date

So when a user requests videos from "5 days ago", we apply Youtube's "This week" filter as well as the "Sort by Upload date" filter.

## Extend output function

Extend output function allows you to omit output, add some extra properties to the output by using the `page` variable or change the shape of your output altogether:

```js
async ({ item }) => {
    // remove information from the item
    item.details = undefined;
    // or delete item.details;
    return item;
}
```

```js
async ({ item, page }) => {
    // add more info, in this case, the shortLink for the video
    const shortLink = await page.evaluate(() => {
        const link = document.querySelector('link[rel="shortlinkUrl"]');
        if (link) {
            return link.href;
        }
    });

    return {
        ...item,
        shortLink,
    }
}
```

```js
async ({ item }) => {
    // omit item, just return null
    return null;
}
```

## Extend scraper function

Extend scraper function allows you to add functionality to the existing baseline behavior.

For example, you may enqueue related videos, but not recursively

```js
async ({ page, request, requestQueue, customData, Apify }) => {
    if (request.userData.label === 'DETAIL' && !request.userData.isRelated) {
        await page.waitForSelector('ytd-watch-next-secondary-results-renderer');

        const related = await page.evaluate(() => {
            return [...document.querySelectorAll('ytd-watch-next-secondary-results-renderer a[href*="watch?v="]')].map(a => a.href);
        });

        for (const url of related) {
            await requestQueue.addRequest({
                url,
                userData: {
                    label: 'DETAIL',
                    isRelated: true,
                },
            });
        }
    }
}
```

NB.: if this function throws, it will retry the same url it's visiting again
