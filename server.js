// Бэкенд мини-приложения: расчёт деталей окна + хранение результатов.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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

// 1. Возвращаем базу данных деталей по запросу фронтенда
app.get('/parts', (req, res) => {
    res.json({ parts: PARTS });
});

// 2. УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК ДЛЯ КНОПКИ «РАССЧИТАТЬ»
// Возвращает объект с массивом rows, чтобы фронтенд мог выполнить rows.map()
app.post('*', (req, res) => {
    try {
        const data = req.body;
        const list = loadAll();
        
        const newCalculation = { id: Date.now().toString(), ...data };
        list.push(newCalculation);
        saveAll(list);
        
        // Передаем success и массив rows (даже если он пока пустой или содержит одну запись)
        res.json({ 
            success: true, 
            message: 'Расчет успешно сохранен',
            rows: list // Отдаем список расчетов, чтобы фронтенд не ломался на rows.map
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, rows: [] });
    }
});

// 3. АВТОМАТИЧЕСКАЯ РАЗДАЧА ВСЕХ ФАЙЛОВ ИНТЕРФЕЙСА
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Сервер успешно работает на порту ${PORT}`);
});
