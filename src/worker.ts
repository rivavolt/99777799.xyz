import puppeteer from '@cloudflare/puppeteer'
import { DurableObject } from 'cloudflare:workers'
import { card } from './site'

interface Env { ASSETS: Fetcher; ROOM: DurableObjectNamespace<Room>; BROWSER: Fetcher }
interface Stats { online: number; visits: number }

const room = (env: Env) => env.ROOM.get(env.ROOM.idFromName('lobby'))

// A single lobby holds every visitor. Sockets use the hibernation API, so an idle room costs nothing; each socket carries its id and hue in its attachment.
export class Room extends DurableObject<Env> {
  private lastMove = new WeakMap<WebSocket, number>()

  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === '/stats') return Response.json(await this.stats())
    const [client, server] = Object.values(new WebSocketPair())
    const me = { id: crypto.randomUUID().slice(0, 8), hue: Math.floor(Math.random() * 360) }
    const peers = this.ctx.getWebSockets().map((w) => w.deserializeAttachment()).filter(Boolean)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment(me)
    await this.ctx.storage.put('visits', ((await this.ctx.storage.get<number>('visits')) ?? 0) + 1)
    server.send(JSON.stringify({ t: 'hello', ...me, peers }))
    this.broadcast({ t: 'join', ...me }, server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async stats(): Promise<Stats> {
    return { online: this.ctx.getWebSockets().length, visits: (await this.ctx.storage.get<number>('visits')) ?? 0 }
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const me = ws.deserializeAttachment()
    if (!me || typeof raw !== 'string' || raw.length > 200) return
    let m: { t?: string; x?: number; y?: number }
    try { m = JSON.parse(raw) } catch { return }
    if (m.t === 'm' && typeof m.x === 'number' && typeof m.y === 'number') {
      const now = Date.now()
      if (now - (this.lastMove.get(ws) ?? 0) < 30) return
      this.lastMove.set(ws, now)
      const c = (v: number) => Math.max(-1, Math.min(1, Math.round(v * 1000) / 1000))
      this.broadcast({ t: 'm', id: me.id, x: c(m.x), y: c(m.y) }, ws)
    } else if (m.t === 'c') {
      this.broadcast({ t: 'c', id: me.id }, ws)
    }
  }

  webSocketClose(ws: WebSocket) {
    const me = ws.deserializeAttachment()
    try { ws.close() } catch {}
    if (me) this.broadcast({ t: 'leave', id: me.id }, ws)
  }

  webSocketError(ws: WebSocket) { this.webSocketClose(ws) }

  private broadcast(msg: object, except?: WebSocket) {
    const s = JSON.stringify(msg)
    for (const w of this.ctx.getWebSockets()) if (w !== except) try { w.send(s) } catch {}
  }
}

const TTL = 300

// The share image is a screenshot of /og-card, a light HTML page stamped with live room numbers, taken by Browser Rendering and cached for five minutes. A long-lived copy of the last good render backs it for when a render fails.
async function ogImage(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url)
  const cache = (caches as unknown as { default: Cache }).default
  const bucket = Math.floor(Date.now() / 1000 / TTL)
  const key = new Request(`${url.origin}/og.jpg?v=2&b=${bucket}`)
  const hit = await cache.match(key)
  if (hit) return hit
  const stale = new Request(`${url.origin}/og.jpg?stale`)
  try {
    const s = await room(env).stats()
    const cardUrl = `${url.origin}/og-card?online=${s.online}&visits=${s.visits}`
    const browser = await puppeteer.launch(env.BROWSER)
    let jpg: ArrayBuffer
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1200, height: 630 })
      await page.goto(cardUrl, { waitUntil: 'networkidle0', timeout: 25000 })
      jpg = (await page.screenshot({ type: "jpeg", quality: 88 })) as unknown as ArrayBuffer
    } finally {
      await browser.close()
    }
    const res = new Response(jpg, { headers: { 'content-type': 'image/jpeg', 'cache-control': `public, max-age=${TTL}` } })
    ctx.waitUntil(Promise.all([
      cache.put(key, res.clone()),
      cache.put(stale, new Response(jpg, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=604800' } })),
    ]))
    return res
  } catch (e) {
    const last = await cache.match(stale)
    if (last) return last
    return new Response(`og render failed: ${e}`, { status: 502 })
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    switch (url.pathname) {
      case '/ws':
        if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
        return room(env).fetch(req)
      case '/api/stats':
        return Response.json(await room(env).stats(), { headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' } })
      case '/og.jpg':
        return ogImage(req, env, ctx)
      case '/og-card': {
        const n = (k: string) => Math.max(0, Math.min(1e9, parseInt(url.searchParams.get(k) ?? '0') || 0))
        return new Response(card({ online: n('online'), visits: n('visits'), origin: url.origin }), { headers: { 'content-type': 'text/html;charset=utf-8' } })
      }
    }
    return env.ASSETS.fetch(req)
  },
}
