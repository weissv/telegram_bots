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
🚀 <b>Zero-Touch Storefront Setup Wizard</b>

Let's set up your automated Telegram E-Commerce Store in under 2 minutes!

<b>Step 1 of 4:</b> What is the name of your Store/Brand?
<i>(e.g., Cyberpunk Streetwear, Tokyo Bakery, Nova Gadgets)</i>
`.trim(),
    { parse_mode: 'HTML' }
  );

  const nameMsg = await conversation.waitFor(':text');
  const storeName = nameMsg.message?.text?.trim() || 'My Telegram Store';

  await ctx.reply(
    `
<b>Step 2 of 4:</b> Enter your <b>@BotFather API Token</b>.

1. Open @BotFather on Telegram.
2. Send /newbot and follow instructions to get your API Token.
3. Paste the token here (e.g., <code>123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ</code>):
`.trim(),
    { parse_mode: 'HTML' }
  );

  let botToken = '';
  let botUsername = '';

  while (true) {
    const tokenMsg = await conversation.waitFor(':text');
    const inputToken = tokenMsg.message?.text?.trim() || '';

    await ctx.reply('🔍 <i>Verifying credentials with Telegram Bot API...</i>', { parse_mode: 'HTML' });

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

    await ctx.reply('❌ <b>Invalid Bot Token.</b> Please check your token from @BotFather and try again:');
  }

  await ctx.reply(
    `
✅ <b>Bot Verified:</b> @${botUsername}

<b>Step 3 of 4:</b> Choose your Subscription Plan:
1. Send <code>1</code> for <b>Basic Inline Bot ($20/mo)</b>
2. Send <code>2</code> for <b>Pro Mini App Storefront ($30/mo)</b>
`.trim(),
    { parse_mode: 'HTML' }
  );

  const planMsg = await conversation.waitFor(':text');
  const planChoice = planMsg.message?.text?.trim();
  const selectedPlan = planChoice === '1' ? PLAN_TIERS.BASIC_20 : PLAN_TIERS.PRO_30;

  await ctx.reply(
    `
<b>Step 4 of 4:</b> Enter your merchant email address for Admin Backoffice login:
`.trim(),
    { parse_mode: 'HTML' }
  );

  const emailMsg = await conversation.waitFor(':text');
  const adminEmail = emailMsg.message?.text?.trim() || `merchant_${Date.now()}@telegram-commerce.local`;

  // Generate temporary password
  const tempPassword = `Pass_${Math.random().toString(36).substring(2, 10)}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await ctx.reply('⚙️ <i>Provisioning database, encrypting keys, and registering webhooks...</i>', {
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
              description: `Official Telegram Storefront for ${storeName}`,
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
            text: '🛍️ Open Store',
            web_app: { url: miniappUrl },
          },
        }),
      });
    }

    const adminPanelUrl = `${env.PUBLIC_ADMIN_URL}`;

    await ctx.reply(
      `
🎉 <b>CONGRATULATIONS! YOUR STORE IS LIVE!</b>

🤖 <b>Customer Bot:</b> @${botUsername}
🌐 <b>Storefront URL:</b> ${env.PUBLIC_MINIAPP_URL}?tenant_id=${tenant.id}
💼 <b>Merchant Admin Backoffice:</b> ${adminPanelUrl}

🔐 <b>Your Admin Credentials:</b>
 • <b>Email:</b> <code>${adminEmail}</code>
 • <b>Password:</b> <code>${tempPassword}</code>

⚡ <i>Open your bot @${botUsername} in Telegram to start adding products and taking orders!</i>
`.trim(),
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Provisioning error: ${err.message}. Please contact support.`);
  }
}
