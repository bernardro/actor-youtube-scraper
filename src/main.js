const Apify = require('apify');

const utils = require('./utility');
const crawler = require('./crawler_utils');

const { log } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getInput();

    const { verboseLog, startUrls = [] } = input;
    if (verboseLog) {
        log.setLevel(log.LEVELS.DEBUG);
    } else {
        log.setLevel(log.LEVELS.WARNING);
    }

    // launch options - puppeteer
    const pptrLaunchOpts = {};
    pptrLaunchOpts.stealth = true;
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
    pptrCrawlerOpts.handlePageFunction = async ({ page, request }) => {
        if (utils.isErrorStatusCode(request.statusCode)) {
            throw new Error(`Request error status code: ${request.statusCode} msg: ${request.statusMessage}`);
        }

        switch (request.userData.label) {
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

    // add starting url
    if (input.searchKeywords) {
        await requestQueue.addRequest({
            url: 'https://www.youtube.com/',
            userData: {
                label: 'MASTER',
                search: input.searchKeywords,
            },
        });
    }

    if (startUrls && startUrls.length) {
        const parseUrls = await Apify.openRequestList(null, startUrls);
        let req;
        // eslint-disable-next-line no-cond-assign
        while (req = await parseUrls.fetchNextRequest()) {
            // need to parse for requestsFromUrl first then categorize by path
            await requestQueue.addRequest({
                url: req.url,
                userData: {
                    label: req.url.includes('/watch') ? 'DETAIL' : 'MASTER',
                },
            });
        }
    }

    const pptrCrawler = new Apify.PuppeteerCrawler(pptrCrawlerOpts);
    await pptrCrawler.run();
});
