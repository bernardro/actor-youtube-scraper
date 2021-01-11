const Apify = require('apify');

const utils = require('./utility');
const crawler = require('./crawler_utils');

const { log } = Apify.utils;

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

        await requestQueue.addRequest({
            url: 'https://www.youtube.com/',
            userData: {
                label: 'MASTER',
                search: input.searchKeywords,
            },
        });
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
        },
    });

    const pptrCrawler = new Apify.PuppeteerCrawler({
        requestQueue,
        launchPuppeteerOptions: {
            stealth: true,
            useChrome: Apify.isAtHome(),
        },
        useSessionPool: true,
        proxyConfiguration: await Apify.createProxyConfiguration({ ...input.proxyConfiguration }),
        gotoFunction: crawler.hndlPptGoto,
        handlePageTimeoutSecs: 600,
        handleFailedRequestFunction: crawler.hndlFaildReqs,
        handlePageFunction: async ({ page, request, puppeteerPool, response }) => {
            // no-output function
            await extendScraperFunction(undefined, {
                page,
                request,
            });

            const hasCaptcha = await page.$('.g-recaptcha');
            if (hasCaptcha) {
                await puppeteerPool.retire(page.browser());
                throw 'Got captcha, page will be retried. If this happens often, consider increasing number of proxies';
            }

            if (utils.isErrorStatusCode(response.status())) {
                await puppeteerPool.retire(page.browser());
                throw `Response status is: ${response.status()} msg: ${response.statusText()}`;
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
        }
    });
    await pptrCrawler.run();
});
