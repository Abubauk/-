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
app.post('*', (req, res) => {
    try {
        const inputData = req.body;
        const list = loadAll();
        
        // Создаем правильную структуру объекта расчета, которую ждет фронтенд (с полем input)
        const newCalculation = { 
            id: Date.now().toString(), 
            input: {
                width: Number(inputData.width || inputData.w || 0),
                height: Number(inputData.height || inputData.h || 0),
                sections: Number(inputData.sections || 0),
                openers: Number(inputData.openers || 0),
                reserve: Number(inputData.reserve || inputData.percent || 5)
            },
            rows: [] // Если ваш фронтенд сам рассчитывает строки деталей, оставляем пустым, либо он заполнится из inputData.rows
        };

        // Если фронтенд прислал уже готовые посчитанные строки деталей, сохраняем их
        if (inputData.rows) {
            newCalculation.rows = inputData.rows;
        }

        list.push(newCalculation);
        saveAll(list);
        
        // Отправляем ответ, где есть и список 'rows', и объект последнего расчета 'last' с 'input.reserve'
        res.json({ 
            success: true, 
            message: 'Расчет успешно сохранен',
            rows: newCalculation.rows || [],
            last: newCalculation
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message, 
            rows: [], 
            last: { input: { reserve: 5 }, rows: [] } 
        });
    }
});

// 3. АВТОМАТИЧЕСКАЯ РАЗДАЧА ВСЕХ ФАЙЛОВ ИНТЕРФЕЙСА
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Сервер успешно работает на порту ${PORT}`);
});
