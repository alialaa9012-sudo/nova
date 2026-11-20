// Light, read-only load test on the live site (approved by the owner, 20 Nov 2026).
// Up to 50 visitors at once for about 5 minutes. No order is placed and nothing is written.
// Stops by itself if more than 5% of requests fail or the slowest 5% take over 3 seconds.
import http from 'k6/http'
import { check, sleep, group } from 'k6'

const SITE = 'https://khaliha-mashawy.pages.dev'
const API = 'https://mwdcjfpzsiimsijpouun.supabase.co'
const KEY = __ENV.ANON_KEY // the public anon key (the same one every visitor's browser has)

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '1m', target: 35 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '20s' }],
    http_req_duration: [{ threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '20s' }],
    'http_req_duration{kind:page}': ['p(95)<3000'],
    'http_req_duration{kind:data}': ['p(95)<3000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
}

export function setup() {
  const html = http.get(`${SITE}/`).body
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
  return { assets }
}

const api = (path, body) =>
  body
    ? http.post(`${API}${path}`, JSON.stringify(body), { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, tags: { kind: 'data' } })
    : http.get(`${API}${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, tags: { kind: 'data' } })

export default function (data) {
  const branch = ['ashry', 'zagazig', 'tagamoa'][Math.floor(Math.random() * 3)]
  group('home', () => {
    const r = http.get(`${SITE}/`, { tags: { kind: 'page' } })
    check(r, { 'home 200': (x) => x.status === 200 })
    for (const a of data.assets) http.get(`${SITE}${a}`, { tags: { kind: 'asset' } })
    http.get(`${SITE}/brand/logo-gold-sm.png`, { tags: { kind: 'asset' } })
  })
  sleep(1 + Math.random() * 2)
  group('menu', () => {
    check(http.get(`${SITE}/branch/${branch}`, { tags: { kind: 'page' } }), { 'menu 200': (x) => x.status === 200 })
  })
  sleep(2 + Math.random() * 3)
  group('checkout zones', () => {
    const r = api(`/rest/v1/delivery_zones?select=*&branch_id=eq.${branch}&is_active=eq.true&order=sort_order,id`)
    check(r, { 'zones 200': (x) => x.status === 200, 'zones listed': (x) => x.status === 200 && x.json().length > 0 })
  })
  sleep(1 + Math.random() * 2)
  group('track', () => {
    const r = api('/rest/v1/rpc/track_order', { p_order_number: String(90 + Math.floor(Math.random() * 9)), p_phone: null })
    check(r, { 'track 200': (x) => x.status === 200 })
  })
  sleep(2 + Math.random() * 3)
}
