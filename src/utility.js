const moment = require('moment');
const Apify = require('apify');

const { log, sleep, puppeteer } = Apify.utils;

const CONSTS = require('./consts');

exports.handleMaster = async (page, requestQueue, input) => {
    const { searchBox, toggleFilterMenu, filterBtnsXp, youtubeVideosXp, urlXp } = CONSTS.SELECTORS.SEARCH;

    log.debug('waiting for input box...');
    const searchBxElem = await page.waitForSelector(searchBox, { visible: true });
    if (searchBxElem) {
        log.debug(`searchBoxInput found at ${searchBox}`);
    }

    // search for input box and move mouse over it
    await page.tap(searchBox);

    log.info('entering search text...');
    await exports.doTextInput(page, input.searchKeywords);

    // submit search and wait for results page (and filter button) to load
    log.info('submit search...');
    await page.keyboard.press('Enter', { delay: exports.getDelayMs(CONSTS.DELAY.KEY_PRESS) });

    // pause while page reloads
    await sleep(exports.getDelayMs(CONSTS.DELAY.HUMAN_PAUSE));

    log.debug('waiting for filter menu button...');
    const filterMenuElem = await page.waitForSelector(toggleFilterMenu, { visible: true });
    if (filterMenuElem) {
        log.debug(`expandFilterMenuBtn found at ${toggleFilterMenu}`);
    }

    // for every filter:
    // - click on filter menu to expand it
    // - click on specific filter button to add the filter
    log.info('setting filters...');
    const filtersToAdd = exports.getYoutubeDateFilters(input.postsFromDate);
    for (const filterLabel of filtersToAdd) {
        page.tap(toggleFilterMenu);

        // wait for filter panel to show
        await page.waitForXPath(filterBtnsXp, { visible: true });

        const targetFilterXp = `${filterBtnsXp}[text()='${filterLabel}']`;
        await exports.moveMouseToElemXp(page, targetFilterXp, CONSTS.MOUSE_STEPS, 'Filter button');

        await Promise.all([
            exports.clickHoveredElem(page, targetFilterXp),
            page.waitForNavigation({ waitUntil: ['domcontentloaded'] }),
        ]);
    }

    log.debug('waiting for first video to load after filtering...');
    await page.waitForXPath(youtubeVideosXp, { visible: true });

    // prepare to infinite scroll manually
    // puppeteer.infiniteScroll(page) is currently buggy
    // see https://github.com/apifytech/apify-js/issues/503
    await exports.moveMouseToCenterScreen(page, CONSTS.MOUSE_STEPS);

    log.info('start infinite scrolling downwards to load all the videos...');
    const loadedVideos = await page.$x(youtubeVideosXp);
    const startingNumVideos = loadedVideos.length;

    // keep scrolling until no more videos or max limit reached
    if (startingNumVideos === 0) {
        throw new Error(`The keywords '${input.searchKeywords} return no youtube videos, try a different search`);
    }

    const maxResults = (input.maxResults && input.maxResults > 0) ? input.maxResults : 999;
    let latestNumVideos = startingNumVideos;
    let latestLoadedVideos = [];
    do {
        const lastVideoXp = `${youtubeVideosXp}[${latestNumVideos}]`;

        await page.waitForXPath(lastVideoXp, { visible: true });
        const lastVideo = await page.$x(lastVideoXp);
        await lastVideo[0].hover();

        // we have scrolled to last video
        // pause for youtube to *start* loading more videos
        await sleep(CONSTS.DELAY.START_LOADING_MORE_VIDEOS);

        latestLoadedVideos = await page.$x(youtubeVideosXp);
        latestNumVideos = latestLoadedVideos.length;
    } while ((latestNumVideos > startingNumVideos) && (latestNumVideos < maxResults));

    log.info('infinite scroll done, enqueueing video links...');
    const maxVideos = exports.getMaxVideos(latestNumVideos, maxResults);
    for (let i = 0; i < maxVideos; i++) {
        const latestVideoUrls = await latestLoadedVideos[i].$x(urlXp);
        const url = await page.evaluate(el => el.href, latestVideoUrls[0]);
        await requestQueue.addRequest({ url, userData: { label: 'DETAIL' } });
    }
};

exports.handleDetail = async (page, request) => {
    const { titleXp, viewCountXp, uploadDateXp, likesXp, dislikesXp, channelXp, subscribersXp, descriptionXp } = CONSTS.SELECTORS.VIDEO;

    log.info(`handling detail url ${request.url}`);

    const videoId = exports.getVideoId(request.url);
    log.debug(`got videoId as ${videoId}`);

    log.debug(`searching for title at ${titleXp}`);
    const title = await exports.getDataFromXpath(page, titleXp, 'innerHTML');
    log.debug(`got title as ${title}`);

    log.debug(`searching for viewCount at ${viewCountXp}`);
    const viewCountStr = await exports.getDataFromXpath(page, viewCountXp, 'innerHTML');
    const viewCount = exports.unformatNumbers(viewCountStr);
    log.debug(`got viewCount as ${viewCount}`);

    log.debug(`searching for uploadDate at ${uploadDateXp}`);
    const uploadDateStr = await exports.getDataFromXpath(page, uploadDateXp, 'innerHTML');
    const uploadDate = moment(uploadDateStr, 'MMM DD, YYYY').format();
    log.debug(`got uploadDate as ${uploadDate}`);

    log.debug(`searching for likesCount at ${likesXp}`);
    const likesStr = await exports.getDataFromXpath(page, likesXp, 'innerHTML');
    const likesCount = exports.unformatNumbers(likesStr);
    log.debug(`got likesCount as ${likesCount}`);

    log.debug(`searching for dislikesCount at ${dislikesXp}`);
    const dislikesStr = await exports.getDataFromXpath(page, dislikesXp, 'innerHTML');
    const dislikesCount = exports.unformatNumbers(dislikesStr);
    log.debug(`got dislikesCount as ${dislikesCount}`);

    log.debug(`searching for channel details at ${channelXp}`);
    const channelName = await exports.getDataFromXpath(page, channelXp, 'innerHTML');
    log.debug(`got channelName as ${channelName}`);
    const channelUrl = await exports.getDataFromXpath(page, channelXp, 'href');
    log.debug(`got channelUrl as ${channelUrl}`);

    log.debug(`searching for numberOfSubscribers at ${subscribersXp}`);
    const subscribersStr = await exports.getDataFromXpath(page, subscribersXp, 'innerHTML');
    const numberOfSubscribers = exports.unformatNumbers(subscribersStr.replace(/subscribers/ig, '').trim());
    log.debug(`got numberOfSubscribers as ${numberOfSubscribers}`);

    const description = await exports.getDataFromXpath(page, descriptionXp, 'innerHTML');

    await Apify.pushData({
        title,
        id: videoId,
        url: request.url,
        viewCount,
        date: uploadDate,
        likes: likesCount,
        dislikes: dislikesCount,
        channelName,
        channelUrl,
        numberOfSubscribers,
        details: description,
    });
};

exports.getDataFromXpath = async (page, xPath, attrib) => {
    await page.waitForXPath(xPath);
    const xElement = await page.$x(xPath);
    return page.evaluate((el, key) => el[key], xElement[0], attrib);
};

exports.unformatNumbers = (numStr) => {
    const numberMatch = numStr.replace(/[^0-9,.]/ig, '');
    if (numberMatch) {
        const number = parseFloat(numberMatch.replace(',', ''));
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

exports.hndlPptGoto = async ({ page, request }) => {
    await puppeteer.addInterceptRequestHandler(page, (req) => {
        const resType = req.resourceType();
        if (resType in CONSTS.MEDIA_TYPES) {
            return request.abort();
        }

        req.continue();
    });

    return page.goto(request.url, { waitUntil: 'domcontentloaded' });
};

exports.hndlPptLnch = (launchOpts) => {
    return Apify.launchPuppeteer(launchOpts);
};

exports.hndlFaildReqs = async ({ request }) => {
    Apify.utils.log.error(`Request ${request.url} failed too many times`);
    await Apify.pushData({
        '#debug': Apify.utils.createRequestDebugInfo(request),
    });
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
    const matches = postsFromDate.match(/(^(1|([^0a-zA-Z ][0-9]{0,3})) (minute|hour|day|week|month|year))s? ago *$/ig);
    return !!matches;
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
