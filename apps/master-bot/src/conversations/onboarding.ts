import { type Conversation } from '@grammyjs/conversations';
import { type Context } from 'grammy';
import bcrypt from 'bcryptjs';
import { prisma } from '@telegram-commerce/database';
import { encryptBotToken, generateWebhookSecret, getEnv, PLAN_TIERS } from '@telegram-commerce/config';

type MasterContext = Context;
type MasterConversation = Conversation<MasterContext>;

export async function onboardingConversation(conversation: MasterConversation, ctx: MasterContext) {
  const env = getEnv();
  const telegramUserId = ctx.from?.id ? String(ctx.from.id) : '';

  await ctx.reply(
    `
🚀 <b>Мастер создания интернет-магазина в Telegram</b>

Настроим ваш автоматизированный магазин менее чем за 2 минуты!

<b>Шаг 1 из 4:</b> Как называется ваш магазин или бренд?
<i>(Например: Mirai Store, Модная Одежда, Электроника 24)</i>
`.trim(),
    { parse_mode: 'HTML' }
  );

  const nameMsg = await conversation.waitFor(':text');
  const storeName = nameMsg.message?.text?.trim() || 'Мой Магазин';

  await ctx.reply(
    `
<b>Шаг 2 из 4:</b> Введите API-токен бота от <b>@BotFather</b>.

1. Откройте @BotFather в Telegram.
2. Отправьте команду /newbot и следуйте шагам для получения токена.
3. Отправьте полученный токен в этот чат (например, <code>123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ</code>):
`.trim(),
    { parse_mode: 'HTML' }
  );

  let botToken = '';
  let botUsername = '';

  while (true) {
    const tokenMsg = await conversation.waitFor(':text');
    const inputToken = tokenMsg.message?.text?.trim() || '';

    await ctx.reply('🔍 <i>Проверяем токен через Telegram Bot API...</i>', { parse_mode: 'HTML' });

    try {
      const res = await fetch(`https://api.telegram.org/bot${inputToken}/getMe`);
      const data = (await res.json()) as any;

      if (data.ok && data.result?.username) {
        botToken = inputToken;
        botUsername = data.result.username;
        break;
      }
    } catch {
      // API call failure
    }

    await ctx.reply('❌ <b>Неверный токен бота.</b> Пожалуйста, перепроверьте токен от @BotFather и попробуйте еще раз:');
  }

  await ctx.reply(
    `
✅ <b>Бот подтвержден:</b> @${botUsername}

<b>Шаг 3 из 4:</b> Выберите тариф подписки:
1. Отправьте <code>1</code> — <b>Базовый чат-бот ($20/мес)</b>
2. Отправьте <code>2</code> — <b>Pro Mini App витрина ($30/мес)</b>
`.trim(),
    { parse_mode: 'HTML' }
  );

  const planMsg = await conversation.waitFor(':text');
  const planChoice = planMsg.message?.text?.trim();
  const selectedPlan = planChoice === '1' ? PLAN_TIERS.BASIC_20 : PLAN_TIERS.PRO_30;

  await ctx.reply(
    `
<b>Шаг 4 из 4:</b> Введите ваш Email для входа в панель управления магазином:
`.trim(),
    { parse_mode: 'HTML' }
  );

  const emailMsg = await conversation.waitFor(':text');
  const adminEmail = emailMsg.message?.text?.trim() || `merchant_${Date.now()}@telegram-commerce.local`;

  // Generate temporary password
  const tempPassword = `Pass_${Math.random().toString(36).substring(2, 10)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await ctx.reply('⚙️ <i>Создаем базу данных магазина, шифруем ключи и настраиваем вебхуки...</i>', {
    parse_mode: 'HTML',
  });

  try {
    const encryptedToken = encryptBotToken(botToken);
    const webhookSecret = generateWebhookSecret();

    // 1. Create Tenant and BotConfig
    const tenant = await prisma.tenant.create({
      data: {
        name: storeName,
        owner_telegram_id: telegramUserId,
        plan: selectedPlan as any,
        is_active: true,
        botConfig: {
          create: {
            bot_token_encrypted: encryptedToken,
            bot_username: botUsername,
            webhook_secret: webhookSecret,
            currency: 'USD',
            theme_config: {
              storeName,
              primaryColor: '#0ea5e9',
              description: `Официальный Telegram-магазин ${storeName}`,
            },
          },
        },
        adminUsers: {
          create: {
            email: adminEmail,
            password_hash: passwordHash,
            role: 'OWNER',
          },
        },
      },
    });

    // 2. Set Webhook on Telegram API
    const webhookUrl = `${env.PUBLIC_API_URL}/api/v1/webhooks/${tenant.id}`;
    await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${webhookSecret}`
    );

    // 3. Set Chat Menu Button if Pro
    if (selectedPlan === PLAN_TIERS.PRO_30) {
      const miniappUrl = `${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}`;
      await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: '🛍️ Открыть магазин',
            web_app: { url: miniappUrl },
          },
        }),
      });
    }

    const adminPanelUrl = `${env.PUBLIC_ADMIN_URL}`;

    await ctx.reply(
      `
🎉 <b>ПОЗДРАВЛЯЕМ! ВАШ МАГАЗИН ЗАПУЩЕН!</b>

🤖 <b>Бот магазина для покупателей:</b> @${botUsername}
🌐 <b>Витрина (Mini App):</b> ${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}
💼 <b>Веб-панель управления:</b> ${adminPanelUrl}

🔐 <b>Ваши данные для входа в панель:</b>
 • <b>Email:</b> <code>${adminEmail}</code>
 • <b>Пароль:</b> <code>${tempPassword}</code>

⚡ <i>Перейдите в бота @${botUsername} или откройте веб-панель для добавления товаров и управления заказами!</i>
`.trim(),
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Ошибка создания магазина: ${err.message}. Пожалуйста, обратитесь в поддержку.`);
  }
}
