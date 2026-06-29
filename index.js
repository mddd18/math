const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot 24/7 ishlayapti!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Veb-server ${PORT}-portda ishga tushdi`));

// --- BOT SOZLAMALARI ---
const token = '8832573550:AAFeIotInXzGiCwKTMBqhwMGos-DnTbMi-o';
const adminId = '903004024';
const bot = new TelegramBot(token, {polling: true});

// --- MA'LUMOTLAR BAZASI (Xotirada) ---
let groups = {}; // { "5566": "101-guruh" }
let users = {}; // { chatId: { name: "Ali", groupCode: "5566" } }
let tests = {}; // { "1234": { title: "Matematika", count: 10, keys: "abcd...", createdAt: 168... } }

// NATIJALAR BAZASI (Guruh kesimida saqlanadi)
// Format: { "1234" (TestID): { "5566" (GuruhKodi): [ { name: "Ali", score: 8 } ] } }
let results = {}; 

// Vaqtinchalik holatlar
let adminState = null;
let adminTempData = {};
let userRegState = {}; 
let userSessions = {}; 

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Admin klaviaturasi
const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📝 Yangi test yaratish' }, { text: '🏢 Yangi guruh yaratish' }],
      [{ text: '📊 Natijalarni ko\'rish' }, { text: '📋 Baza holati' }]
    ],
    resize_keyboard: true
  }
};

// ==========================================
// XABARLARNI QABUL QILISH
// ==========================================
bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;
  if (!text) return;

  // ================= ADMIN QISMI =================
  if (chatId === adminId) {
    if (text === '/start') {
      adminState = null; 
      return bot.sendMessage(adminId, `👨‍💻 Admin paneliga xush kelibsiz!`, adminKeyboard);
    }

    // 1. GURUH YARATISH
    if (text === '🏢 Yangi guruh yaratish') {
      adminState = 'WAITING_GROUP_NAME';
      return bot.sendMessage(adminId, `Guruh nomini yozing (Masalan: 101-guruh):`);
    }
    if (adminState === 'WAITING_GROUP_NAME') {
      const groupCode = Math.floor(1000 + Math.random() * 9000).toString();
      groups[groupCode] = text;
      adminState = null;
      return bot.sendMessage(adminId, `✅ Guruh yaratildi!\n\n🏢 Nom: ${text}\n🔐 **Kirish kodi: ${groupCode}**\n\nO'quvchilarga ro'yxatdan o'tishlari uchun shu kodni bering.`, {parse_mode: 'Markdown'});
    }

    // 2. TEST YARATISH
    if (text === '📝 Yangi test yaratish') {
      adminState = 'WAITING_TEST_TOPIC';
      return bot.sendMessage(adminId, `Test qaysi mavzuda bo'ladi? (Mavzu nomini yozing):`);
    }
    if (adminState === 'WAITING_TEST_TOPIC') {
      adminTempData.topic = text;
      adminState = 'WAITING_FOR_COUNT';
      return bot.sendMessage(adminId, `Bu test nechta savoldan iborat bo'ladi? (Raqam kiriting):`);
    }
    if (adminState === 'WAITING_FOR_COUNT') {
      const count = parseInt(text);
      if (!isNaN(count) && count > 0) {
        adminTempData.count = count;
        adminState = 'WAITING_FOR_KEYS';
        return bot.sendMessage(adminId, `✅ Savollar soni: ${count} ta.\n\nEndi javoblarni (kalitlarni) yuboring.\nMisol: ${'a'.repeat(Math.min(count, 5))}...`);
      }
    }
    if (adminState === 'WAITING_FOR_KEYS') {
      const answers = text.toLowerCase();
      if (answers.length === adminTempData.count) {
        const testId = Math.floor(1000 + Math.random() * 9000).toString(); 
        
        tests[testId] = { 
          title: adminTempData.topic,
          count: adminTempData.count, 
          keys: answers,
          createdAt: Date.now()
        };
        
        // Test uchun bo'sh ob'ekt yaratamiz (ichiga guruhlar qo'shilib boradi)
        results[testId] = {}; 
        
        adminState = null; 
        return bot.sendMessage(adminId, `🎉 Test tayyor!\n\n📁 Mavzu: ${adminTempData.topic}\n📌 **Test ID: ${testId}**\n📝 Savollar: ${adminTempData.count} ta\n⏳ Vaqt: 24 soat faol.\n\nO'quvchilarga **${testId}** kodini bering.`, {parse_mode: 'Markdown'});
      } else {
        return bot.sendMessage(adminId, `⚠️ Javoblar soni aniq ${adminTempData.count} ta bo'lishi kerak. Siz ${answers.length} ta yozdingiz.`);
      }
    }

    // 3. NATIJALARNI KO'RISH
    if (text === '📊 Natijalarni ko\'rish') {
      adminState = 'WAITING_TEST_ID_RESULTS';
      return bot.sendMessage(adminId, `Qaysi test natijalarini ko'rmoqchisiz? Test ID sinini yozing:`);
    }
    if (adminState === 'WAITING_TEST_ID_RESULTS') {
      const testId = text;
      if (!tests[testId]) {
        return bot.sendMessage(adminId, `❌ Bunday ID ga ega test topilmadi.`);
      }
      
      const testResultsByGroup = results[testId];
      if (!testResultsByGroup || Object.keys(testResultsByGroup).length === 0) {
        adminState = null;
        return bot.sendMessage(adminId, `📁 **${tests[testId].title}**\nHali hech kim bu testni yechmadi.`, {parse_mode: 'Markdown'});
      }

      let reportMsg = `📊 **Natijalar: ${tests[testId].title}** (ID: ${testId})\n\n`;
      
      // Guruhlar bo'ylab aylanib chiqamiz
      for (let gCode in testResultsByGroup) {
        const gName = groups[gCode] || "Noma'lum guruh (O'chirilgan)";
        reportMsg += `🏢 **--- ${gName} ---**\n`;
        
        // O'sha guruh o'quvchilarini olamiz va balliga qarab saralaymiz
        let students = testResultsByGroup[gCode];
        students.sort((a, b) => b.score - a.score);
        
        students.forEach((r, index) => {
          reportMsg += `  ${index + 1}. ${r.name} — ${r.score}/${tests[testId].count}\n`;
        });
        reportMsg += `\n`;
      }

      adminState = null;
      return bot.sendMessage(adminId, reportMsg, {parse_mode: 'Markdown'});
    }

    // 4. BAZA HOLATI
    if (text === '📋 Baza holati') {
      return bot.sendMessage(adminId, `Tizim holati:\nJami guruhlar: ${Object.keys(groups).length} ta\nJami o'quvchilar: ${Object.keys(users).length} ta\nJami testlar: ${Object.keys(tests).length} ta`);
    }
    
    return;
  }

  // ================= FOYDALANUVCHI QISMI =================
  if (chatId !== adminId) {
    
    // Ro'yxatdan o'tgan bo'lsa
    if (users[chatId]) {
      if (text === '/start') {
        return bot.sendMessage(chatId, `👋 Qaytganingiz bilan, ${users[chatId].name}!\n🏢 Guruhingiz: ${groups[users[chatId].groupCode]}\n\nTest ishlash uchun ustozingiz bergan **Test ID** sinini yozib yuboring:`, {parse_mode: 'Markdown'});
      }

      // Test ishlash jarayoni
      if (!userSessions[chatId] || userSessions[chatId].status === 'finished') {
        const testId = text;
        const testData = tests[testId];

        if (testData) {
          // 24 soatlik limitni tekshirish
          if (Date.now() - testData.createdAt > ONE_DAY_MS) {
            return bot.sendMessage(chatId, `⏳ Kechirasiz, ushbu testning faollik muddati (24 soat) tugagan.`);
          }
          
          // O'quvchi oldin bu testni ishlaganligini tekshirish
          const groupResults = results[testId][users[chatId].groupCode] || [];
          const alreadyTaken = groupResults.find(r => r.chatId === chatId);
          
          if (alreadyTaken) {
            return bot.sendMessage(chatId, `❌ Siz bu testni allaqachon ishlagansiz. Qayta ishlash mumkin emas.`);
          }

          userSessions[chatId] = { testId: testId, currentQuestion: 1, answers: [], status: 'active' };
          sendQuestion(chatId);
        } else {
          bot.sendMessage(chatId, `❌ ${testId} kodli test topilmadi. Kodni to'g'ri yozganingizni tekshiring.`);
        }
      }
      return;
    }

    // --- RO'YXATDAN O'TISH JARAYONI ---
    if (text === '/start') {
      userRegState[chatId] = { step: 'WAITING_NAME' };
      return bot.sendMessage(chatId, `Assalomu alaykum! Tizimdan foydalanish uchun **Ism va Familiyangizni** to'liq yozib yuboring:\n(Misol: Aliyev Vali)`, {parse_mode: 'Markdown'});
    }

    if (userRegState[chatId]?.step === 'WAITING_NAME') {
      userRegState[chatId].name = text;
      userRegState[chatId].step = 'WAITING_CODE';
      return bot.sendMessage(chatId, `✅ Rahmat!\n\nEndi guruhingizga qo'shilish uchun ustozingiz bergan **Guruh kirish kodini** yozib yuboring:`, {parse_mode: 'Markdown'});
    }

    if (userRegState[chatId]?.step === 'WAITING_CODE') {
      const code = text.trim();
      if (groups[code]) {
        users[chatId] = { name: userRegState[chatId].name, groupCode: code };
        delete userRegState[chatId]; 
        
        return bot.sendMessage(chatId, `🎉 Tabriklaymiz, siz **${groups[code]}** guruhiga qabul qilindingiz!\n\nTest ishlash uchun **Test ID** raqamini yozib yuboring:`, {parse_mode: 'Markdown'});
      } else {
        return bot.sendMessage(chatId, `❌ Noto'g'ri kod! Bunday guruh tizimda yo'q. Iltimos, ustozingizdan kodni aniqlab qaytadan yozing:`);
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

  const testInfo = tests[session.testId];
  
  session.answers.push(data);
  session.currentQuestion++;

  if (session.currentQuestion <= testInfo.count) {
    bot.editMessageText(`📁 Mavzu: ${testInfo.title}\n📌 Savol: ${session.currentQuestion} / ${testInfo.count}\n\nJavob variantini tanlang:`, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: getKeyboard()
    });
  } else {
    // TEST YAKUNLANDI
    session.status = 'finished';
    
    let score = 0;
    const correctAnswers = testInfo.keys;

    for (let i = 0; i < testInfo.count; i++) {
      if (session.answers[i] === correctAnswers[i]) score++;
    }

    const userData = users[chatId];
    
    // Natijani Guruh Kesimida bazaga saqlash
    if (!results[session.testId][userData.groupCode]) {
      results[session.testId][userData.groupCode] = []; // Agar guruh ro'yxati hali ochilmagan bo'lsa, ochamiz
    }

    results[session.testId][userData.groupCode].push({
      chatId: chatId,
      name: userData.name,
      score: score,
      answers: session.answers.join('')
    });

    bot.editMessageText(`🏁 Test yakunlandi!\n\n📁 Mavzu: ${testInfo.title}\n📊 Sizning natijangiz: ${score} / ${testInfo.count}\n\nJavoblaringiz qabul qilindi.`, {
      chat_id: chatId,
      message_id: query.message.message_id
    });
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
  const testInfo = tests[session.testId];
  
  bot.sendMessage(chatId, `📁 Mavzu: ${testInfo.title}\n📌 Savol: ${session.currentQuestion} / ${testInfo.count}\n\nJavob variantini tanlang:`, {
    reply_markup: getKeyboard()
  });
}
