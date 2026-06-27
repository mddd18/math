const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot 24/7 ishlayapti!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Veb-server ${PORT}-portda ishga tushdi`));

// --- BOT KODI ---
const token = '8832573550:AAFeIotInXzGiCwKTMBqhwMGos-DnTbMi-o';
const adminId = '212800037';

const bot = new TelegramBot(token, {polling: true});

let activeTests = {}; 
let registeredUsers = {}; 
let adminState = null; 
let tempTestCount = 0; 
let userSessions = {}; 

// ==========================================
// XABARLARNI QABUL QILISH
// ==========================================
bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!text) return;

  // --- ADMIN QISMI ---
  if (chatId === adminId) {
    if (text === '/start') {
      adminState = null; 
      return bot.sendMessage(adminId, `Admin paneliga xush kelibsiz.`, {
        reply_markup: { keyboard: [[{ text: '📝 Yangi test yaratish' }]], resize_keyboard: true }
      });
    }

    if (text === '📝 Yangi test yaratish') {
      adminState = 'WAITING_FOR_COUNT'; 
      return bot.sendMessage(adminId, `Ushbu test nechta savoldan iborat bo'ladi? (Raqam kiriting)`);
    }

    if (adminState === 'WAITING_FOR_COUNT') {
      const count = parseInt(text);
      if (!isNaN(count) && count > 0) {
        tempTestCount = count;
        adminState = 'WAITING_FOR_KEYS';
        return bot.sendMessage(adminId, `✅ Savollar soni: ${count} ta.\n\nEndi faqat javoblarni (kalitlarni) yuboring.\nMisol: ${'a'.repeat(Math.min(count, 5))}...`);
      }
    }

    if (adminState === 'WAITING_FOR_KEYS') {
      const answers = text.toLowerCase();
      if (answers.length === tempTestCount) {
        const testId = Math.floor(1000 + Math.random() * 9000).toString(); 
        activeTests[testId] = { keys: answers, count: tempTestCount };
        adminState = null; 
        return bot.sendMessage(adminId, `🎉 Test tayyor!\n\n📌 **Test kodi: ${testId}**\n📝 Savollar soni: ${tempTestCount} ta\n🔑 Kalitlar: ${answers}\n\nO'quvchilarga shu kodni bering.`, {parse_mode: 'Markdown'});
      } else {
        return bot.sendMessage(adminId, `⚠️ Javoblar soni aniq ${tempTestCount} ta bo'lishi kerak. Siz ${answers.length} ta yozdingiz.`);
      }
    }
    return;
  }

  // --- FOYDALANUVCHI QISMI ---
  if (chatId !== adminId) {
    
    // /start bosilganda tekshiruv
    if (text === '/start') {
      if (registeredUsers[chatId]) {
        // Agar oldin ro'yxatdan o'tgan bo'lsa, to'g'ridan-to'g'ri test so'raymiz
        return bot.sendMessage(chatId, `👋 Qaytganingiz bilan, ${registeredUsers[chatId]}!\n\nTest ishlash uchun **Test kodini** (masalan: 4092) yozib yuboring:`);
      } else {
        // Agar yangi foydalanuvchi bo'lsa, ismini so'raymiz
        return bot.sendMessage(chatId, `Assalomu alaykum! Iltimos, **Ism va Familiyangizni** to'liq yozib yuboring:\n\n(Misol uchun: Aliyev Vali)`);
      }
    }

    // Ismini xotiraga saqlash (faqat birinchi marta kiritganda)
    if (!registeredUsers[chatId]) {
      registeredUsers[chatId] = text;
      return bot.sendMessage(chatId, `✅ Rahmat, ${text}!\n\nEndi test ishlash uchun ustozingiz bergan **Test kodini** yozib yuboring:`);
    }

    // Test kodini qabul qilish va testni boshlash
    if (!userSessions[chatId] || userSessions[chatId].status === 'finished') {
      const testId = text;
      if (activeTests[testId]) {
        userSessions[chatId] = {
          testId: testId,
          currentQuestion: 1,
          answers: [],
          status: 'active'
        };
        sendQuestion(chatId);
      } else {
        bot.sendMessage(chatId, `❌ ${testId} kodli test topilmadi. Kodni to'g'ri yozganingizni tekshiring.`);
      }
    }
  }
});

// ==========================================
// INLINE TUGMALARNI BOSHQARISH (A, B, C, D)
// ==========================================
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id.toString();
  const data = query.data; 
  const session = userSessions[chatId];

  if (!session || session.status !== 'active') return;

  const testInfo = activeTests[session.testId];
  
  session.answers.push(data);
  session.currentQuestion++;

  if (session.currentQuestion <= testInfo.count) {
    bot.editMessageText(`📝 Test: ${session.testId}\n📌 Savol: ${session.currentQuestion} / ${testInfo.count}\n\nJavob variantini tanlang:`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: getKeyboard()
    });
  } else {
    session.status = 'finished';
    
    let score = 0;
    let wrongIndexes = [];
    const correctAnswers = testInfo.keys;

    for (let i = 0; i < testInfo.count; i++) {
      if (session.answers[i] === correctAnswers[i]) {
        score++;
      } else {
        wrongIndexes.push(i + 1);
      }
    }

    const studentName = registeredUsers[chatId];
    const userAnswersStr = session.answers.join('');

    bot.editMessageText(`✅ Test yakunlandi!\nJavoblaringiz adminga yuborildi.`, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    const resultMsg = `📊 Yangi natija!\n👤 O'quvchi: ${studentName}\n📝 Test kodi: ${session.testId}\n✅ To'g'ri: ${score}/${testInfo.count}\n❌ Xato savollar: ${wrongIndexes.length > 0 ? wrongIndexes.join(', ') : 'Yo\'q'}\n📥 O'quvchi javoblari: ${userAnswersStr}`;
    bot.sendMessage(adminId, resultMsg);
  }

  bot.answerCallbackQuery(query.id);
});

function getKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'A', callback_data: 'a' }, { text: 'B', callback_data: 'b' }],
      [{ text: 'C', callback_data: 'c' }, { text: 'D', callback_data: 'd' }]
    ]
  };
}

function sendQuestion(chatId) {
  const session = userSessions[chatId];
  const total = activeTests[session.testId].count;
  
  bot.sendMessage(chatId, `📝 Test: ${session.testId}\n📌 Savol: ${session.currentQuestion} / ${total}\n\nJavob variantini tanlang:`, {
    reply_markup: getKeyboard()
  });
}
