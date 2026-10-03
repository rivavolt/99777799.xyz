// Shared presence client. Peers live in a plain Map that scene components read every frame; React state only tracks who is present, so movement never re-renders.
export const net = {
  me: { id: null, hue: 200, x: 0, y: 0 },
  peers: new Map(),
  connected: false,
  onChange: () => {},
  onClick: () => {},
  _ws: null,
  _lastSent: 0,
  move(x, y) {
    this.me.x = x
    this.me.y = y
    const now = performance.now()
    if (this._ws?.readyState === 1 && now - this._lastSent > 45) {
      this._lastSent = now
      this._ws.send(JSON.stringify({ t: 'm', x, y }))
    }
  },
  click() { if (this._ws?.readyState === 1) this._ws.send('{"t":"c"}') },
}

export function connect() {
  let stop = false
  let retry = 0
  let timer
  const open = () => {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
    net._ws = ws
    ws.onopen = () => { retry = 0; net.connected = true; net.onChange() }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.t === 'hello') {
        net.me.id = m.id
        net.me.hue = m.hue
        net.peers.clear()
        for (const p of m.peers) if (p.id !== m.id) net.peers.set(p.id, { hue: p.hue, x: 0, y: 0, seen: false })
      } else if (m.t === 'join') net.peers.set(m.id, { hue: m.hue, x: 0, y: 0, seen: false })
      else if (m.t === 'leave') net.peers.delete(m.id)
      else if (m.t === 'm') {
        const p = net.peers.get(m.id)
        if (p) { p.x = m.x; p.y = m.y; p.seen = true }
      } else if (m.t === 'c') net.onClick(m.id)
      net.onChange()
    }
    ws.onclose = () => {
      net.connected = false
      net.peers.clear()
      net.onChange()
      if (!stop) timer = setTimeout(open, Math.min(8000, 500 * 2 ** retry++))
    }
  }
  open()
  return () => { stop = true; clearTimeout(timer); net._ws?.close() }
}
