import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { chromium } from 'playwright';
import jsBeautify from 'js-beautify';
import {Buffer} from "buffer";
import {Logger} from "./logger/logger.js";


function makeId() {
    let result = "";
    const chars = "0123456789abcdef";
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(16 * Math.random())];
    }
    return result;
}


function getHashDifficulty(hash) {
    const numerator = 0x10000000000000; // 2^52
    const value = parseInt(hash.slice(0, 13), 16) + 1;
    return numerator / value;
}

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function findAnswers(st, id_hash) {
    let answers = [];
    let hashValue = sha256(`tp-v2-input, ${st}, ${id_hash}`);
    for (let i = 0; i < 2; i++) {
        let num = 1;
        while (true) {
            let newHash = sha256(`${num}, ${hashValue}`);
            if (Math.floor(getHashDifficulty(newHash)) >= 5) {
                answers.push(num);
                hashValue = newHash;
                break;
            }
            num++;
        }
    }
    return { answers, finalHash: hashValue };
}

function generateServerOffset() {
    const timestamp = Date.now();
    const offset = Math.floor(Math.random() * (2700 - 1400 + 1)) + 1400;
    const timestamp2 = timestamp + offset;
    return { d: offset, st: timestamp, rst: timestamp2 };
}


function solve() {
    const { d, st, rst } = generateServerOffset();
    const now = Date.now();
    // Generate a random runtime value between 5325.5 and 10525.5
    const runtimeMin = Math.random() * (10525.5 - 5325.5) + 5325.5;
    const workTime = now - d;
    const id = makeId();
    const { answers } = findAnswers(workTime, id);
    // Pick a random value between runtimeMin and (runtimeMin * (random number between 1.1 and 1.5))
    const randomMultiplier = Math.random() * (1.5 - 1.1) + 1.1;
    const runtimeMax = runtimeMin * randomMultiplier;
    const runtimeVal = Math.random() * (runtimeMax - runtimeMin) + runtimeMin;
    const duration = Math.round(runtimeVal - runtimeMin);

    const resultObj = {
        workTime: workTime,
        id: id,
        answers: answers,
        duration: duration,
        d: d,
        st: st,
        rst: rst
    };
    return JSON.stringify(resultObj);
}

class Kasada {
    static uas =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/131.0.0.0 Safari/537.36";

    constructor(ips, site) {
        const baseUrl = ips.split("/ips.js")[0];
        const parts = baseUrl.split("//")[1].split("/");
        this.version = parts[1];
        this.url = baseUrl;

        this.session = axios.create({
            headers: {
                accept: "*/*",
                "accept-language": "en-US,en;q=0.9",
                dnt: "1",
                priority: "u=0, i",
                referer: site,
                "sec-fetch-dest": "iframe",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-site",
                "upgrade-insecure-requests": "1",
                "user-agent": Kasada.uas,
            },
            responseType: "text",
        });

        this.content = null;

        // Ensure the versions directory exists.
        this.versionsDir = path.join("versions");
        if (!fs.existsSync(this.versionsDir)) {
            fs.mkdirSync(this.versionsDir);
        }
        this.versionFile = path.join(this.versionsDir, `${this.version}.js`);

        // If we already have a modified version saved, use it; otherwise, fetch and modify.
        if (!fs.existsSync(this.versionFile)) {
            this.session
                .get(ips)
                .then((response) => {
                    const ipsContent = response.data;
                    this.modify(ipsContent);
                })
                .catch((err) => {
                    console.error("Error fetching ips.js:", err);
                });
        } else {
            const ipsContent = fs.readFileSync(this.versionFile, "utf-8");
            this.setup(ipsContent);
        }
    }

    setup(ipsContent) {
        const beautified = jsBeautify(ipsContent);
        this.content = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>kasada</title>
  </head>
  <body>
    <script>${beautified}</script>
  </body>
</html>`;
    }

    modify(ipsContent) {
        let modified = ipsContent.replace(
            "KPSDK.scriptStart=KPSDK.now()",
            `window.KPSDK = {};
KPSDK.now = (typeof performance !== 'undefined' && performance.now ? performance.now.bind(performance) : Date.now.bind(Date));
KPSDK.start = KPSDK.now();
KPSDK.scriptStart = KPSDK.now();`
        );
        modified = modified.replace('"use strict"', 'let data=[]; "use strict"');
        modified = modified.replace(
            "a(n,_(u,r,l)",
            "if (u.length === 16 && r.length === 8 && l.length > 200) {data.push(u, r, l, _)}; a(n,_(u,r,l)"
        );
        modified += `
window.encrypt = function() {
  let key = data[0];
  let iv = data[1];
  let payload = data[2];
  payload = payload.filter(function (subArray) {
    return subArray[0] !== "encrypt";
  });
  payload = new TextEncoder().encode(JSON.stringify(payload));
  return data[3](key, iv, payload);
};`;
        fs.writeFileSync(this.versionFile, modified, "utf-8");
        this.setup(modified);
    }

    async init() {
        while (!this.content) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    async encrypt() {
        await this.init();
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(this.content, { waitUntil: "networkidle" });
        const encrypted = await page.evaluate(() => {
            return encrypt();
        });
        await browser.close();
        return Buffer.from(encrypted);
    }

    async token() {
        await this.init();
        const fpUrl = `${this.url}/fp?x-kpsdk-v=j-0.0.0`;
        let response;
        try {
            response = await this.session.get(fpUrl);
        } catch (error) {
            Logger.error(`Error in GET fp: ${error}`);
            return;
        }
        const ct = response.headers["x-kpsdk-ct"];
        const dataBuffer = await this.encrypt();
        const tlUrl = `${this.url}/tl`;
        let postResponse;
        try {
            postResponse = await this.session.post(tlUrl, dataBuffer, {
                headers: {
                    accept: "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    "Content-Type": "application/octet-stream",
                    dnt: "1",
                    origin: this.url.split(`/${this.version}`)[0],
                    priority: "u=1, i",
                    referer: fpUrl,
                    "x-kpsdk-ct": ct,
                    "x-kpsdk-v": "j-0.0.0",
                },
                responseType: "arraybuffer",
            });
        } catch (error) {
            Logger.error(`Error in POST tl: ${error}`);
            return;
        }
        if (String(postResponse.data).includes("true")){
            Logger.success(`x-kpsdk-ct: ${postResponse.headers["x-kpsdk-ct"]}`);
        }
        else{
            Logger.error(`Error in POST tl: ${String(postResponse.data)}`)
        }
        return postResponse.headers["x-kpsdk-ct"];
    }
}

const ips =
    "https://ca.account.sony.com/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/ips.js";
const site =
    "https://ca.account.sony.com/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/fp?x-kpsdk-v=j-0.0.0";

const kasada = new Kasada(ips, site);


(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await kasada.token();
    Logger.warn(`x-kpsdk-cd: ${solve()}`);
})();
