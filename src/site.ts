export interface CardData { online: number; visits: number; origin: string }

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`

export function card({ online, visits, origin }: CardData): string {
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#07051a;font-family:Georgia,'DejaVu Serif',serif;color:#fff;position:relative}
.bg{position:absolute;inset:0;background:url(${origin}/hero.jpg) center/cover;filter:saturate(1.3) brightness(.62)}
.shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 25%,#07051acc 100%)}
.axis{position:absolute;left:600px;top:0;bottom:0;width:2px;background:linear-gradient(transparent,#ffd36b,transparent);opacity:.55}
.num{position:absolute;top:150px;left:0;right:0;text-align:center;font-size:165px;letter-spacing:.1em;padding-left:.1em;line-height:1;
  background:linear-gradient(90deg,#3df0ff,#fff 48%,#fff 52%,#ff3df0);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 0 40px #ff3df080);-webkit-box-reflect:below -6px linear-gradient(transparent 55%,#ffffff55)}
.top{position:absolute;top:44px;left:0;right:0;text-align:center;letter-spacing:.55em;padding-left:.55em;font-size:22px;opacity:.85;color:#ffd36b}
.pill{position:absolute;bottom:46px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:14px 34px;border-radius:99px;font-size:26px;letter-spacing:.1em;
  background:#07051acc;border:2px solid #ffd36b99;font-style:italic}
.dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:${online ? '#3dff9a' : '#778'};margin-right:14px;box-shadow:0 0 14px ${online ? '#3dff9a' : '#0000'}}
</style><div class="bg"></div><div class="shade"></div><div class="axis"></div>
<div class="top">READ ME BACKWARDS</div><div class="num">99777799</div>
<div class="pill"><span class="dot"></span>${plural(online, 'visitor', 'visitors')} in the mirror now · ${plural(visits, 'visit', 'visits')}</div>`
}
