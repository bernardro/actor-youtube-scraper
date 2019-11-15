# Actor - Youtube scraper

## Youtube scraper powered by Apify's puppeteer crawler

Youtube has an API that gives access to search data as well as detailed data on each video.  
This however requires you to log in and although it is free for now, they impose quota limits on each API endpoint.
This is understandable as it prevents abuse but it may be too restrictive or technical for simple use cases.  
  
The youtube API is designed for apps that manipulate and reuse the data programmatically, 
and apps that require detailed technical information.  

That is why this scraper was created and implemented as an "actor" on the Apify platform. At this time this actor allows you to:  
- Scrape videos by specifying search keyword(s) to get the following details:  
    
  `id`  
  `title`  
  `url`  
  `views`  
  `upload date`  
  `likes`  
  `dislikes`  
  `channel name`  
  `channel url`  
  `subscribers`  
  `details`  
  
- Limit the videos returned by upload date by entering date in an easy-read format e.g "2 weeks ago"  
- Limit the overall number of videos returned by entering a number e.g "50" videos maximum  

Features **not** available in this actor:
- Scraping comments on a video
- Scraping channel details

## Input parameters
The input of this actor should be JSON specifying what to search for on Youtube.  
If this actor is run on the Apify platform a user friendly graphical interface will be provided for you to configure the scraper before running it.  
This actor recognizes the following fields:  

| Field | Type | Description |  
| ----- | ---- | ----------- |  
| searchKeywords | String | (required) Query to search Youtube for |  
| maxResults | Integer | (optional) How many videos should be loaded from each search, default is 50, maximum is 999 |  
| postsFromDate | String | (optional) How far back in history to go, default is "5 years ago". You can also use *minutes*,*hours*,*days*,*weeks* and *months* |  
| startUrl | String | (required) Starting Youtube URLs, default is `https://youtube.com` |  
| proxyConfiguration | Object | Proxy configuration |  
| verboseLog | Boolean | Whether to turn on verbose logging |  
  
  
This solution requires the use of **Proxy servers**, either your own proxy servers or you can use <a href="https://www.apify.com/docs/proxy">Apify Proxy</a>.  
  
### Youtube scraper Input example  
```json
{
    "searchKeywords": "Terminator dark fate",
    "maxResults": 30,
    "postsFromDate": "2 weeks ago",
    "startUrl": "https://www.youtube.com",
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
