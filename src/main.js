const Apify = require('apify');

const utils = require('./utility');
const crawler = require('./crawler_utils');

const { log, puppeteer } = Apify.utils;

Apify.main(async () => {
    /**
     * @type {any}
     */
    const input = await Apify.getInput();

    const { verboseLog, startUrls = [] } = input;
    if (verboseLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    const requestQueue = await Apify.openRequestQueue();
    const proxyConfig = await utils.proxyConfiguration({
        proxyConfig: input.proxyConfiguration,
    });

    if (!input.searchKeywords && (!startUrls || !startUrls.length)) {
        throw new Error('You need to provide either searchKeywords or startUrls as input');
    }

    if (startUrls && startUrls.length) {
        log.info('Starting scraper with startUrls, ignoring searchKeywords');

        const parseUrls = await Apify.openRequestList(null, startUrls);
        let req;
        // eslint-disable-next-line no-cond-assign
        while (req = await parseUrls.fetchNextRequest()) {
            // need to parse for requestsFromUrl first then categorize by path
            const label = utils.categorizeUrl(req.url);
            const pUrl = new URL(req.url);

            if (label === 'CHANNEL' && !pUrl.pathname.includes('/videos')) {
                pUrl.pathname = `${pUrl.pathname.split('/').filter((s) => s).join('/')}/videos`;
                req.url = pUrl.toString();
            }

            await requestQueue.addRequest({
                url: req.url,
                userData: {
                    label,
                },
            });
        }
    } else if (input.searchKeywords) {
        // add starting url
        log.info('Starting scraper with a search keyword');

        for (let searchKeyword of input.searchKeywords.split(',')) {
            searchKeyword = `${searchKeyword}`.trim();

            if (searchKeyword) {
                await requestQueue.addRequest({
                    url: 'https://www.youtube.com/',
                    uniqueKey: `SEARCH-${searchKeyword}`,
                    userData: {
                        label: 'MASTER',
                        search: searchKeyword.trim(),
                    },
                });
            }
        }
    }

    const extendOutputFunction = await utils.extendFunction({
        input,
        key: 'extendOutputFunction',
        output: async (data) => {
            await Apify.pushData(data);
        },
        helpers: {},
    });

    const extendScraperFunction = await utils.extendFunction({
        input,
        key: 'extendScraperFunction',
        output: async () => {}, // no-op for page interaction
        helpers: {
            requestQueue,
            extendOutputFunction,
        },
    });

    const pptrCrawler = new Apify.PuppeteerCrawler({
        requestQueue,
        launchPuppeteerOptions: {
            stealth: true,
            useChrome: Apify.isAtHome(),
        },
        puppeteerPoolOptions: {
            maxOpenPagesPerInstance: 1,
        },
        useSessionPool: true,
        proxyConfiguration: proxyConfig,
        gotoFunction: async ({ page, request, session, puppeteerPool }) => {
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
                ],
            });

            try {
                // await here so we can catch the timeout
                return await page.goto(request.url, {
                    waitUntil: 'networkidle2',
                    timeout: 60000,
                });
            } catch (e) {
                // slow proxies must go
                session.retire();
                await puppeteerPool.retire(page.browser());
                throw e;
            }
        },
        handlePageTimeoutSecs: 600,
        handleFailedRequestFunction: async ({ request }) => {
            Apify.utils.log.error(`Request ${request.url} failed too many times`);

            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
        handlePageFunction: async ({ page, request, puppeteerPool, session, response }) => {
            // no-output function
            await extendScraperFunction(undefined, {
                page,
                request,
            });

            try {
                const hasCaptcha = await page.$('.g-recaptcha');
                if (hasCaptcha) {
                    throw 'Got captcha, page will be retried. If this happens often, consider increasing number of proxies';
                }

                if (utils.isErrorStatusCode(response.status())) {
                    throw `Response status is: ${response.status()} msg: ${response.statusText()}`;
                }

                if (await page.$('.yt-upsell-dialog-renderer')) {
                    // this dialog steal focus, so need to click it
                    await page.evaluate(async () => {
                        const noThanks = document.querySelectorAll('.yt-upsell-dialog-renderer [role="button"]');

                        for (const button of noThanks) {
                            if (button.textContent && button.textContent.includes('No thanks')) {
                                button.click();
                                break;
                            }
                        }
                    });
                }

                switch (request.userData.label) {
                    case 'CHANNEL':
                    case 'SEARCH':
                    case 'MASTER': {
                        await crawler.handleMaster(page, requestQueue, input, request);
                        break;
                    }
                    case 'DETAIL': {
                        await crawler.handleDetail(page, request, extendOutputFunction);
                        break;
                    }
                    default: throw new Error('Unknown request label in handlePageFunction');
                }
            } catch (e) {
                session.retire();
                await puppeteerPool.retire(page.browser());
                throw e;
            }
        },
    });
    await pptrCrawler.run();
});
