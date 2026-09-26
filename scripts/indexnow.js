// Tell Bing (and ChatGPT search, which uses Bing), Yandex and other IndexNow engines that pages changed.
// Run after each deploy:  npm run indexnow
const SITE = (process.env.SITE_URL || 'https://www.liquid-build.com').replace(/\/$/, '');
const KEY = '31debc22d9d43e4931288c1c33d182c7';
(async () => {
  const xml = await fetch(SITE + '/sitemap.xml').then((r) => r.text());
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: SITE + '/' + KEY + '.txt', urlList }),
  });
  console.log('IndexNow', r.status, urlList.length, 'URLs');
})();
