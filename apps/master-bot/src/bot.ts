import { Bot, session, type Context, type SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import { handleSales } from './handlers/sales.js';
import { handleDemo } from './handlers/demo.js';
import { onboardingConversation } from './conversations/onboarding.js';

export type MasterBotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;

export function createMasterBot(token: string): Bot<MasterBotContext> {
  const bot = new Bot<MasterBotContext>(token);

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());
  bot.use(createConversation(onboardingConversation as any, 'onboardingConversation'));

  bot.command('start', handleSales);
  bot.command('demo', handleDemo);
  bot.command('newstore', async (ctx) => {
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.callbackQuery('demo:view', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleDemo(ctx);
  });

  bot.callbackQuery('onboard:start', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('onboardingConversation');
  });

  bot.catch((err) => {
    console.error('[Master Bot Error]:', err.error);
  });

  return bot;
}
