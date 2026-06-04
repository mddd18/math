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
let activeTests = {}; // { '1': { keys: 'abcd...', count: 30 } }
let registeredUsers = {}; 
let adminState = null; 
let tempTestCount = 0; // Admin kiritgan savollar sonini ushlab turish uchun

bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!text) return;

  // ==========================================
  // 1. ADMIN QISMI
  // ==========================================
  if (chatId === adminId) {
    
    // Asosiy menyu
    if (text === '/start') {
      adminState = null; 
      return bot.sendMessage(adminId, `Ассалаўма алейкум, Админ! Басқарыў панельине хош келдиңиз.`, {
        reply_markup: {
          keyboard: [[{ text: '📝 Жаңа тест жаратыў' }]],
          resize_keyboard: true
        }
      });
    }

    // 1-bosqich: Savollar sonini so'rash
    if (text === '📝 Жаңа тест жаратыў') {
      adminState = 'WAITING_FOR_COUNT'; 
      return bot.sendMessage(adminId, `Бул тест неше сораўдан ибарат болады?\n\nИлтимас, тек сан киргизиң (мәселен: 30)`);
    }

    // 2-bosqich: Sonini qabul qilib, kalitlarni so'rash
    if (adminState === 'WAITING_FOR_COUNT') {
      const count = parseInt(text);
      if (!isNaN(count) && count > 0) {
        tempTestCount = count; // Sonini xotiraga olamiz
        adminState = 'WAITING_FOR_TEST';
        return bot.sendMessage(adminId, `әжайып! Тест сораўлары саны: ${count}.\n\nЕнди тест гилтлерин төмендеги форматта жибериң:\n[Тест_номери] [жуўаплар]\n\nМысал ушын: 1 ${'a'.repeat(Math.min(count, 5))}...`);
      } else {
        return bot.sendMessage(adminId, `⚠️ Надурис мәнис. Сораўлар санын цифрда киргизиң (Мысалы: 25).`);
      }
    }

    // 3-bosqich: Testni saqlash
    if (adminState === 'WAITING_FOR_TEST') {
      const parts = text.split(' ');
      
      if (parts.length === 2 && !isNaN(parts[0])) {
        const testId = parts[0];
        const answers = parts[1].toLowerCase();
        
        // Uzunlik admin boshida aytgan songa tengligini tekshiramiz
        if (answers.length === tempTestCount) {
          activeTests[testId] = {
            keys: answers,
            count: tempTestCount
          };
          adminState = null; 
          return bot.sendMessage(adminId, `✅ ${testId}-санлы тест базаға қабыл етилди!\nСораўлар саны: ${tempTestCount} \n🔑 гилтлер: ${answers}`);
        } else {
          return bot.sendMessage(adminId, `⚠️ Javoblar soni aniq ${tempTestCount} ta bo'lishi kerak. Siz ${answers.length} ta kiritdingiz. Qaytadan kiriting.`);
        }
      } else {
        return bot.sendMessage(adminId, `📝 Noto'g'ri format. Iltimos, [Test_raqami] va [Javoblar] ni orasida joy tashlab yuboring.`);
      }
    }
    
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
      if (parts.length === 2 && !isNaN(parts[0]) && activeTests[parts[0]]) {
        return bot.sendMessage(chatId, `⚠️ Siz hali ismingizni kiritmadingiz. Iltimos, avval Ism va Familiyangizni yozib yuboring!`);
      }

      registeredUsers[chatId] = text;
      return bot.sendMessage(chatId, `✅ Rahmat, ${text}!\n\nEndi test javoblarini quyidagi formatda yuborishingiz mumkin:\n[Test_raqami] [Javoblaringiz]`);
    }

    const parts = text.split(' ');
    if (parts.length === 2 && !isNaN(parts[0])) {
      const testId = parts[0];
      const userAnswers = parts[1].toLowerCase();

      if (activeTests[testId]) {
        const testInfo = activeTests[testId]; // Testning kalitlari va sonini olamiz
        
        if (userAnswers.length === testInfo.count) {
          const correctAnswers = testInfo.keys;
          let score = 0;
          let wrongIndexes = [];

          for (let i = 0; i < testInfo.count; i++) {
            if (userAnswers[i] === correctAnswers[i]) {
              score++;
            } else {
              wrongIndexes.push(i + 1);
            }
          }

          const studentName = registeredUsers[chatId]; 

          // Natija faqat Adminga boradi
          const resultMsg = `📊 Yangi natija!\n👤 O'quvchi: ${studentName}\n📝 Test: ${testId}\n✅ To'g'ri: ${score}/${testInfo.count}\n❌ Xato savollar: ${wrongIndexes.length > 0 ? wrongIndexes.join(', ') : 'Yo\'q'}`;
          bot.sendMessage(adminId, resultMsg);
          
          // O'quvchiga faqat qabul qilinganligi haqida xabar boradi
          bot.sendMessage(chatId, `✅ Javoblaringiz qabul qilindi va tekshiruvchiga yuborildi.`);
        } else {
          bot.sendMessage(chatId, `⚠️ Bu test aniq ${testInfo.count} ta savoldan iborat. Siz ${userAnswers.length} ta yozdingiz.`);
        }
      } else {
        bot.sendMessage(chatId, `❌ ${testId}-raqamli test bazada topilmadi.`);
      }
    } else {
      bot.sendMessage(chatId, `⚠️ Noto'g'ri format. Iltimos, [Test_raqami] [Javoblaringiz] ko'rinishida yozing.`);
    }
  }
});
