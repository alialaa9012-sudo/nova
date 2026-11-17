// Crawls the site from the home page and runs Lighthouse on every page it finds.
export default {
  site: 'http://localhost:4173',
  outputPath: 'results/unlighthouse',
  urls: ['/', '/branch/ashry', '/branch/tagamoa', '/branch/zagazig', '/track', '/admin', '/admin/zones', '/nope'],
  scanner: { device: 'mobile', samples: 1, throttle: true, robotsTxt: false, sitemap: false, dynamicSampling: false },
  puppeteerOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--headless=new'] },
  chrome: { useSystem: false },
  ci: { budget: 50, buildStatic: true },
}
