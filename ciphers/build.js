
import * as fs from 'fs';
import path from 'path';
import axios from 'axios';
import beautify from 'js-beautify';
import { chromium } from 'playwright';
import encrypt from './encrypt.js';
import { Buffer } from 'buffer';
import {Logger} from "../logger/logger.js";

class Kasada {
    constructor(ips, site, key = null, iv = null, payload = null, keys = {}) {
        this.ips = ips;
        this.site = site;
        this.key = key;
        this.iv = iv;
        this.payload = payload;

        this.keys = keys;
        this.encrypter = encrypt(key, iv, payload);
    }

    static async create(ips, site) {
        const keysPath = path.join('../fingerprint/keys.json');
        let keys = {};

        if (fs.existsSync(keysPath)) {
            const fileContent = fs.readFileSync(keysPath, 'utf-8');
            keys = JSON.parse(fileContent);
        }

        const instance = new Kasada(ips, site, keys.key, keys.iv, keys.payload, keys);

        if (!(site in keys)) {
            const [key, iv, payload] = await instance.fetcher();
            instance.key = key;
            instance.iv = iv;
            instance.payload = payload;
        } else {
            instance.key = keys[site].key;
            instance.iv = keys[site].iv;
            instance.payload = keys[site].payload;
        }

        return instance;
    }

    dump() {
        const keysPath = path.join('../fingerprint/keys.json');
        fs.writeFileSync(keysPath, JSON.stringify(this.keys, null, 4), 'utf-8');
    }


    async fetcher() {
        const response = await axios.get(this.ips);

        this.ipsContent = response.data;
        console.log("Pulled ips.js");

        let html = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>kasada</title>
              </head>
              <body>
                  <script></script>
              </body>
              </html>
        `;


        const modifiedIps = this.modify();
        const beautifiedIps = beautify(modifiedIps);
        html = html.replace("<script></script>", `<script>${beautifiedIps}</script>`);

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.setContent(html);
        await page.waitForLoadState('networkidle');

        const result = await page.evaluate(() => {
            return window.fetcher();
        });
        await browser.close();

        const [key, iv, payload] = result;

        this.keys[this.site] = { key, iv, payload };
        this.dump();

        console.log(`Fetched key, iv, and payload for ${this.site}`);
        return [key, iv, payload];
    }


    modify() {
        let ips = this.ipsContent;

        ips = ips.replace(
"KPSDK.scriptStart=KPSDK.now()",
`window.KPSDK = {};
            KPSDK.now = (typeof performance !== 'undefined' && performance.now) ? performance.now.bind(performance) : Date.now.bind(Date);
            KPSDK.start = KPSDK.now();
            KPSDK.scriptStart = KPSDK.now();`
        );

        ips = ips.replace('"use strict"', 'let data = []; "use strict"');

        ips = ips.replace(
            "a(n,_(u,r,l)",
            "if (u.length === 16 && r.length === 8 && l.length > 200) {data.push(u, r, l, _)}; a(n,_(u,r,l)"
        );

        ips += `
        window.fetcher = function() {
          let key = data[0];
          let iv = data[1];
          let payload = data[2];
          return [key, iv, payload];
        };`;

        const extraDir = path.join('../generated');
        if (!fs.existsSync(extraDir)) {
            fs.mkdirSync(extraDir);
        }

        fs.writeFileSync(path.join(extraDir, 'ips.js'), ips, 'utf-8');
        console.log("Modified ips.js");

        return ips;
    }

    array(payload) {
        const payloadStr = JSON.stringify(payload);
        return Array.from(Buffer.from(payloadStr, 'utf-8'));
    }

    /**
     * Encrypts the payload using the encrypter's encrypt function.
     *
     * @returns {any} The encryption result.
     */
    encrypt() {
        const payloadBytes = this.array(this.payload);
        const result = encrypt(this.key, this.iv, payloadBytes);
        Logger.success(`Encrypted -> ${String.fromCharCode(...result.slice(0, 50))}...`)
        return result;
    }
}

// Immediately Invoked Async Function Expression for usage.
(async () => {
    const ips = "https://my.account.sony.com/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/ips.js?KP_uIDz=0S4kB1uCIWuh4QXijg0CG9jLxGhYlMNHuYhCUbzsAcVDml7bm2TzsPKXsNfy12ivHFK8YdwzXPPnf3B6YOicJVkTBtKHTpu7O61ftWf0mdzJx0aHJbJJbkMSNYK54VWY7UbInKzcrxiQ6cApLxYC0RoWMZK5IDFjcfEQqIGQzU7O&x-kpsdk-im=CiQ0Yzg1Nzc5OS01YjMwLTQ5YTQtOTM2NC0zNzUzMzRjZTgyMGI"; // Replace with the actual URL for ips.js
    const site = "playstation";
    // Create and initialize a Kasada instance.
    const kasada = await Kasada.create(ips, site);
    // Encrypt the payload.
    kasada.encrypt();
})();
