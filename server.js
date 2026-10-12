// Бэкенд мини-приложения: расчёт деталей окна + хранение результатов.
// Без внешних зависимостей, только Node.js 18+.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || ''; // токен бота от @BotFather
const DATA_FILE = path.join(__dirname, 'data', 'results.json');
const PARTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'parts.json'), 'utf8')).parts;

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

function loadAll() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function saveAll(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 1));
}

// Проверка подписи Telegram (initData). Без BOT_TOKEN работает режим разработки.
function auth(req) {
  if (!BOT_TOKEN) return { id: 'dev', name: 'Разработчик' };
  const p = new URLSearchParams(req.headers['x-init-data'] || '');
  const hash = p.get('hash');
  if (!hash) return null;
  p.delete('hash');
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
  if (calc !== hash) return null;
  try {
    const u = JSON.parse(p.get('user') || '{}');
    return { id: String(u.id), name: u.first_name || '' };
  } catch { return null; }
}

const r2 = (x) => Math.round(x * 100) / 100;

function calculate(input) {
  const widthMm = Number(input.widthMm);
  const heightMm = Number(input.heightMm);
  const n = Math.round(Number(input.sections));
  const s = Math.round(Number(input.opening));
  const reserve = Number(input.reserve ?? 5);

  if (!(widthMm >= 300 && widthMm <= 6000)) throw new Error('Ширина должна быть от 300 до 6000 мм');
  if (!(heightMm >= 300 && heightMm <= 3000)) throw new Error('Высота должна быть от 300 до 3000 мм');
  if (!(n >= 1 && n <= 4)) throw new Error('Секций может быть от 1 до 4');
  if (!(s >= 0 && s <= n)) throw new Error('Открывающихся створок не может быть больше числа секций');
  if (!(reserve >= 0 && reserve <= 50)) throw new Error('Запас должен быть от 0 до 50 %');

  const w = widthMm / 1000, h = heightMm / 1000;
  const sw = w / n - 0.04, sh = h - 0.04;          // размеры створки
  const gw = w / n - 0.12, gh = h - 0.12;          // размеры стеклопакета секции
  const P = 2 * (w + h);
  if (gw <= 0 || gh <= 0) throw new Error('Слишком маленькое окно для такого числа секций');

  const k = 1 + reserve / 100;
  const vars = { w, h, n, s, sw, sh, gw, gh, P };
  const names = Object.keys(vars);
  const values = names.map((x) => vars[x]);
  const ev = (expr) => new Function(...names, `return (${expr});`)(...values);

  const rows = PARTS.map((p) => {
    const pcs = Math.round(ev(p.pcs));
    const row = { id: p.id, name: p.name, unit: p.unit, pcs };
    if (p.qty) {
      row.net = r2(ev(p.qty));
      row.total = r2(ev(p.qty) * k);
    }
    return row;
  }).filter((r) => r.pcs > 0);

  return {
    input: { widthMm, heightMm, sections: n, opening: s, reserve },
    rows,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) { reject(new Error('Слишком большой запрос')); req.destroy(); } });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Неверный JSON')); } });
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    const user = auth(req);
    if (!user) return send(res, 401, { error: 'Откройте приложение из Telegram' });
    try {
      if (req.method === 'POST' && url.pathname === '/api/calc') {
        return send(res, 200, calculate(await readBody(req)));
      }
      if (req.method === 'POST' && url.pathname === '/api/results') {
        const body = await readBody(req);
        const result = calculate(body);
        const item = {
          id: crypto.randomUUID(),
          userId: user.id,
          title: String(body.title || '').slice(0, 100),
          createdAt: new Date().toISOString(),
          ...result,
        };
        const all = loadAll();
        all.push(item);
        saveAll(all);
        return send(res, 201, item);
      }
      if (req.method === 'GET' && url.pathname === '/api/results') {
        const mine = loadAll().filter((x) => x.userId === user.id).reverse().slice(0, 100);
        return send(res, 200, mine);
      }
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/results/')) {
        const id = url.pathname.split('/').pop();
        const all = loadAll();
        const next = all.filter((x) => !(x.id === id && x.userId === user.id));
        saveAll(next);
        return send(res, 200, { ok: next.length !== all.length });
      }
      return send(res, 404, { error: 'Не найдено' });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  // Статика
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(__dirname, 'public', path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}` + (BOT_TOKEN ? '' : ' (режим разработки, без проверки Telegram)'));
});
