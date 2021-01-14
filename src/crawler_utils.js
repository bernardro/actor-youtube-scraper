const moment = require('moment');
const Apify = require('apify');
const Puppeteer = require('puppeteer');

const { log, sleep, puppeteer } = Apify.utils;

const utils = require('./utility');
const CONSTS = require('./consts');
const { handleErrorAndScreenshot } = require('./utility');

/**
 * @param {Puppeteer.Page} page
 * @param {Apify.RequestQueue} requestQueue
 * @param {any} input
 * @param {Apify.Request} request
 */
exports.handleMaster = async (page, requestQueue, input, request) => {
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
            page.waitForNavigation({ timeout: 5000 }),
        ]);

        // pause while page reloads
        await sleep(utils.getDelayMs(CONSTS.DELAY.HUMAN_PAUSE));

        log.debug('waiting for filter menu button...');
        const filterMenuElem = await page.waitForSelector(toggleFilterMenu, { visible: true });
        if (filterMenuElem) {
            log.debug(`expandFilterMenuBtn found at ${toggleFilterMenu}`);

            // for every filter:
            // - click on filter menu to expand it
            // - click on specific filter button to add the filter
            log.info(`[${search}]: Setting filters...`);
            const filtersToAdd = utils.getYoutubeDateFilters(input.postsFromDate);
            for (const filterLabel of filtersToAdd) {
                await page.tap(toggleFilterMenu);

                // wait for filter panel to show
                await page.waitForXPath(filterBtnsXp, { visible: true });

                const targetFilterXp = `${filterBtnsXp}[text()='${filterLabel}']`;
                await utils.moveMouseToElemXp(page, targetFilterXp, CONSTS.MOUSE_STEPS, 'Filter button');

                await Promise.all([
                    utils.clickHoveredElem(page, targetFilterXp),
                    page.waitForNavigation({ waitUntil: ['domcontentloaded'] }),
                ]);
            }
        }
    }

    const searchOrUrl = search || request.url;

    log.debug(`[${searchOrUrl}]: waiting for first video to load...`);
    const { youtubeVideosSection, youtubeVideosRenderer } = CONSTS.SELECTORS.SEARCH;
    const queuedVideos = await page.$$(`${youtubeVideosSection} ${youtubeVideosRenderer}`);

    // prepare to infinite scroll manually
    // puppeteer.infiniteScroll(page) is currently buggy
    // see https://github.com/apifytech/apify-js/issues/503
    await utils.moveMouseToCenterScreen(page, CONSTS.MOUSE_STEPS);

    // keep scrolling until no more videos or max limit reached
    if (queuedVideos.length === 0) {
        if (input.searchKeywords) {
            throw `[${searchOrUrl}]: Error: The keywords '${input.searchKeywords} returned no youtube videos, retrying...`;
        }
        throw `[${searchOrUrl}]: Error: No videos found`;
    }

    log.info(`[${searchOrUrl}]: Starting infinite scrolling downwards to load all the videos...`);

    const maxRequested = (input.maxResults && input.maxResults > 0) ? +input.maxResults : 99999;

    await utils.loadVideosUrls(requestQueue, page, maxRequested, ['MASTER', 'SEARCH'].includes(label), searchOrUrl);
};

exports.handleDetail = async (page, request, extendOutputFunction) => {
    const { titleXp, viewCountXp, uploadDateXp, likesXp, dislikesXp, channelXp, subscribersXp, descriptionXp, durationSlctr } = CONSTS.SELECTORS.VIDEO;

    log.info(`handling detail url ${request.url}`);

    const videoId = utils.getVideoId(request.url);
    log.debug(`got videoId as ${videoId}`);

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

    const description = await utils.getDataFromXpath(page, descriptionXp, 'innerHTML');
    const text = await utils.getDataFromXpath(page, descriptionXp, 'innerText');

    await extendOutputFunction({
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
        duration: durationStr,
        details: description,
        text,
    }, { page, request });
};

exports.hndlPptGoto = async ({ page, request }) => {
    await puppeteer.blockRequests(page, {
        urlPatterns: [
            '.mp4',
            '.webp',
            '.jpeg',
            '.jpg',
            '.gif',
            '.svg',
            '.ico',
            'google-analytics',
            'doubleclick.net',
            'googletagmanager',
            '/videoplayback',
            '/adview',
            '/stats/ads',
            '/stats/watchtime',
            '/stats/qoe',
            '/log_event',
        ]
    });
    return page.goto(request.url, { waitUntil: 'domcontentloaded' });
};

exports.hndlFaildReqs = async ({ request }) => {
    Apify.utils.log.error(`Request ${request.url} failed too many times`);
    await Apify.pushData({
        '#debug': Apify.utils.createRequestDebugInfo(request),
    });
};
