/* eslint-disable max-len */
const moment = require('moment');
const Apify = require('apify');
// eslint-disable-next-line no-unused-vars
const Puppeteer = require('puppeteer');

const { log, sleep } = Apify.utils;

const utils = require('./utility');
const CONSTS = require('./consts');
const { handleErrorAndScreenshot, unformatNumbers } = require('./utility');
const { fetchSubtitles, processFetchedSubtitles } = require('./subtitles');

/**
 * @param {{
 *  page: Puppeteer.Page,
 *  requestQueue: Apify.RequestQueue,
 *  searchKeywords: string[],
 *  maxResults: number,
 *  request: Apify.Request,
 *  simplifiedInformation: boolean,
 *  input: object,
 * }} config
 */
exports.handleMaster = async ({ page, requestQueue, searchKeywords, maxResults, request, simplifiedInformation, input }) => {
    const { searchBox, toggleFilterMenu, filterBtnsXp } = CONSTS.SELECTORS.SEARCH;
    const { search, label } = request.userData;

    // Searching only if search was directly provided on input, for other Start URLs, we go directly to scrolling
    if (search && label === 'MASTER') {
        // we are searching
        log.debug('waiting for input box...');
        const searchBxElem = await page.waitForSelector(searchBox, { visible: true });
        if (searchBxElem) {
            log.debug(`[${search}]: searchBoxInput found at ${searchBox}`);
        }

        log.info(`[${search}]: Entering search text...`);
        await utils.doTextInput(page, search);

        // submit search and wait for results page (and filter button) to load
        log.info(`[${search}]: Submiting search...`);

        await Promise.allSettled([
            page.tap('#search-icon-legacy'),
            page.waitForNavigation({ timeout: 15000 }),
        ]);

        // pause while page reloads
        await sleep(utils.getDelayMs(CONSTS.DELAY.HUMAN_PAUSE));
    }

    const searchOrUrl = search || request.url;

    log.debug(`[${searchOrUrl}]: waiting for first video to load...`);
    const { youtubeVideosSection, youtubeVideosRenderer } = CONSTS.SELECTORS.SEARCH;
    // static wait to ensure the page is loaded, networkidle2 sometimes not working?
    await page.waitForTimeout(CONSTS.DELAY.START_LOADING_MORE_VIDEOS);
    const queuedVideos = await page.$$(`${youtubeVideosSection} ${youtubeVideosRenderer}`);

    // prepare to infinite scroll manually
    // puppeteer.infiniteScroll(page) is currently buggy
    // see https://github.com/apifytech/apify-js/issues/503
    await utils.moveMouseToCenterScreen(page, CONSTS.MOUSE_STEPS);

    // keep scrolling until no more videos or max limit reached
    if (queuedVideos.length === 0) {
        if (searchKeywords) {
            throw `[${searchOrUrl}]: Error: The keywords '${searchKeywords} returned no youtube videos, retrying...`;
        }
        throw `[${searchOrUrl}]: Error: No videos found`;
    }

    log.info(`[${searchOrUrl}]: Starting infinite scrolling downwards to load all the videos...`);

    const maxRequested = (maxResults && maxResults > 0) ? +maxResults : 99999;

    const basicInfoParams = {
        page,
        maxRequested,
        isSearchResultPage: ['SEARCH'].includes(label),
        input,
        requestUrl: request.url,
    };

    const loadVideosUrlsParams = {
        requestQueue,
        page,
        maxRequested,
        isSearchResultPage: ['MASTER', 'SEARCH'].includes(label),
        searchOrUrl,
    };

    if (!simplifiedInformation) {
        await utils.loadVideosUrls(loadVideosUrlsParams);
    } else {
        await getBasicInformation(basicInfoParams);
    }
};

exports.handleDetail = async (page, request, extendOutputFunction, subtitlesSettings, maxComments) => {
    const { titleXp, viewCountXp, uploadDateXp, likesXp, dislikesXp,
        channelXp, subscribersXp, descriptionXp, durationSlctr, commentsSlctr } = CONSTS.SELECTORS.VIDEO;

    log.info(`handling detail url ${request.url}`);
    // Need to scroll twice to get comments. One scroll works locally, but by 17.05.2022 need to scroll twice for platform.
    await page.evaluate(() => {
        window.scrollBy(window.innerWidth, window.innerHeight);
    });

    await sleep(CONSTS.DELAY.START_LOADING_MORE_VIDEOS);

    await page.evaluate(() => {
        window.scrollBy(window.innerWidth, window.innerHeight);
    });

    const videoId = utils.getVideoId(request.url);
    log.debug(`got videoId as ${videoId}`);

    // TODO: These getDataFromXpath are bad design as any missing selector with crash the whole page
    // Should instead use JQuery or be try/catched
    log.debug(`searching for title at ${titleXp}`);
    const title = await utils.getDataFromXpath(page, titleXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-title-failed'));
    log.debug(`got title as ${title}`);

    log.debug(`searching for viewCount at ${viewCountXp}`);
    const viewCountStr = await utils.getDataFromXpath(page, viewCountXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-viewCount-failed'));
    const viewCount = utils.unformatNumbers(viewCountStr);
    log.debug(`got viewCount as ${viewCountStr} -> ${viewCount}`);

    log.debug(`searching for uploadDate at ${uploadDateXp}`);
    const uploadDateStr = await utils.getDataFromXpath(page, uploadDateXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-uploadDate-failed'));
    const uploadDateCleaned = uploadDateStr.replace('Premiered', '').trim();
    const uploadDate = moment(uploadDateCleaned, 'MMM DD, YYYY').format();
    log.debug(`got uploadDate as ${uploadDate}, uploadDateStr: ${uploadDateStr}, uploadDateCleaned: ${uploadDateCleaned}`);

    log.debug(`searching for likesCount at ${likesXp}`);
    const likesStr = await utils.getDataFromXpath(page, likesXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-likesCount-failed'));
    const likesCount = utils.unformatNumbers(likesStr);
    log.debug(`got likesCount as ${likesCount}`);

    log.debug(`searching for dislikesCount at ${dislikesXp}`);
    const dislikesStr = await utils.getDataFromXpath(page, dislikesXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-dislikesCount-failed'));
    const dislikesCount = utils.unformatNumbers(dislikesStr);
    log.debug(`got dislikesCount as ${dislikesCount}`);

    log.debug(`searching for channel details at ${channelXp}`);
    const channelName = await utils.getDataFromXpath(page, channelXp, 'innerHTML')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-channelName-failed'));
    log.debug(`got channelName as ${channelName}`);
    const channelUrl = await utils.getDataFromXpath(page, channelXp, 'href')
        .catch((e) => handleErrorAndScreenshot(page, e, 'Getting-channelUrl-failed'));
    log.debug(`got channelUrl as ${channelUrl}`);

    log.debug(`searching for numberOfSubscribers at ${subscribersXp}`);
    const subscribersStr = await utils.getDataFromXpath(page, subscribersXp, 'innerHTML');
    const numberOfSubscribers = utils.unformatNumbers(subscribersStr.replace(/subscribers/ig, '').trim());
    log.debug(`got numberOfSubscribers as ${numberOfSubscribers}`);

    log.debug(`searching for videoDuration at ${durationSlctr}`);
    const durationStr = await utils.getDataFromSelector(page, durationSlctr, 'innerHTML');
    log.debug(`got videoDuration as ${durationStr}`);

    const commentsText = await page.$eval('#comments #contents', (el) => el.textContent);
    const commentsTurnedOff = commentsText?.trim().startsWith('Comments are turned off');
    log.debug(`searching for comments Count at ${commentsSlctr}`);

    const commentsCount = commentsTurnedOff
        ? 0
        : await utils.getDataFromSelector(page, commentsSlctr, 'innerText');
    log.debug(`got comments Count as ${commentsCount}`);

    const description = await utils.getDataFromXpath(page, descriptionXp, 'innerHTML');
    const text = await utils.getDataFromXpath(page, descriptionXp, 'innerText');

    let subtitles = null;
    if (subtitlesSettings.doDownload) {
        const converters = await fetchSubtitles(
            page, subtitlesSettings.language, subtitlesSettings.preferAutoGenerated,
        );
        subtitles = await processFetchedSubtitles(page, videoId, converters, subtitlesSettings);
    }

    let comments = null;
    if (maxComments > 0) {
        comments = await utils.getVideoComments(page, maxComments);
    }

    await extendOutputFunction({
        title,
        id: videoId,
        url: request.url,
        viewCount,
        date: uploadDate,
        likes: likesCount,
        dislikes: null,
        channelName,
        channelUrl,
        numberOfSubscribers,
        duration: durationStr,
        commentsCount: commentsCount ? parseInt(commentsCount.replace(/\D/g, ''), 10) : null,
        details: description,
        text,
        subtitles,
        comments,
        commentsTurnedOff,
    }, { page, request });
};

/**
 * @param {{
 * page: Puppeteer.Page
 * maxRequested: number
 * isSearchResultPage: boolean
 * input: object
 * requestUrl: string
 * }} basicInfoParams
 */

const getBasicInformation = async (basicInfoParams) => {
    const { page, maxRequested, isSearchResultPage, input, requestUrl } = basicInfoParams;
    const { youtubeVideosSection, youtubeVideosRenderer, url, videoTitle, channelNameText, subscriberCount, canonicalUrl,
        simlifiedResultChannelUrl, simplifiedResultChannelName, simplifiedResultDate, simplifiedResultDurationText, simplifiedResultVideoTitle, simplifiedResultViewCount,
    } = CONSTS.SELECTORS.SEARCH;

    const extendOutputFunction = await utils.extendFunction({
        input,
        key: 'extendOutputFunction',
        output: async (data) => {
            await Apify.pushData(data);
        },
        helpers: {},
    });

    log.debug('loadVideosUrls', { maxRequested });
    let shouldContinue = true;
    let videoAmount = 0;

    const logInterval = setInterval(
        () => log.info(`Scrolling state - Pushed ${videoAmount} unique videos total`),
        60000,
    );

    let channelUrl; let numberOfSubscribers; let
        channelName;

    if (requestUrl.includes('/channel/') || (requestUrl.includes('/user/') && requestUrl.includes('videos'))) {
        channelUrl = await page.$eval(canonicalUrl, (el) => el.href);
        const subscribersStr = await page.$eval(subscriberCount, (el) => el.innerText.replace(/subscribers/ig, '').trim());
        numberOfSubscribers = unformatNumbers(subscribersStr);
        channelName = await page.$eval(channelNameText, (el) => el.innerText);
    }

    try {
        while (shouldContinue) { // eslint-disable-line no-constant-condition
            // youtube keep adding video sections to the page on scroll
            await page.waitForSelector(youtubeVideosSection);
            const videoSections = await page.$$(youtubeVideosSection);

            log.debug('Video sections', { shouldContinue, videoSections: videoSections.length });
            let videoCount = 0;

            for (const videoSection of videoSections) {
                // each section have around 20 videos
                await page.waitForSelector(youtubeVideosRenderer);
                const videos = await videoSection.$$(youtubeVideosRenderer);

                log.debug('Videos count', { shouldContinue, videos: videos.length });

                for (const video of videos) {
                    let title;
                    try {
                        await video.hover();
                    } catch (e) {}

                    if (channelUrl) {
                        const videoUrl = await video.$eval(url, (el) => el.href);
                        const videoId = utils.getVideoId(videoUrl);
                        title = await video.$eval(videoTitle, (el) => el.title);
                        const videoDetails = await video.$eval(videoTitle, (el) => el.ariaLabel) || '';

                        const videoDetailsArray = videoDetails.replace(title, ``).replace(`by ${channelName}`, ``).split(' ').filter((item) => item);
                        let simplifiedDate = videoDetailsArray.slice(0, videoDetailsArray.indexOf('ago') + 1)
                            .slice(-3).join(' ');
                        const viewCount = +videoDetailsArray[videoDetailsArray.length - 2].replace(/\D/g, '');
                        let durationRaw = videoDetailsArray.slice(6, videoDetailsArray.length - 2).join(' ');

                        let duration;
                        let isError = false;

                        try {
                            duration = await video.$eval(`span[aria-label="${durationRaw}"]`, (el) => el.innerText);
                        } catch (e) {
                            console.log(`Couldn't parse duration, sending the raw duration`);
                            isError = true;
                        }


                        // second attempt to get the duration from the alternative version
                        if (isError) {
                            try {
                                console.log(`Trying to parse alternative duration`);
                                durationRaw = videoDetailsArray.slice(videoDetailsArray.indexOf('ago') + 1, -2).join(' ');
                                duration = await video.$eval(`span[aria-label="${durationRaw}"]`, (el) => el.innerText);
                            } catch (e) {
                                console.log(`Couldn't parse duration, sending the raw duration`);
                                duration = durationRaw;
                            }
                        }

                        videoAmount++;

                        await extendOutputFunction({
                            title,
                            id: videoId,
                            url: videoUrl,
                            viewCount,
                            date: simplifiedDate,
                            channelName,
                            channelUrl,
                            numberOfSubscribers,
                            duration,
                        });
                    } else {
                        try {
                            title = await video.$eval(simplifiedResultVideoTitle, (el) => el.innerText);
                            const videoUrl = await video.$eval(simplifiedResultVideoTitle, (el) => el.href);
                            const duration = await video.$eval(simplifiedResultDurationText, (el) => el.innerText);
                            const channelName = await video.$eval(simplifiedResultChannelName, (el) => el.innerText);
                            const channelUrl = await video.$eval(simlifiedResultChannelUrl, (el) => el.href);
                            const viewCountRaw = await video.$eval(simplifiedResultViewCount, (el) => el.innerText);
                            const viewCount = unformatNumbers(viewCountRaw);
                            const date = await video.$eval(simplifiedResultDate, (el) => el.innerText);

                            videoAmount++;

                            await extendOutputFunction({
                                title,
                                id: videoUrl.split('v=')[1],
                                url: videoUrl,
                                viewCount,
                                date,
                                channelName,
                                channelUrl,
                                duration,
                            });
                        } catch (e) {
                            log.warning(e);
                        }
                    }

                    if (videoAmount >= maxRequested) {
                        shouldContinue = false;
                        break;
                    }

                    await sleep(CONSTS.DELAY.HUMAN_PAUSE.MAX);

                    if (!isSearchResultPage) {
                        // remove the link on channels, so the scroll happens
                        await video.evaluate((el) => el.remove());
                    }

                    videoCount++;

                    log.info(`Adding simplified video data: ${title}`);

                    await sleep(CONSTS.DELAY.START_LOADING_MORE_VIDEOS);
                }

                if (!shouldContinue) {
                    break;
                }
            }

            if (!videoCount) {
                shouldContinue = false;
                break;
            }
        }
    } catch (e) {
        clearInterval(logInterval);
        log.warning(e);
    }
    clearInterval(logInterval);
};
