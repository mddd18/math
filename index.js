const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Bepul server (Render) uxlab qolmasligi uchun kichik Veb-server
const app = express();
app.get('/', (req, res) => res.send('Bot 24/7 ishlayapti!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Veb-server ${PORT}-portda ishga tushdi`));

// --- BOT KODI ---
const token = '8832573550:AAFeIotInXzGiCwKTMBqhwMGos-DnTbMi-o'; // Tokenni kiriting
const adminId = '6891409491'; // ID ni kiriting

const bot = new TelegramBot(token, {polling: true});
let activeTests = {};

bot.on('message', (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'Talaba';

  if (!text) return;

  // Admin qismi
  if (chatId === adminId && text.startsWith('/newtest')) {
    const parts = text.split(' ');
    if (parts.length === 3) {
      const testId = parts[1];
      const answers = parts[2].toLowerCase();
      if (answers.length === 20) {
        activeTests[testId] = answers;
        bot.sendMessage(adminId, `✅ ${testId}-raqamli test bazaga qabul qilindi.\nKalitlar: ${answers}`);
      } else {
        bot.sendMessage(adminId, `⚠️ Javoblar soni aniq 20 ta bo'lishi kerak.`);
      }
    } else {
      bot.sendMessage(adminId, `📝 Noto'g'ri format. /newtest [raqam] [javoblar]`);
    }
    return;
  }

  // Foydalanuvchi qismi
  if (chatId !== adminId) {
    if (text === '/start') {
      return bot.sendMessage(chatId, `Assalomu alaykum! Test javoblarini quyidagi formatda yuboring:\n[Test_raqami] [Javoblaringiz]`);
    }

    const parts = text.split(' ');
    if (parts.length === 2) {
      const testId = parts[0];
      const userAnswers = parts[1].toLowerCase();

      if (activeTests[testId]) {
        if (userAnswers.length === 20) {
          const correctAnswers = activeTests[testId];
          let score = 0;
          let wrongIndexes = [];

          for (let i = 0; i < 20; i++) {
            if (userAnswers[i] === correctAnswers[i]) score++;
            else wrongIndexes.push(i + 1);
          }

          const resultMsg = `📊 Yangi natija!\n👤 O'quvchi: ${userName}\n📝 Test: ${testId}\n✅ To'g'ri: ${score}/20\n❌ Xato savollar: ${wrongIndexes.join(', ') || 'Yo\'q'}`;
          bot.sendMessage(adminId, resultMsg);
          bot.sendMessage(chatId, `✅ Javoblaringiz qabul qilindi.`);
        } else {
          bot.sendMessage(chatId, `⚠️ Javoblar soni 20 ta bo'lishi kerak.`);
        }
      } else {
        bot.sendMessage(chatId, `❌ ${testId}-raqamli test bazada topilmadi.`);
      }
    }
  }
});
