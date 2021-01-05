const Apify = require('apify');

const utils = require('./utility');
const crawler = require('./crawler_utils');

const { log } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getInput();

    const { verboseLog, startUrls = [] } = input;
    if (verboseLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    // launch options - puppeteer
    const pptrLaunchOpts = {};
    pptrLaunchOpts.stealth = false; // TODO: change back when this is fixed, disable for increased performance
    pptrLaunchOpts.useChrome = Apify.isAtHome();

    const requestQueue = await Apify.openRequestQueue();

    /**
     * @type {Apify.PuppeteerCrawlerOptions}
     */
    const pptrCrawlerOpts = {};
    pptrCrawlerOpts.requestQueue = requestQueue;
    pptrCrawlerOpts.launchPuppeteerOptions = pptrLaunchOpts;
    pptrCrawlerOpts.useSessionPool = true;
    pptrCrawlerOpts.proxyConfiguration = await Apify.createProxyConfiguration({ ...input.proxyConfiguration });

    pptrCrawlerOpts.launchPuppeteerFunction = crawler.hndlPptLnch;
    pptrCrawlerOpts.gotoFunction = crawler.hndlPptGoto;
    pptrCrawlerOpts.handlePageTimeoutSecs = 3600;
    pptrCrawlerOpts.handleFailedRequestFunction = crawler.hndlFaildReqs;
    pptrCrawlerOpts.handlePageFunction = async ({ page, request, puppeteerPool, response }) => {
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
                await crawler.handleDetail(page, request);
                break;
            }
            default: throw new Error('Unknown request label in handlePageFunction');
        }
    };

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

    const pptrCrawler = new Apify.PuppeteerCrawler(pptrCrawlerOpts);
    await pptrCrawler.run();
});
