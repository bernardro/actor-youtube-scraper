exports.DELAY = {
    KEY_PRESS: { min: 5, max: 25 },
    BTWN_KEY_PRESS: { min: 45, max: 375 },
    MOUSE_CLICK: { min: 40, max: 150 },
    HUMAN_PAUSE: { min: 300, max: 800 },
    START_LOADING_MORE_VIDEOS: 300,
};

exports.MOUSE_STEPS = 5;

// 'document', 'image', 'xhr', 'script', 'stylesheet', 'font', 'other', 'manifest'
exports.MEDIA_TYPES = ['image'];

exports.SELECTORS = {
    SEARCH: {
        searchBox: 'input#search',
        toggleFilterMenu: 'ytd-toggle-button-renderer a #button',
        filterBtnsXp: '//ytd-search-filter-renderer/a/div/yt-formatted-string',
        youtubeVideosXp: '//ytd-video-renderer',
        urlXp: "./div/ytd-thumbnail/a[@id='thumbnail'][1]",
    },
    VIDEO: {
        titleXp: '//ytd-video-primary-info-renderer/div/h1/yt-formatted-string',
        viewCountXp: '//yt-view-count-renderer/span[1]',
        uploadDateXp: '//ytd-video-primary-info-renderer/div/div/div[1]/div[2]/yt-formatted-string',
        likesXp: "//ytd-menu-renderer/div/ytd-toggle-button-renderer[1]/a/*[@id='text']",
        dislikesXp: "//ytd-menu-renderer/div/ytd-toggle-button-renderer[2]/a/*[@id='text']",
        channelXp: '//ytd-channel-name/div/div/yt-formatted-string/a',
        subscribersXp: "//*[@id='owner-sub-count']",
        descriptionXp: '//ytd-expander/div/div/yt-formatted-string',
    },
};
