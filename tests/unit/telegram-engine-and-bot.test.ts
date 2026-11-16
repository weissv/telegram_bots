import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_PAYNET_QR_URL, ORDER_STATUS, PAYMENT_METHODS, PLAN_TIERS } from '@telegram-commerce/config';

const { mockPrisma, mockTenantDb, resetDbMocks } = vi.hoisted(() => {
  process.env.MODE = 'saas';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/telegram_commerce';
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345678';

  const mockTx = {
    product: {
      findFirst: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };

  const mockTenantDb = {
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockPrisma = {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)),
    __tx: mockTx,
  };

  function resetDbMocks() {
    mockTx.product.findFirst.mockReset();
    mockTx.order.create.mockReset();
    mockTx.order.findFirst.mockReset();
    mockTx.order.updateMany.mockReset();
    mockTx.$executeRaw.mockReset();
    mockTenantDb.order.findFirst.mockReset();
    mockTenantDb.order.update.mockReset();
    Object.values(mockPrisma.tenant).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.subscription).forEach((fn) => fn.mockReset());
    mockPrisma.$transaction.mockClear();
  }

  return { mockPrisma, mockTenantDb, resetDbMocks };
});

vi.mock('@telegram-commerce/database', () => ({
  prisma: mockPrisma,
  getTenantDb: vi.fn(() => mockTenantDb),
}));

import {
  handleStart,
  handleCatalog,
  handleCartCheckout,
  sendMerchantOrderAlert,
  sendCustomerOrderReceipt,
  createTenantBot,
} from '@telegram-commerce/telegram-engine';
import {
  buildSubConfirmCallback,
  parseSubConfirmCallback,
  buildAdminSubApproveCallback,
  buildAdminSubSuspendCallback,
  parseAdminSubCallback,
  getPlanDetails,
} from '../../apps/master-bot/src/utils.js';
import { createMasterBot } from '../../apps/master-bot/src/bot.js';

describe('Telegram Engine Paynet, Localization & Master Bot Utils', () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it('handleStart formats deep-linked product prices in UZS instead of hardcoded USD', async () => {
    const replies: Array<{ text: string; opts: any }> = [];
    const ctx: any = {
      locale: 'uz',
      match: 'prod_p1',
      session: { languageSelected: true, cart: [] },
      tenant: {
        id: 't1',
        name: 'UZ Shop',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '111',
        currency: 'UZS',
        themeConfig: {},
      },
      db: {
        product: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'p1',
            title: 'Chapan',
            category: 'Apparel',
            description: 'Handcrafted',
            price: 420000,
            stock: 7,
            images: [],
          }),
        },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleStart(ctx);

    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain("420 000 so'm");
    expect(replies[0].text).not.toContain('$420000');
  });

  it('handleCatalog shows "Status" in English locale and formats UZS prices', async () => {
    const replies: Array<{ text: string; opts: any }> = [];
    const ctx: any = {
      locale: 'en',
      session: { currentCategory: undefined, catalogPage: 1 },
      tenant: {
        id: 't1',
        name: 'UZ Shop',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '111',
        currency: 'UZS',
        themeConfig: {},
      },
      db: {
        product: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: 'p1',
                title: 'Silk Scarf',
                category: 'Accessories',
                description: 'Pure silk',
                price: 150000,
                stock: 15,
                images: [],
              },
            ])
            .mockResolvedValueOnce([{ category: 'Accessories' }]),
        },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleCatalog(ctx, 1);

    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain('<b>Status:</b>');
    expect(replies[0].text).not.toContain('Holat');
    expect(replies[0].text).toContain("150 000 so'm");
  });

  it('handleCartCheckout atomically decrements stock and sends 2-row Paynet InlineKeyboard', async () => {
    mockPrisma.__tx.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      title: 'Tashkent Hoodie',
      price: 420000,
      stock: 5,
      is_active: true,
    });
    mockPrisma.__tx.$executeRaw.mockResolvedValue(1);
    mockPrisma.__tx.order.create.mockResolvedValue({
      id: '12345678-aaaa-bbbb-cccc-1234567890ab',
      total_amount: 840000,
    });

    const replies: Array<{ text: string; opts: any }> = [];
    const ctx: any = {
      locale: 'ru',
      from: { id: 987654, first_name: 'Dilshod' },
      session: {
        cart: [{ productId: 'prod-1', title: 'Tashkent Hoodie', price: 420000, quantity: 2 }],
        shippingAddress: 'Tashkent',
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: { paynetQrUrl: DEFAULT_PAYNET_QR_URL },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleCartCheckout(ctx);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
          status: ORDER_STATUS.PENDING,
          total_amount: 840000,
        }),
      })
    );

    expect(ctx.session.cart).toEqual([]);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain("840 000 so'm");

    const inlineKeyboard = replies[0].opts.reply_markup.inline_keyboard;
    expect(inlineKeyboard).toHaveLength(2);
    expect(inlineKeyboard[0][0].url).toBe(DEFAULT_PAYNET_QR_URL);
    expect(inlineKeyboard[1][0].callback_data).toBe('order:pay:12345678-aaaa-bbbb-cccc-1234567890ab');
  });

  it('handleCartCheckout aborts checkout and preserves cart when stock is insufficient', async () => {
    mockPrisma.__tx.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      title: 'Tashkent Hoodie',
      price: 420000,
      stock: 1,
      is_active: true,
    });
    mockPrisma.__tx.$executeRaw.mockResolvedValue(0);

    const replies: Array<{ text: string; opts: any }> = [];
    const ctx: any = {
      locale: 'en',
      from: { id: 987654, first_name: 'Dilshod' },
      session: {
        cart: [{ productId: 'prod-1', title: 'Tashkent Hoodie', price: 420000, quantity: 3 }],
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: {},
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleCartCheckout(ctx);

    expect(mockPrisma.__tx.order.create).not.toHaveBeenCalled();
    expect(ctx.session.cart).toHaveLength(1);
    expect(replies[0].text).toContain('Insufficient stock');
  });

  it('sendMerchantOrderAlert & sendCustomerOrderReceipt format UZS values cleanly and attach 1-click merchant action buttons', async () => {
    const sentMessages: Array<{ chatId: string | number; text: string; extra: any }> = [];
    const fakeBot: any = {
      api: {
        sendMessage: vi.fn(async (chatId: string | number, text: string, extra?: any) => {
          sentMessages.push({ chatId, text, extra });
        }),
      },
    };

    const orderId = 'abcdef12-0000-0000-0000-000000000000';
    await sendMerchantOrderAlert(fakeBot, '8240936731', {
      orderId,
      totalAmount: 420000,
      currency: 'UZS',
      customerTelegramId: '555666',
      customerName: 'Aziz',
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    });

    await sendCustomerOrderReceipt(fakeBot, '555666', {
      orderId,
      totalAmount: 420000,
      currency: 'UZS',
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    });

    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0].text).toContain("420 000 so'm");
    expect(sentMessages[0].text).not.toContain('420000.00');
    const merchantKb = sentMessages[0].extra?.reply_markup?.inline_keyboard;
    expect(merchantKb).toHaveLength(2);
    expect(merchantKb[0][0].callback_data).toBe(`merchant:order:deliver:${orderId}`);
    expect(merchantKb[1][0].callback_data).toBe(`merchant:order:cancel:${orderId}`);
    expect(sentMessages[1].text).toContain("420 000 so'm");
    expect(sentMessages[1].text).not.toContain('420000.00');
  });

  it('createTenantBot registers cleanly and buildSubConfirmCallback respects 64-byte Telegram limit', () => {
    const bot = createTenantBot({
      botToken: '123456:TEST_TOKEN',
      tenant: {
        id: 't1',
        name: 'Test Store',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '111',
        currency: 'UZS',
        themeConfig: { paynetEnabled: true, paynetQrUrl: DEFAULT_PAYNET_QR_URL },
      },
    });
    expect(bot).toBeDefined();

    const uuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
    const cb = buildSubConfirmCallback(uuid, PLAN_TIERS.STANDALONE_LIFETIME);
    expect(Buffer.byteLength(cb, 'utf8')).toBeLessThanOrEqual(64);

    const parts = cb.split(':');
    const parsed = parseSubConfirmCallback(parts[2], parts[3]);
    expect(parsed.tenantId).toBe(uuid);
    expect(parsed.plan).toBe(PLAN_TIERS.STANDALONE_LIFETIME);

    expect(getPlanDetails(PLAN_TIERS.BASIC_20).priceUzs).toBe(255000);
    expect(getPlanDetails(PLAN_TIERS.PRO_30).priceUzs).toBe(385000);
    expect(getPlanDetails(PLAN_TIERS.STANDALONE_LIFETIME).priceUzs).toBe(4500000);
  });

  it('order:pay:<id> marks PENDING order PAID, sends merchant alert + customer receipt, and is idempotent when already PAID', async () => {
    const bot = createTenantBot({
      botToken: '123456:TEST_TOKEN',
      tenant: {
        id: 't-pay-1',
        name: 'Paynet Shop',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '8240936731',
        currency: 'UZS',
        themeConfig: { paynetEnabled: true, paynetQrUrl: DEFAULT_PAYNET_QR_URL },
      },
    });

    bot.botInfo = {
      id: 999,
      is_bot: true,
      first_name: 'PaynetShopBot',
      username: 'paynet_shop_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    bot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const orderId = 'order-paynet-cb-1';
    mockTenantDb.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PENDING,
      total_amount: 420000,
      customer_telegram_id: '555666',
      customer_name: 'Dilshod',
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    });
    mockTenantDb.order.update.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PAID,
      total_amount: 420000,
      customer_telegram_id: '555666',
      customer_name: 'Dilshod',
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    });

    const updatePayload = (data: string) => ({
      update_id: 1,
      callback_query: {
        id: 'cb-1',
        from: { id: 555666, is_bot: false, first_name: 'Dilshod', language_code: 'ru' },
        chat_instance: 'ci-1',
        data,
        message: {
          message_id: 10,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 555666, type: 'private' as const, first_name: 'Dilshod' },
          text: 'Checkout',
        },
      },
    });

    await bot.handleUpdate(updatePayload(`order:pay:${orderId}`));

    expect(mockTenantDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: expect.objectContaining({
          status: ORDER_STATUS.PAID,
          payment_id: expect.stringMatching(/^paynet_/),
        }),
      })
    );

    const sendMessages = apiCalls.filter((c) => c.method === 'sendMessage');
    expect(sendMessages).toHaveLength(2);
    expect(String(sendMessages[0].payload.chat_id)).toBe('8240936731');
    expect(String(sendMessages[1].payload.chat_id)).toBe('555666');
    expect(sendMessages[0].payload.text).toContain("420 000 so'm");

    // Second callback on already-PAID order should be idempotent (no update, no duplicate sendMessage)
    apiCalls.length = 0;
    mockTenantDb.order.update.mockReset();
    mockTenantDb.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PAID,
      total_amount: 420000,
      customer_telegram_id: '555666',
      items: [],
    });

    await bot.handleUpdate({ ...updatePayload(`order:pay:${orderId}`), update_id: 2 });

    expect(mockTenantDb.order.update).not.toHaveBeenCalled();
    expect(apiCalls.filter((c) => c.method === 'sendMessage')).toHaveLength(0);
    expect(apiCalls.some((c) => c.method === 'answerCallbackQuery')).toBe(true);
  });

  it('merchant:order:deliver and merchant:order:cancel enforce ownerTelegramId, update/cancel atomically, restore stock, and notify customer', async () => {
    const bot = createTenantBot({
      botToken: '123456:TEST_TOKEN',
      tenant: {
        id: 't-merch-1',
        name: 'Merchant Store',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '8240936731',
        currency: 'UZS',
        themeConfig: {},
      },
    });

    bot.botInfo = {
      id: 999,
      is_bot: true,
      first_name: 'MerchantBot',
      username: 'merchant_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    bot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const mkCallback = (updateId: number, userId: number, data: string) => ({
      update_id: updateId,
      callback_query: {
        id: `cb-${updateId}`,
        from: { id: userId, is_bot: false, first_name: 'User', language_code: 'ru' },
        chat_instance: 'ci-m',
        data,
        message: {
          message_id: 20,
          date: Math.floor(Date.now() / 1000),
          chat: { id: userId, type: 'private' as const, first_name: 'User' },
          text: 'Order alert',
        },
      },
    });

    const orderId = 'ord-merch-1';

    // 1. Non-owner rejected
    await bot.handleUpdate(mkCallback(1, 999999, `merchant:order:deliver:${orderId}`));
    expect(mockTenantDb.order.update).not.toHaveBeenCalled();
    expect(apiCalls.find((c) => c.method === 'answerCallbackQuery')?.payload.show_alert).toBe(true);

    // 2. Owner marks DELIVERED
    apiCalls.length = 0;
    mockTenantDb.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PAID,
      customer_telegram_id: '555666',
    });
    mockTenantDb.order.update.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.DELIVERED,
      customer_telegram_id: '555666',
    });

    await bot.handleUpdate(mkCallback(2, 8240936731, `merchant:order:deliver:${orderId}`));
    expect(mockTenantDb.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: { status: ORDER_STATUS.DELIVERED },
    });
    const deliveredMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(String(deliveredMsg?.payload.chat_id)).toBe('555666');
    expect(deliveredMsg?.payload.text).toContain('#ord-merc');

    // 3. Owner cancels order -> atomic updateMany + stock restore + customer notify
    apiCalls.length = 0;
    mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      tenant_id: 't-merch-1',
      status: ORDER_STATUS.PAID,
      customer_telegram_id: '555666',
      items: [{ productId: 'prod-1', quantity: 2 }],
    });
    mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.__tx.$executeRaw.mockResolvedValueOnce(1);

    await bot.handleUpdate(mkCallback(3, 8240936731, `merchant:order:cancel:${orderId}`));
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: orderId, tenant_id: 't-merch-1' }),
        data: { status: ORDER_STATUS.CANCELLED },
      })
    );
    expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    const cancelMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(String(cancelMsg?.payload.chat_id)).toBe('555666');
    expect(cancelMsg?.payload.text).toContain('#ord-merc');

    // 4. Repeat cancel (count === 0) does NOT double-restore stock or double-notify
    apiCalls.length = 0;
    mockPrisma.__tx.$executeRaw.mockReset();
    mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      tenant_id: 't-merch-1',
      status: ORDER_STATUS.CANCELLED,
      customer_telegram_id: '555666',
      items: [{ productId: 'prod-1', quantity: 2 }],
    });
    mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await bot.handleUpdate(mkCallback(4, 8240936731, `merchant:order:cancel:${orderId}`));
    expect(mockPrisma.__tx.$executeRaw).not.toHaveBeenCalled();
    expect(apiCalls.filter((c) => c.method === 'sendMessage')).toHaveLength(0);
  });

  it('Master Bot admin:sub:approve and admin:sub:suspend helpers respect 64-byte limit and enforce superadmin authorization', async () => {
    const tenantUuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
    const approveCb = buildAdminSubApproveCallback(tenantUuid, PLAN_TIERS.STANDALONE_LIFETIME);
    const suspendCb = buildAdminSubSuspendCallback(tenantUuid);

    expect(Buffer.byteLength(approveCb, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(suspendCb, 'utf8')).toBeLessThanOrEqual(64);

    const parsedApprove = parseAdminSubCallback(approveCb.split(':')[3], approveCb.split(':')[4]);
    expect(parsedApprove.tenantId).toBe(tenantUuid);
    expect(parsedApprove.plan).toBe(PLAN_TIERS.STANDALONE_LIFETIME);

    const masterBot = createMasterBot('123456:MASTER_TEST_TOKEN');
    masterBot.botInfo = {
      id: 888,
      is_bot: true,
      first_name: 'MasterBot',
      username: 'miraiedu_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    masterBot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const mkAdminCb = (updateId: number, userId: number, data: string) => ({
      update_id: updateId,
      callback_query: {
        id: `adm-cb-${updateId}`,
        from: { id: userId, is_bot: false, first_name: 'Admin', language_code: 'ru' },
        chat_instance: 'ci-adm',
        data,
        message: {
          message_id: 50,
          date: Math.floor(Date.now() / 1000),
          chat: { id: userId, type: 'private' as const, first_name: 'Admin' },
          text: 'Tariff payment alert',
        },
      },
    });

    // 1. Non-superadmin rejected
    await masterBot.handleUpdate(mkAdminCb(1, 123456, approveCb));
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    expect(apiCalls.find((c) => c.method === 'answerCallbackQuery')?.payload.show_alert).toBe(true);

    // 2. Superadmin approves subscription
    apiCalls.length = 0;
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
    });
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      plan: PLAN_TIERS.STANDALONE_LIFETIME,
      is_active: true,
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-1' });
    mockPrisma.subscription.update.mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE' });

    await masterBot.handleUpdate(mkAdminCb(2, 8240936731, approveCb));
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantUuid },
      data: { plan: PLAN_TIERS.STANDALONE_LIFETIME, is_active: true },
    });
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      })
    );
    expect(apiCalls.some((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === '777888')).toBe(true);

    // 3. Superadmin suspends store
    apiCalls.length = 0;
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
    });
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      is_active: false,
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-1' });
    mockPrisma.subscription.update.mockResolvedValueOnce({ id: 'sub-1', status: 'PAST_DUE' });

    await masterBot.handleUpdate(mkAdminCb(3, 8240936731, suspendCb));
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantUuid },
      data: { is_active: false },
    });
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'PAST_DUE' },
    });
    expect(apiCalls.some((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === '777888')).toBe(true);
  });
});
