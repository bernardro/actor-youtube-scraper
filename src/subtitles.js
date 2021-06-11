const Apify = require('apify');
const { log } = Apify.utils;
const fetch = require('node-fetch');

class SrtConvert {
    static TYPE_AUTO_GENERATED = 'auto_generated';
    static TYPE_USER_GENERATED = 'auto_generated';

    constructor(srtJson, type = SrtConvert.TYPE_AUTO_GENERATED) {
        this._json = srtJson;
        //Type is here only for the info, if we'd like to do something with it later, and also as a safeguard - so
        //it rather booms here than during convert().
        this._type = type;
        if (this._type !== SrtConvert.TYPE_AUTO_GENERATED && this._type !== SrtConvert.TYPE_USER_GENERATED) {
            throw new Error(`Unknown subtitles type ${this._type}`);
        }
    }

    convert() {
        let subtitles = '';
        let subtCounter = 1;
        const events = this._json['events'];
        for (let i = 0; i < events.length; i++) {
            const e = events[i];
            const segs = e['segs'];
            if (segs) {
                let line = '';
                segs.forEach(s => {
                    line += s['utf8'].replace(/\n/g, ' ');
                })
                if (line !== '\n') {
                    const tStart = e['tStartMs'];
                    subtitles += `${subtCounter}\n`;
                    subtitles += `${this._msToHMS(tStart)} --> ${this._msToHMS(tStart + e['dDurationMs'])}\n`;
                    subtitles += `${line}\n\n`;
                    subtCounter++;
                }
            }
        }
        return subtitles;
    }

    _msToHMS(ms) {
        let frac = String(ms % 1000);
        frac = ('000' + frac).substring(frac.length);
        let sec = Math.floor(ms / 1000);
        let hrs = Math.floor(sec / 3600);
        sec -= hrs * 3600;
        let min = Math.floor(sec / 60);
        sec -= min * 60;
        sec = ('00' + sec).substring(String(sec).length);

        if (hrs > 0) {
            min = ('00' + min).substring(String(min).length);
            return ('00' + hrs).substring(String(hrs).length) + ":" + min + ":" + sec + ',' + frac;
        } else {
            return '00:' + ('00' + min).substring(String(min).length) + ":" + sec + ',' + frac;
        }
    }

}

async function fetchSubtitles(page, language='en') {
    log.debug(`Fetching subtitles for ${page.url()} ...`);

    let srt = null;

    const script = await page.evaluate(() => {
        const scripts = document.body.querySelectorAll('script');
        let target = null;
        scripts.forEach(s => {
            const html = s.innerHTML;
            if (html.startsWith('var ytInitialPlayerResponse')) {
                target = html;
            }
        });
        return target;
    });

    try {
        let url = String(script).match(
            /https:\/\/www\.youtube\.com\/api\/timedtext\?v=.*?(?=")/
        ).toString().replace(/\\u0026/g, '&');
        const subsUserURL = url + `&lang=${language}&fmt=json3`;
        const subsAutoURL = url + `&lang=${language}&fmt=json3&kind=asr`;
        let json = null;
        let subsType = 'none';
        let response = await fetch(subsUserURL, {method: 'GET'});
        try {
            json = await response.json();
            subsType = 'user_generated';
            url = subsUserURL;
        } catch {
            response = await fetch(subsAutoURL, {method: 'GET'});
            try {
                json = await response.json();
                subsType = 'auto_generated';
                url = subsAutoURL;
            } catch {
                // json -> null, handled later
            }
        }
        if (json) {
            log.debug(`Subtitle type for ${page.url()} is '${subsType}', link=${url}.`);
            const converter = new SrtConvert(json, subsType);
            log.debug('Converting subtitles JSON -> SRT.');
            srt = converter.convert();
        } else {
            // Fallback to external try / catch
            throw new Error('No subtitles found.');
        }
    } catch {
        log.warning(`No subtitles found for ${page.url()}.`);
    }

    return srt;
}

exports.fetchSubtitles = fetchSubtitles;
