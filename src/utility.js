const moment = require('moment');
const Apify = require('apify');
const Puppeteer = require('puppeteer'); // eslint-disable-line

const { log, sleep } = Apify.utils;

const CONSTS = require('./consts');

exports.handleErrorAndScreenshot = async (page, e, errorName) => {
    await Apify.utils.puppeteer.saveSnapshot(page, { key: `ERROR-${errorName}-${Math.random()}`});
    throw `Error: ${errorName} - Raw error: ${e.message}`;
};

/**
 * @param {Apify.RequestQueue} requestQueue
 * @param {Puppeteer.Page} page
 * @param {number} maxRequested
 * @param {boolean} isSearchResultPage
 */
exports.loadVideosUrls = async (requestQueue, page, maxRequested, isSearchResultPage, searchOrUrl) => {
    const { youtubeVideosSection, youtubeVideosRenderer, url } = CONSTS.SELECTORS.SEARCH;

    log.debug('loadVideosUrls', { maxRequested });
    let shouldContinue = true;
    let videosEnqueued = 0;
    let videosEnqueuedUnique = 0;

    const logInterval = setInterval(
        () => log.info(`[${searchOrUrl}]: Scrolling state - Enqueued ${videosEnqueuedUnique} unique video URLs, ${videosEnqueued} total`),
        60000
    );

    try {
        while (shouldContinue) { // eslint-disable-line no-constant-condition
            // youtube keep adding video sections to the page on scroll
            const videoSections = await page.$$(youtubeVideosSection);

            for (const videoSection of videoSections) {
                // each section have around 20 videos
                const videos = await videoSection.$$(youtubeVideosRenderer);

                if (!videos.length) {
                    shouldContinue = false;
                    break;
                }

                for (const video of videos) {
                    await video.hover();

                    const rq = await requestQueue.addRequest({
                        url: await video.$eval(url, (el) => el.href),
                        userData: { label: 'DETAIL' },
                    });

                    videosEnqueued++;

                    if (!rq.wasAlreadyPresent) {
                        // count only unique videos
                        videosEnqueuedUnique++;
                    }

                    if (videosEnqueued > maxRequested) {
                        shouldContinue = false;
                        break;
                    }

                    await sleep(CONSTS.DELAY.HUMAN_PAUSE.max);

                    if (!isSearchResultPage) {
                        // remove the link on channels, so the scroll happens
                        await video.evaluate((el) => el.remove());
                    }
                }

                await sleep(CONSTS.DELAY.START_LOADING_MORE_VIDEOS);

                if (isSearchResultPage) {
                    // remove element after extracting result urls. removing it make the page scroll,
                    // and frees up memory. only delete nodes in search results
                    await videoSection.evaluate((el) => el.remove());
                }

                if (!shouldContinue) {
                    break;
                }
            }
        }
    } catch (e) {
        clearInterval(logInterval);
        throw e;
    }
    clearInterval(logInterval);
    log.info(`[${searchOrUrl}]: Scrolling finished - Enqueued ${videosEnqueuedUnique} unique video URLs, ${videosEnqueued} total`);
};

exports.getDataFromXpath = async (page, xPath, attrib) => {
    await page.waitForXPath(xPath, { timeout: 120000 });
    const xElement = await page.$x(xPath);
    return page.evaluate((el, key) => el[key], xElement[0], attrib);
};

exports.getDataFromSelector = async (page, slctr, attrib) => {
    const slctrElem = await page.waitForSelector(slctr, { visible: true, timeout: 120000 });
    return page.evaluate((el, key) => el[key], slctrElem, attrib);
};

/**
 * @param {string} url
 */
exports.categorizeUrl = (url) => {
    try {
        const pUrl = new URL(url, 'https://www.youtube.com');

        if (!pUrl.hostname.includes('youtube.com')) {
            throw new Error('Invalid youtube url');
        }

        let label = 'MASTER';

        if (pUrl.searchParams.get('v')) {
            label = 'DETAIL';
        } else if (pUrl.searchParams.get('search_query')) {
            label = 'SEARCH';
        } else if (pUrl.pathname.includes('/channel/') || pUrl.pathname.includes('/user/') || pUrl.pathname.includes('/c/')) {
            label = 'CHANNEL';
        }

        return label;
    } catch (e) {
        log.exception(e, 'categorizeUrl', { url });
        return null;
    }
};

exports.unformatNumbers = (numStr) => {
    const numberMatch = numStr.replace(/[^0-9,.]/ig, '');
    if (numberMatch) {
        const number = parseFloat(numberMatch.replace(/,/g, ''));
        const multiplierMatch = numStr.match(/(?<=[0-9 ])[mkb]/ig);

        if (multiplierMatch) {
            const multiplier = multiplierMatch[0].toUpperCase();
            switch (multiplier) {
                case 'K': {
                    return Math.round(number * 1000);
                }
                case 'M': {
                    return Math.round(number * 1000000);
                }
                case 'B': {
                    return Math.round(number * 1000000000);
                }
                default: throw new Error('Unhandled multiplier in getExpandedNumbers');
            }
        }

        return number;
    }

    // some videos may not have likes, views or channel subscribers
    return 0;
};

exports.moveMouseToElemXp = async (pptPage, xPath, mouseMoveSteps, name) => {
    const targetElem = await pptPage.waitForXPath(xPath, { visible: true });
    if (targetElem.length > 0) {
        log.debug(`${name} found at ${xPath}`);
    }

    const searchBoxRect = await targetElem.boundingBox();
    const { xPos, yPos } = exports.getRandClickPos(searchBoxRect);

    // pause like real user
    await Apify.utils.sleep(exports.getDelayMs(CONSTS.DELAY.HUMAN_PAUSE));

    // move mouse to target
    await pptPage.mouse.move(xPos, yPos, { steps: mouseMoveSteps });
};

exports.moveMouseToCenterScreen = async (pptPage, mouseMoveSteps) => {
    const viewPort = await pptPage.viewport();
    const { width, height } = viewPort;

    const xPos = Math.ceil(width / 2);
    const yPos = Math.ceil(height / 2);

    await pptPage.mouse.move(xPos, yPos, { steps: mouseMoveSteps });
};

exports.clickHoveredElem = async (pptPage, xPath) => {
    log.debug(`clicking on ${xPath}`);
    await pptPage.mouse.down();
    await Apify.utils.sleep(exports.getDelayMs(CONSTS.DELAY.MOUSE_CLICK));
    await pptPage.mouse.up();
};

exports.doTextInput = async (pptPage, keywords) => {
    for (let i = 0; i < keywords.length; i++) {
        await pptPage.keyboard.press(keywords[i]);
        await Apify.utils.sleep(exports.getDelayMs(CONSTS.DELAY.BTWN_KEY_PRESS));
    }
};

exports.getCutoffDate = (historyString) => {
    // input should have been validated
    // in format 'x minutes/hours/days/weeks/months/year ago'
    const matchNumbers = historyString.match(new RegExp('[0-9]+', 'ig'));
    const numDurations = parseInt(matchNumbers[0], 10);

    const matchDuration = historyString.match(new RegExp('(minute|hour|day|week|month|year)', 'ig'));
    const durationStr = matchDuration[0].toLowerCase();
    const durationType = `${durationStr}s`;

    return moment().subtract(numDurations, durationType);
};

exports.isDateInputValid = (postsFromDate) => {
    if (postsFromDate) {
        const matches = postsFromDate.match(/(^(1|([^0a-zA-Z ][0-9]{0,3})) (minute|hour|day|week|month|year))s? ago *$/ig);
        return !!matches;
    }

    return false;
};

exports.getYoutubeDateFilters = (postsFromDate) => {
    if (!exports.isDateInputValid(postsFromDate)) {
        return [];
    }

    const now = moment();
    const then = exports.getCutoffDate(postsFromDate);
    const duration = moment.duration(now.diff(then));

    const dateFilterMap = [
        { inTheLast: 'years', filter: null },
        { inTheLast: 'months', filter: 'This year' },
        { inTheLast: 'weeks', filter: 'This month' },
        { inTheLast: 'days', filter: 'This week' },
        { inTheLast: 'hours', filter: 'Today' },
        { inTheLast: 'minutes', filter: 'Last hour' },
    ];

    const youtubeFilters = [];
    // start with the longest duration
    for (let i = 0; i < dateFilterMap.length; i++) {
        const durType = dateFilterMap[i].inTheLast;
        const durCount = duration.as(durType);

        // e.g '2 days ago' results in 'This week' youtube filter being set
        if (durCount > 1) {
            if (dateFilterMap[i].filter) {
                youtubeFilters.push(dateFilterMap[i].filter);
            }
            break;
        }
    }

    if (youtubeFilters.length > 0) {
        // if we are using any of the youtube date filters
        // then we must also sort results by 'Upload date'
        youtubeFilters.push('Upload date');
    }

    return youtubeFilters;
};

exports.getVideoId = (videoUrl) => {
    const matches = videoUrl.match(/(?<=[/=])([0-9A-Za-z_-]{10,})[#/]?/ig);
    if (matches && matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];

            // two-stage regex to cover all current types of youtube URLs
            const matches2 = match.match(/[#/]/ig);
            if (!matches2 && match.length <= 12) {
                return match;
            }
        }
    }

    return '';
};

exports.getRandClickPos = (rect) => {
    const xBuffer = 0.7;
    const yBuffer = 0.4;

    // define an area well within the element's borders
    // we will be mouse-clicking within this region
    const clickableWidth = Math.ceil(xBuffer * (rect.width));
    const clickableHeight = Math.ceil(yBuffer * (rect.height));

    const randXoffset = exports.getRandBetween(1, clickableWidth);
    const randYoffset = exports.getRandBetween(1, clickableHeight);

    return { xPos: (rect.x + randXoffset), yPos: (rect.y + randYoffset) };
};

exports.isErrorStatusCode = (statusCode) => {
    if (statusCode) {
        const statusNum = parseInt(`${statusCode}`, 10);
        return statusNum >= 400;
    }

    return false;
};

exports.getMaxVideos = (numOfVideos, userMaximum) => {
    if (userMaximum > 0) {
        if (userMaximum > numOfVideos) {
            log.info(`user requested ${userMaximum} videos but only ${numOfVideos} were loaded`);
            return numOfVideos;
        }

        return userMaximum;
    }

    // no user imposed limit
    return numOfVideos;
};

exports.getRandBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

exports.getDelayMs = (minMax) => {
    return exports.getRandBetween(minMax.min, minMax.max);
};
