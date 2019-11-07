# Actor - Youtube scraper

## Youtube scraper powered by Apifys pupetteer crawler

Youtube has an API that gives access to search data as well as detailed data on each video.  
This however requires you to log in and although it is free for now, the API limits each user to a quota.  
The youtube API is mainly designed for apps that reuse the data.  

At this time this youtube scraper allow you to:  
- Scrape videos by specifying search keyword(s) and get:  
    
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
  
- Limit the videos returned by upload date by entering friendly parameters like "2 weeks ago"  
- Limit the overall number of videos returned by entering a number like "50" videos maximum  

Features **not** available in this scraper:
- Scraping comments on a video
- Scraping channel details

## Input parameters
The input of this scraper should be JSON specifying what to search for on Youtube.  
If this actor is run on the Apify platform a user friendly graphical interface will be provided for you to configure the scraper before running it.  
This actor recognizes the following fields:  

| Field | Type | Description |  
| ----- | ---- | ----------- |  
| searchKeywords | String | (required) Query to search Youtube for |  
| maxResults | Integer | (required) How many videos should be loaded from each search, default is 50, maximum is 999 |  
| postsFromDate | String | (required) How far back in history to go, e.g "2 years ago" or "5 months ago". You can use *minutes*,*hours*,*days*,*weeks*,*months* and *years* |  
| startUrl | String | (optional) Starting Youtube URLs, default is `https://youtube.com` |  
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

## Sample scraper output

As the scraper runs, the actor stores results into a dataset. Each item is a separate item in the dataset.

The actor converts Youtubes data into a form that can be analysed and compared. E.g `1.2M` likes is converted into `1200000` likes. 

The output can be manipulated in any language (Python, PHP, Node JS/NPM). See the FAQ or <a href="https://www.apify.com/docs/api" target="blank">our API reference</a> to learn more about getting results from this Youtube actor.

Here is a sample of the output (with long lines shortened):  
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
