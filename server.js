// Бэкенд мини-приложения: расчёт деталей окна + хранение результатов.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Включаем поддержку JSON-запросов от фронтенда
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data', 'results.json');
const PARTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'parts.json'), 'utf8')).parts;

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

function loadAll() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function saveAll(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 1));
}

// 1. АВТОМАТИЧЕСКАЯ РАЗДАЧА ВСЕХ ФАЙЛОВ ИНТЕРФЕЙСА (HTML, CSS, JS)
app.use(express.static(__dirname));

// 2. Маршрут для получения данных деталей через API
app.get('/parts', (req, res) => {
    res.json({ parts: PARTS });
});

// 3. Маршрут для сохранения истории или отправки расчетов (если фронтенд делает POST-запрос)
app.post('/calculate', (req, res) => {
    try {
        const data = req.body;
        const list = loadAll();
        list.push({ id: Date.now().toString(), ...data });
        saveAll(list);
        res.json({ success: true, message: 'Расчет успешно сохранен' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер успешно работает на порту ${PORT}`);
});
