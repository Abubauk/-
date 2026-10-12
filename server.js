// Бэкенд мини-приложения: расчёт деталей окна + хранение результатов.
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Загружаем базу данных деталей из parts.json
const PARTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'parts.json'), 'utf8')).parts;

// 2. АВТОМАТИЧЕСКАЯ РАЗДАЧА ВСЕХ ФАЙЛОВ (HTML, CSS, JS) ИЗ КОРНЯ ПРОЕКТА
app.use(express.static(__dirname));

// 3. Маршрут для получения данных деталей через API
app.get('/parts', (req, res) => {
    res.json({ parts: PARTS });
});

app.listen(PORT, () => {
    console.log(`Сервер успешно работает на порту ${PORT}`);
});
