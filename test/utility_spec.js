const { describe, it } = require('mocha');
const { assert, expect } = require('chai');
const should = require('chai').should();
const moment = require('moment');

const utils = require('../src/utility');


describe('getRandBetween', () => {
    const numTestCycles = 1000;
    const includeList = [3, 4, 5, 6, 7];

    it('should return a random number between the given inputs', () => {
        // loop to generate random tests
        for (let i = 0; i < numTestCycles; i++) {
            const result = utils.getRandBetween(3, 7);
            assert(includeList.indexOf(result) >= 0, `random value [${result}] is within expected range`);
        }
    });
});

describe('getRandClickPos', () => {
    // start with output of `JSON.stringify(document.createElement('div').getBoundingClientRect())`
    // remove right,left,top,bottom to make it compatible with puppeteer boundingBox
    const divRect = JSON.parse('{"x":0,"y":0,"width":0,"height":0}');
    divRect.x = 10;
    divRect.y = 10;
    divRect.width = 50;
    divRect.height = 10;

    it('should take a valid puppeteer boundingBox', () => {
        divRect.should.have.property('x');
        divRect.should.have.property('y');
        divRect.should.have.property('width');
        divRect.should.have.property('height');
        assert(divRect.width > 0, 'width is greater than zero');
        assert(divRect.height > 0, 'height is greater than zero');
    });

    it('should select a random point well within the boundaries of a clickable element', () => {
        const numTestCycles = 100;

        for (let i = 0; i < numTestCycles; i++) {
            const clickPos = utils.getRandClickPos(divRect);
            clickPos.should.have.property('xPos');
            clickPos.should.have.property('yPos');

            const { xPos, yPos } = clickPos;
            assert(xPos > divRect.x, 'random x is greater than minimum x');
            assert(xPos < (divRect.x + divRect.width), 'random x is less than maximum x');
            assert(yPos > divRect.y, 'random y is greater than minimum y');
            assert(yPos < (divRect.y + divRect.height), 'random y is less than maximum y');
        }
    });
});

describe('getCutoffDate', () => {
    it('should return the correct duration for given date string', () => {
        const timeNow = moment();
        const numTestCycles = 100;
        const durationTypes = ['hours', 'days', 'weeks', 'months', 'years'];

        // loop to generate random tests
        let timeThen = null;
        let duration = null;
        for (let i = 0; i < numTestCycles; i++) {
            const selectedIndex = utils.getRandBetween(0, durationTypes.length - 1);
            const durType = durationTypes[selectedIndex];
            const count = utils.getRandBetween(1, 9);

            const randInputString = `${count} ${durType} ago`;

            timeThen = utils.getCutoffDate(randInputString);
            duration = moment.duration(timeNow.diff(timeThen));
            const newDur = Math.round(duration.as(durType));

            assert(newDur === count, `getCutoffDate correctly extracted '${newDur}' from '${randInputString}'`);
        }
    });
});

describe('isDateInputValid', () => {
    const isValid = utils.isDateInputValid;

    it('should validate date input as entered by user', () => {
        assert(isValid('1 week ago') === true, '1 week ago is valid');
        assert(isValid('1 day ago') === true, '1 day ago is valid');
        assert(isValid('1 hour ago') === true, '1 hour ago is valid');
        assert(isValid('3 weeks ago') === true, '3 weeks ago is valid');
        assert(isValid('2 hours ago') === true, '2 hours ago is valid');
        assert(isValid('13 weeks ago') === true, '13 weeks ago is valid');
        assert(isValid('60 weeks ago') === true, '60 weeks ago is valid');
        assert(isValid('36 hours ago') === true, '36 hours ago is valid');
        assert(isValid('120 minutes ago') === true, '120 minutes ago is valid');
        assert(isValid('3 minutes ago') === true, '3 minutes ago is valid');
        assert(isValid('9 days ago') === true, '9 days ago is valid');

        assert(isValid('0 days ago') === false, '0 days ago is invalid');
        assert(isValid('400 days ago') === true, '400 days ago is invalid');
        assert(isValid('1 week agos') === false, '1 week agos is invalid');
        assert(isValid('n days ago') === false, 'n days ago is invalid');
        assert(isValid('3 decades ago') === false, '3 decades ago is invalid');
        assert(isValid('minutes ago') === false, 'minutes ago is invalid');
        assert(isValid('hours') === false, 'hours is invalid');
        assert(isValid('ago') === false, 'ago is invalid');
        assert(isValid('60') === false, '60 is invalid');
        assert(isValid('36 # ago') === false, '36 # ago is invalid');
        assert(isValid('120 minutes ago ##') === false, '120 minutes ago ## is invalid');

    });
});

describe('getYoutubeDateFilters', () => {
    const filter = utils.getYoutubeDateFilters;

    it('should return the youtube filter corresponding with the users requested date filter', () => {
        expect(filter('1 week ago')).to.be.an('array').that.has.members(['Upload date', 'This week']);
        expect(filter('1 day ago')).to.be.an('array').that.has.members(['Upload date', 'Today']);
        expect(filter('1 hour ago')).to.be.an('array').that.has.members(['Upload date', 'Last hour']);
        expect(filter('3 weeks ago')).to.be.an('array').that.has.members(['Upload date', 'This month']);
        expect(filter('2 hours ago')).to.be.an('array').that.has.members(['Upload date', 'Today']);
        expect(filter('13 weeks ago')).to.be.an('array').that.has.members(['Upload date', 'This year']);
        // eslint-disable-next-line no-unused-expressions
        expect(filter('60 weeks ago')).to.be.an('array').that.is.empty;
        expect(filter('36 hours ago')).to.be.an('array').that.has.members(['Upload date', 'This week']);
        expect(filter('120 minutes ago')).to.be.an('array').that.has.members(['Upload date', 'Today']);
        expect(filter('3 minutes ago')).to.be.an('array').that.has.members(['Upload date', 'Last hour']);
        expect(filter('9 days ago')).to.be.an('array').that.has.members(['Upload date', 'This month']);
        // eslint-disable-next-line no-unused-expressions
        expect(filter('400 days ago')).to.be.an('array').that.is.empty;
    });
});

describe('getVideoId', () => {
    const testId = 'jL_nMu9HhfA';

    const testUrlList = [];
    testUrlList.push(`http://www.youtube.com/sandalsResorts#p/c/54B8C800269D7C1B/0/${testId}`);
    testUrlList.push(`http://www.youtube.com/user/Scobleizer#p/u/1/1${testId}`);
    testUrlList.push(`http://youtu.be/${testId}`);
    testUrlList.push(`http://www.youtube.com/embed/${testId}`);
    testUrlList.push(`https://www.youtube.com/embed/${testId}`);
    testUrlList.push(`http://www.youtube.com/v/${testId}?fs=1&hl=en_US`);
    testUrlList.push(`http://www.youtube.com/watch?v=${testId}`);
    testUrlList.push(`http://www.youtube.com/user/Scobleizer#p/u/1/1${testId}`);
    testUrlList.push(`http://www.youtube.com/ytscreeningroom?v=${testId}`);
    testUrlList.push(`http://www.youtube.com/user/Scobleizer#p/u/1/1${testId}`);
    testUrlList.push(`http://www.youtube.com/watch?v=${testId}&feature=featured`);

    it('should return the youtube filter corresponding with the users requested date filter', () => {
        for (const testURl of testUrlList) {
            const videoId = utils.getVideoId(testURl);
            assert(videoId.indexOf(testId) >= 0, `${testId} extracted from ${testURl}`);
        }
    });
});

describe('getMaxVideos', () => {
    it('should return the correct number of max videos to use', () => {
        assert(utils.getMaxVideos(20, 30) === 20, 'numOfVideos is 20 and userMaximum is 30');
        assert(utils.getMaxVideos(30, 20) === 20, 'numOfVideos is 30 and userMaximum is 20');
        assert(utils.getMaxVideos(0, 30) === 0, 'numOfVideos is 0 and userMaximum is 30');
        assert(utils.getMaxVideos(20, 0) === 20, 'numOfVideos is 20 and userMaximum is 0');
        assert(utils.getMaxVideos(20, 20) === 20, 'numOfVideos is 20 and userMaximum is 20');
    });
});

describe('unformatNumbers', () => {
    it('should transform formatted numbers like 1.2K into 1200', () => {
        assert(utils.unformatNumbers('1.23M') === 1230000, '1.23M is converted to 1230000');
        assert(utils.unformatNumbers('6.0K') === 6000, '6.0K is converted to 6000');
        assert(utils.unformatNumbers('2B') === 2000000000, '2B is converted to 2000000000');
        assert(utils.unformatNumbers('0K') === 0, '0K is converted to 0');
        assert(utils.unformatNumbers('1K') === 1000, '1K is converted to 1000');
        assert(utils.unformatNumbers('0.24K') === 240, '0.24K is converted to 240');
    });
});
