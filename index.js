const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Bepul server (Render) uxlab qolmasligi uchun Veb-server
const app = express();
app.get('/', (req, res) => res.send('Bot 24/7 ishlayapti!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Veb-server ${PORT}-portda ishga tushdi`));

// --- BOT KODI ---
const token = '8832573550:AAFeIotInXzGiCwKTMBqhwMGos-DnTbMi-o'; // Tokenni kiriting
const adminId = '6891409491'; // ID ni kiriting

const bot = new TelegramBot(token, {polling: true});

// Xotiradagi ma'lumotlar
let activeTests = {};
let registeredUsers = {}; 
let adminState = null; // Adminning holatini kuzatish uchun o'zgaruvchi

bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!text) return;

  // ==========================================
  // 1. ADMIN QISMI
  // ==========================================
  if (chatId === adminId) {
    
    // Admin /start bosganda unga menyu (tugma) chiqaramiz
    if (text === '/start') {
      adminState = null; // Holatni tozalaymiz
      return bot.sendMessage(adminId, `Assalomu alaykum, Admin! Boshqaruv paneliga xush kelibsiz.`, {
        reply_markup: {
          keyboard: [[{ text: '📝 Yangi test yaratish' }]],
          resize_keyboard: true
        }
      });
    }

    // Tugma bosilganda
    if (text === '📝 Yangi test yaratish') {
      adminState = 'WAITING_FOR_TEST'; // Bot endi test kutish rejimiga o'tdi
      return bot.sendMessage(adminId, `Yangi testni quyidagi formatda yuboring:\n\n[Test_raqami] [20_ta_javob]\n\nMisol uchun: 1 abcdabcdabcdabcdabcd`);
    }

    // Agar admin "Yangi test yaratish" rejimida bo'lsa
    if (adminState === 'WAITING_FOR_TEST') {
      const parts = text.split(' ');
      
      // Admin yozgan xabarni tekshirish (faqat 2 ta qism bo'lishi kerak: raqam va javoblar)
      if (parts.length === 2 && !isNaN(parts[0])) {
        const testId = parts[0];
        const answers = parts[1].toLowerCase();
        
        if (answers.length === 20) {
          activeTests[testId] = answers; // Testni saqlash
          adminState = null; // Rejimdan chiqish
          return bot.sendMessage(adminId, `✅ ${testId}-raqamli test bazaga muvaffaqiyatli qabul qilindi!\n🔑 Kalitlar: ${answers}`);
        } else {
          return bot.sendMessage(adminId, `⚠️ Javoblar soni aniq 20 ta bo'lishi kerak. Siz ${answers.length} ta kiritdingiz. Qaytadan kiriting (Misol: 1 abcd...).`);
        }
      } else {
        return bot.sendMessage(adminId, `📝 Noto'g'ri format. Iltimos, faqat [Test_raqami] va [Javoblar] ni orasida joy tashlab yuboring.`);
      }
    }
    
    // Admin qismidan chiqish (qolgan kodlar o'quvchilar uchun)
    return; 
  }

  // ==========================================
  // 2. FOYDALANUVCHI (O'QUVCHI) QISMI
  // ==========================================
  if (chatId !== adminId) {
    
    if (text === '/start') {
      return bot.sendMessage(chatId, `Assalomu alaykum! Test ishlashdan oldin, iltimos, **Ism va Familiyangizni** to'liq yozib yuboring:\n\n(Misol uchun: Aliyev Vali)`, {parse_mode: 'Markdown'});
    }

    if (!registeredUsers[chatId]) {
      const parts = text.split(' ');
      if (parts.length === 2 && !isNaN(parts[0]) && parts[1].length === 20) {
        return bot.sendMessage(chatId, `⚠️ Siz hali ismingizni kiritmadingiz. Iltimos, avval Ism va Familiyangizni yozib yuboring!`);
      }

      registeredUsers[chatId] = text;
      return bot.sendMessage(chatId, `✅ Rahmat, ${text}!\n\nEndi test javoblarini quyidagi formatda yuborishingiz mumkin:\n[Test_raqami] [Javoblaringiz]\n\nMisol: 1 abcdabcdabcdabcdabcd`);
    }

    const parts = text.split(' ');
    if (parts.length === 2 && !isNaN(parts[0])) {
      const testId = parts[0];
      const userAnswers = parts[1].toLowerCase();

      if (activeTests[testId]) {
        if (userAnswers.length === 20) {
          const correctAnswers = activeTests[testId];
          let score = 0;
          let wrongIndexes = [];

          for (let i = 0; i < 20; i++) {
            if (userAnswers[i] === correctAnswers[i]) {
              score++;
            } else {
              wrongIndexes.push(i + 1);
            }
          }

          const studentName = registeredUsers[chatId]; 

          const resultMsg = `📊 Yangi natija!\n👤 O'quvchi: ${studentName}\n📝 Test: ${testId}\n✅ To'g'ri: ${score}/20\n❌ Xato savollar: ${wrongIndexes.length > 0 ? wrongIndexes.join(', ') : 'Yo\'q'}`;
          bot.sendMessage(adminId, resultMsg);
          
          bot.sendMessage(chatId, `✅ Javoblaringiz qabul qilindi va tekshiruvchiga yuborildi.`);
        } else {
          bot.sendMessage(chatId, `⚠️ Javoblar soni 20 ta bo'lishi kerak. Siz ${userAnswers.length} ta yozdingiz.`);
        }
      } else {
        bot.sendMessage(chatId, `❌ ${testId}-raqamli test bazada topilmadi.`);
      }
    } else {
      bot.sendMessage(chatId, `⚠️ Noto'g'ri format. Iltimos, [Test_raqami] va [Javoblaringiz] ko'rinishida yozing.`);
    }
  }
});
