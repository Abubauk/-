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

// СОЗДАНИЕ СЕРВЕРА С РАЗДАЧЕЙ ФАЙЛОВ ИЗ ПАПКИ PUBLIC
const server = http.createServer((req, res) => {
  // ИСПРАВЛЕНО: Правильно отсекаем параметры Telegram (?, #) из URL
  const cleanUrl = req.url.split('?')[0].split('#')[0];

  // Определяем, какой файл искать в папке public
  let targetFile = cleanUrl === '/' ? 'index.html' : cleanUrl;
  let filePath = path.join(__dirname,  targetFile);

  // Определение расширения файла для правильного заголовка
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  // ОБРАБОТКА API ДЛЯ ЧТЕНИЯ PARTS
  if (cleanUrl === '/parts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ parts: PARTS }));
    return;
  }

  // ЧТЕНИЕ И ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ ИЗ ПАПКИ PUBLIC
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        // Теперь сервер честно скажет, какой именно файл он ищет и не находит
        res.end(`Not Found: сервер не нашёл файл по пути: ${targetFile}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${error.code}\n`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
