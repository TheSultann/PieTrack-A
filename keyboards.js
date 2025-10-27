const { pieTypes, currencySymbol } = require('./config');
const { formatNumber } = require('./utils');
const db = require('./db');

// Основная клавиатура
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['➕ Добавить изготовленные пирожки'],
            ['📦 Ввести остатки', '🗑️ Списать продукцию'],
            ['💰 Ввести расходы', '📊 Посмотреть статистику'],
            ['🛠 Настройки']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// --- НОВЫЕ КЛАВИАТУРЫ ДЛЯ РАСХОДОВ ---
const expensesMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '➕ Добавить расход', callback_data: 'add_expense' }],
            [{ text: '📝 Исправить/Удалить', callback_data: 'correct_expense' }],
            [{ text: '🔙 Назад в гл. меню', callback_data: 'back_to_main_from_expenses' }]
        ]
    }
};
async function createExpenseCorrectionKeyboard(chatId) {
    const entries = await db.getTodaysExpenseEntries(chatId);
    const buttons = [];
    const hasEntries = entries.length > 0;

    if (hasEntries) {
        entries.forEach(entry => {
            const entryTime = new Date(entry.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
            buttons.push([
                { text: `+${formatNumber(entry.amount)} ${currencySymbol} (в ${entryTime})`, callback_data: `info_expense_${entry.id}` },
                { text: 'Удалить ❌', callback_data: `delete_expense_${entry.id}` }
            ]);
        });
    }
    buttons.push([{ text: '🔙 Назад в меню расходов', callback_data: 'back_to_expenses_menu' }]);
    return {
        keyboard: { reply_markup: { inline_keyboard: buttons } },
        hasEntries: hasEntries
    };
}


// --- Клавиатуры для пирожков ---
const pieTypesKeyboard = {
    reply_markup: {
        inline_keyboard: [
            ...pieTypes.map(type => ([{ text: `➕ ${type}`, callback_data: `add_pie_${type}` }])),
            [{ text: '📝 Исправить/Удалить запись', callback_data: 'show_correction_menu' }],
            [{ text: '🔙 Назад', callback_data: 'back_to_main_from_add' }]
        ]
    }
};
const pieTypesForCorrectionKeyboard = {
    reply_markup: {
        inline_keyboard: [
            ...pieTypes.map(type => ([{ text: `🗑️ ${type}`, callback_data: `correct_pie_${type}` }])),
            [{ text: '🔙 Назад', callback_data: 'back_to_add_menu' }]
        ]
    }
};
async function createCorrectionKeyboard(chatId, pieType) {
    const entries = await db.getTodaysManufacturedEntries(chatId, pieType);
    const buttons = [];
    const hasEntries = entries.length > 0;
    if (hasEntries) {
        entries.forEach(entry => {
            const entryTime = new Date(entry.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' });
            buttons.push([
                { text: `+${entry.quantity} шт. (в ${entryTime})`, callback_data: `info_entry_${entry.id}` },
                { text: 'Удалить ❌', callback_data: `delete_entry_${entry.id}` }
            ]);
        });
    }
    buttons.push([{ text: '🔙 Назад к выбору типа', callback_data: 'show_correction_menu' }]);
    return {
        keyboard: { reply_markup: { inline_keyboard: buttons } },
        hasEntries: hasEntries
    };
}


// --- Остальные клавиатуры ---
async function createSettingsKeyboard(chatId) {
    const currentPrices = await db.getPricesFromDb(chatId);
    const buttons = pieTypes.map(type => {
        const priceText = currentPrices[type] > 0 ? `(${formatNumber(currentPrices[type])} ${currencySymbol})` : '(не задана)';
        return [{ text: `💲 ${type} ${priceText}`, callback_data: `set_price_${type}` }];
    });
    buttons.push([{ text: '🔙 Назад в гл. меню', callback_data: 'back_to_main_from_settings' }]);
    return { reply_markup: { inline_keyboard: buttons } };
}
async function createRemainingKeyboard(chatId) {
    const logs = await db.getTodaysLogsGrouped(chatId);
    const buttons = pieTypes
        .filter(type => (logs[type]?.manufactured || 0) > 0)
        .map(type => {
            const log = logs[type];
            const manufactured = log?.manufactured || 0;
            const remainingText = (log?.remaining !== null && log?.remaining !== undefined) ? log.remaining : 'не введено';
            const buttonText = `📦 ${type} (${formatNumber(manufactured)} / ${remainingText})`;
            return [{ text: buttonText, callback_data: `enter_remaining_${type}` }];
        });
    if (buttons.length > 0) {
        buttons.push([{ text: '🔙 Назад в гл. меню', callback_data: 'back_to_main_from_remaining' }]);
    } else {
        buttons.push([{ text: 'Сначала добавьте изготовленные пирожки', callback_data: 'no_pies_for_remaining' }]);
        buttons.push([{ text: '🔙 Назад в гл. меню', callback_data: 'back_to_main_from_remaining' }]);
    }
    return { reply_markup: { inline_keyboard: buttons } };
}
async function createWriteOffKeyboard(chatId) {
    const logs = await db.getTodaysLogsGrouped(chatId);
    const buttons = pieTypes
        .filter(type => (logs[type]?.remaining || 0) > 0)
        .map(type => {
            const log = logs[type];
            const remaining = log?.remaining || 0;
            const writtenOff = log?.written_off || 0;
            return [{ text: `🗑️ ${type} (остаток: ${remaining}, списано: ${writtenOff})`, callback_data: `write_off_${type}` }];
        });
    if (buttons.length > 0) {
        buttons.push([{ text: '🔙 Назад в гл. меню', callback_data: 'back_to_main_from_writeoff' }]);
    } else {
        buttons.push([{ text: 'Нет продукции с остатками для списания', callback_data: 'no_pies_for_writeoff' }]);
    }
    return { reply_markup: { inline_keyboard: buttons } };
}
const statsPeriodKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📈 За сегодня', callback_data: 'stats_period_today' }, { text: '📅 За неделю', callback_data: 'stats_period_week' }],
            [{ text: '🗓️ За месяц', callback_data: 'stats_period_month' }, { text: '✍️ Выбрать даты', callback_data: 'stats_period_custom' }],
            [{ text: '🧠 Аналитика', callback_data: 'show_analytics_menu' }],
            [{ text: '🔙 Назад', callback_data: 'back_to_main_from_stats' }]
        ]
    }
};
const analyticsTypeKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🏆 Самый прибыльный пирожок', callback_data: 'analytics_most_profitable' }],
            [{ text: '📈 Самый продаваемый пирожок', callback_data: 'analytics_most_sold' }],
            [{ text: '📅 Анализ по дням недели', callback_data: 'analytics_weekday' }],
            [{ text: '🤖 AI Прогноз спроса', callback_data: 'analytics_ai_forecast' }],
            [{ text: '🔙 Назад в статистику', callback_data: 'back_to_stats_menu' }]
        ]
    }
};

// Обновленный экспорт
module.exports = {
    mainKeyboard,
    pieTypesKeyboard,
    statsPeriodKeyboard,
    analyticsTypeKeyboard,
    createSettingsKeyboard,
    createRemainingKeyboard,
    createWriteOffKeyboard,
    pieTypesForCorrectionKeyboard,
    createCorrectionKeyboard,
    // Новые клавиатуры для расходов
    expensesMenuKeyboard,
    createExpenseCorrectionKeyboard
};