// Builds the ERIP invoice message the admin panel sends via the Telegram bot
// when a tournament registration moves to 'awaiting_payment' (see
// routes/tournament-registrations.js). Wording matches the club's standard
// invoice text used for manual ERIP payments.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildInvoiceMessage({ tournamentName, invoiceNumber, deadlineLabel }) {
  const name = escapeHtml(tournamentName || 'турнир')
  const invoice = escapeHtml(invoiceNumber)

  return [
    '<b>Добрый день!</b>',
    '',
    `Отправляем вам счет на оплату турнира ${name}- ${invoice}`,
    deadlineLabel ? `Оплату необходимо осуществить до ${escapeHtml(deadlineLabel)}.` : null,
    '',
    'Оплата услуг по ЕРИП',
    '<b>MASTERCARD - ПРИОРИТЕТНЫЙ ПЛАТЕЖНЫЙ ПАРТНЕР ГОЛЬФ-КЛУБА МИНСК</b>',
    '',
    `Ваш номер счета для оплаты - <b>${invoice}</b>`,
    'Для проведения платежа необходимо совершить следующие действия:',
    '',
    '1. Сообщить специалисту по работе с клиентами о желании осуществить оплату турнирного сбора через систему ЕРИП;',
    '2. Получить Номер заказа (счет);',
    '3. Выбрать:',
    '«Система «Расчет» (ЕРИП)»',
    '«Туризм и отдых»',
    '«Активный отдых, развлечения»',
    '«Центр гольфа»',
    '4. Для оплаты услуги ввести Номер заказа (счета).',
    '5. Проверить корректность информации.',
    '6. Совершить платеж.',
    '7. Предоставить специалисту по работе с клиентами чек об оплате.',
  ].filter((line) => line !== null).join('\n')
}

export function buildPaymentConfirmedMessage({ tournamentName }) {
  const name = escapeHtml(tournamentName || 'турнир')
  return `✅ <b>Оплата получена</b>\n\n🏆 ${name}\n\nЧек получен, регистрация подтверждена. До встречи на турнире!`
}
