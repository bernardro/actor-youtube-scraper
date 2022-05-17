exports.DELAY = {
    KEY_PRESS: { MIN: 5, MAX: 25 },
    BTWN_KEY_PRESS: { MIN: 45, MAX: 375 },
    MOUSE_CLICK: { MIN: 40, MAX: 150 },
    HUMAN_PAUSE: { MIN: 300, MAX: 800 },
    START_LOADING_MORE_VIDEOS: 3000,
};

exports.MOUSE_STEPS = 5;

// 'document', 'image', 'xhr', 'script', 'stylesheet', 'font', 'other', 'manifest'
exports.MEDIA_TYPES = ['image'];

exports.LABELS = {
    DETAIL: 'DETAIL',
    MASTER: 'MASTER',
    CHANNEL: 'CHANNEL',
    SEARCH: 'SEARCH',
};

exports.SELECTORS = {
    SEARCH: {
        searchBox: 'input#search',
        toggleFilterMenu: '#button[aria-label="Search filters"]',
        filterBtnsXp: '//ytd-search-filter-renderer/a/div/yt-formatted-string',
        youtubeVideosSection: 'ytd-item-section-renderer',
        youtubeVideosRenderer: 'ytd-video-renderer,ytd-grid-video-renderer', // grid is for channels
        url: 'a[href^="/watch"]',
        videoTitle: '#video-title',
        channelNameText: '#channel-name #text-container', // multiple, get first
        subscriberCount: '#subscriber-count',
        canonicalUrl: 'link[rel="canonical"]',
        simplifiedResultVideoTitle: '#video-title',
        simplifiedResultDurationText: '#text',
        simplifiedResultChannelName: '#channel-info > #channel-name',
        simlifiedResultChannelUrl: '#channel-info > a',
        simplifiedResultViewCount: '#metadata-line > span:nth-child(1)',
        simplifiedResultDate: '#metadata-line > span:nth-child(2)',
    },
    VIDEO: {
        titleXp: '//ytd-video-primary-info-renderer/div/h1/yt-formatted-string',
        viewCountXp: '//*[@id="count"]/ytd-video-view-count-renderer/span[1]',
        uploadDateXp: '//ytd-video-primary-info-renderer/div/div/div[1]/div[2]/yt-formatted-string',
        likesXp: "//ytd-menu-renderer/div/ytd-toggle-button-renderer[1]/a/*[@id='text']",
        dislikesXp: "//ytd-menu-renderer/div/ytd-toggle-button-renderer[2]/a/*[@id='text']",
        channelXp: '//ytd-channel-name/div/div/yt-formatted-string/a',
        subscribersXp: "//*[@id='owner-sub-count']",
        descriptionXp: '//ytd-expander/div/div/yt-formatted-string',
        durationSlctr: '#movie_player span.ytp-time-duration',
        commentsSlctr: '.count-text',
    },
};
