import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromMasterBot = createRequire(path.resolve(process.cwd(), 'apps/master-bot/package.json'));
const bcrypt = requireFromMasterBot('bcryptjs');
import {
  PLATFORM_PAYNET_QR_URL,
  ORDER_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_METHODS,
  PLAN_TIERS,
  createBindToken,
} from '@telegram-commerce/config';

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
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const mockPrisma = {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    botConfig: {
      create: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    product: {
      count: vi.fn(),
      createMany: vi.fn(),
    },
    adminUser: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
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
    Object.values(mockTenantDb.product).forEach((fn) => fn.mockReset());
    Object.values(mockTenantDb.order).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.tenant).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.botConfig).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.product).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.adminUser).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.subscription).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.order).forEach((fn) => fn.mockReset());
    mockPrisma.$transaction.mockClear();
  }

  return { mockPrisma, mockTenantDb, resetDbMocks };
});

vi.mock('@telegram-commerce/database', () => ({
  prisma: mockPrisma,
  getTenantDb: vi.fn(() => mockTenantDb),
  OrderStatus: {
    PENDING: 'PENDING',
    PAYMENT_REVIEW: 'PAYMENT_REVIEW',
    PAID: 'PAID',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
  },
  SubscriptionStatus: {
    PENDING_PAYMENT: 'PENDING_PAYMENT',
    PENDING_REVIEW: 'PENDING_REVIEW',
    ACTIVE: 'ACTIVE',
    PAST_DUE: 'PAST_DUE',
    CANCELED: 'CANCELED',
    TRIALING: 'TRIALING',
  },
  Plan: {
    BASIC_20: 'BASIC_20',
    PRO_30: 'PRO_30',
    STANDALONE_LIFETIME: 'STANDALONE_LIFETIME',
  },
}));

import {
  handleStart,
  handleCatalog,
  handleAddToCart,
  handleCartCheckout,
  handleConfirmCartOrder,
  getCartItemKey,
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

const MERCHANT_PAYNET_QR_URL =
  'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz0118merchant77777777770202115204531153038605802UZ6304EFGH';

describe('Telegram Engine & Master Bot Phase 3 Flows', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetDbMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
            variants: ['M', 'L'],
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
    expect(replies[0].text).toContain('M, L');
  });

  it('handleCatalog shows "Status" in English locale, UZS prices, and 64-byte-safe variant buttons', async () => {
    const replies: Array<{ text: string; opts: any }> = [];
    const prodId = '12345678-1111-2222-3333-444455556666';
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
                id: prodId,
                title: 'Silk Scarf',
                category: 'Accessories',
                description: 'Pure silk',
                price: 150000,
                stock: 15,
                variants: ['S', 'M', 'L'],
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
    const kbRows = replies[0].opts.reply_markup.inline_keyboard;
    const variantRow = kbRows.find((r: any[]) => r[0]?.callback_data?.startsWith('cart:v:'));
    expect(variantRow).toHaveLength(3);
    expect(variantRow[0].callback_data).toBe('cart:v:12345678111122223333444455556666:0');
    expect(Buffer.byteLength(variantRow[0].callback_data, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('handleAddToCart separates variant lines while enforcing shared product stock and compact cart keys', async () => {
    const prodId = '12345678-1111-2222-3333-444455556666';
    const ctx: any = {
      locale: 'ru',
      tenant: { id: 't1', name: 'Store', plan: PLAN_TIERS.BASIC_20, currency: 'UZS', themeConfig: {} },
      session: { cart: [] },
      db: {
        product: {
          findFirst: vi.fn().mockResolvedValue({
            id: prodId,
            title: 'T-Shirt',
            price: 150000,
            stock: 2,
            is_active: true,
          }),
        },
      },
      callbackQuery: { id: 'cb-1' },
      answerCallbackQuery: vi.fn(),
    };

    await handleAddToCart(ctx, prodId, 'S');
    await handleAddToCart(ctx, prodId, 'M');
    // Third add across shared stock=2 must be blocked
    await handleAddToCart(ctx, prodId, 'L');

    expect(ctx.session.cart).toHaveLength(2);
    expect(ctx.session.cart[0].variant).toBe('S');
    expect(ctx.session.cart[1].variant).toBe('M');
    expect(ctx.answerCallbackQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ show_alert: true })
    );

    const keyS = getCartItemKey(ctx.session.cart[0]);
    const keyM = getCartItemKey(ctx.session.cart[1]);
    expect(keyS).not.toBe(keyM);
    expect(Buffer.byteLength(`cart:remove:${keyS}`, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('handleCartCheckout strictly blocks missing/disabled merchant Paynet QR (zero platform fallback) and enforces phone + delivery steps', async () => {
    const replies: Array<{ text: string; opts: any }> = [];

    // 1. Missing paynetQrUrl or paynetEnabled: false -> blocked without fallback to PLATFORM_PAYNET_QR_URL
    const unconfiguredCtx: any = {
      locale: 'ru',
      from: { id: 987654, first_name: 'Dilshod' },
      session: {
        cart: [{ productId: 'prod-1', title: 'Tashkent Hoodie', price: 420000, quantity: 1 }],
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: { paynetEnabled: false, paynetQrUrl: '', supportContact: '@moda_support' },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleCartCheckout(unconfiguredCtx);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(replies[0].text).toContain('отключена');
    expect(replies[0].text).toContain('@moda_support');
    expect(replies[0].text).not.toContain(PLATFORM_PAYNET_QR_URL);

    // 2. Enabled Paynet without phone -> Step 1 requests phone (requestContact keyboard)
    replies.length = 0;
    const step1Ctx: any = {
      locale: 'ru',
      from: { id: 987654, first_name: 'Dilshod' },
      session: {
        cart: [{ productId: 'prod-1', title: 'Tashkent Hoodie', price: 150000, quantity: 1 }],
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: { paynetEnabled: true, paynetQrUrl: MERCHANT_PAYNET_QR_URL },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleCartCheckout(step1Ctx);
    expect(step1Ctx.session.checkoutStep).toBe('awaiting_phone');
    expect(replies[0].opts.reply_markup.keyboard[0][0].request_contact).toBe(true);

    // 3. Phone provided, delivery method missing -> Step 2 asks COURIER / PICKUP
    replies.length = 0;
    step1Ctx.session.customerPhone = '+998901234567';
    await handleCartCheckout(step1Ctx);
    expect(step1Ctx.session.checkoutStep).toBe('awaiting_delivery_method');
    const deliveryCbData = replies[0].opts.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(deliveryCbData).toContain('checkout:delivery:COURIER');
    expect(deliveryCbData).toContain('checkout:delivery:PICKUP');

    // 4. COURIER chosen without address -> Step 3 asks shipping address
    replies.length = 0;
    step1Ctx.session.deliveryMethod = 'COURIER';
    await handleCartCheckout(step1Ctx);
    expect(step1Ctx.session.checkoutStep).toBe('awaiting_address');

    // 5. All collected -> Step 4 shows confirmation summary + legal disclosure + checkout:confirm
    replies.length = 0;
    step1Ctx.session.shippingAddress = 'Tashkent, Navoiy 10';
    step1Ctx.tenant.themeConfig.legalName = 'ИП Каримов';
    step1Ctx.tenant.themeConfig.supportContact = '@karimov_help';
    await handleCartCheckout(step1Ctx);
    expect(step1Ctx.session.checkoutStep).toBe('awaiting_confirm');
    expect(replies[0].text).toContain('ИП Каримов');
    expect(replies[0].text).toContain("25 000 so'm"); // delivery fee
    expect(replies[0].text).toContain("175 000 so'm"); // grand total
    const confirmCbs = replies[0].opts.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(confirmCbs).toContain('checkout:confirm');
  });

  it('handleConfirmCartOrder atomically decrements stock, persists deliveryFee/variant/access_token, and sends merchant Paynet URL', async () => {
    mockPrisma.__tx.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      title: 'Tashkent Hoodie',
      price: 150000,
      stock: 5,
      is_active: true,
    });
    mockPrisma.__tx.$executeRaw.mockResolvedValue(1);
    mockPrisma.__tx.order.create.mockResolvedValue({
      id: '12345678-aaaa-bbbb-cccc-1234567890ab',
      total_amount: 175000,
    });

    const replies: Array<{ text: string; opts: any }> = [];
    const ctx: any = {
      locale: 'ru',
      from: { id: 987654, first_name: 'Dilshod' },
      session: {
        cart: [{ productId: 'prod-1', title: 'Tashkent Hoodie', price: 150000, quantity: 1, variant: 'L' }],
        customerPhone: '+998901234567',
        deliveryMethod: 'COURIER',
        shippingAddress: 'Tashkent, Amir Temur 1',
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: {
          paynetEnabled: true,
          paynetQrUrl: MERCHANT_PAYNET_QR_URL,
          deliveryFeeUzs: 25000,
          freeDeliveryThresholdUzs: 300000,
        },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleConfirmCartOrder(ctx);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.__tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
          status: ORDER_STATUS.PENDING,
          delivery_method: 'COURIER',
          delivery_fee: 25000,
          total_amount: 175000,
          customer_phone: '+998901234567',
          shipping_address: 'Tashkent, Amir Temur 1',
          access_token: expect.stringMatching(/^[0-9a-f]{48}$/),
          items: [expect.objectContaining({ productId: 'prod-1', variant: 'L', quantity: 1 })],
        }),
      })
    );

    expect(ctx.session.cart).toEqual([]);
    expect(replies).toHaveLength(1);
    expect(replies[0].text).toContain("175 000 so'm");

    const inlineKeyboard = replies[0].opts.reply_markup.inline_keyboard;
    expect(inlineKeyboard).toHaveLength(2);
    expect(inlineKeyboard[0][0].url).toBe(MERCHANT_PAYNET_QR_URL);
    expect(inlineKeyboard[0][0].url).not.toBe(PLATFORM_PAYNET_QR_URL);
    expect(inlineKeyboard[1][0].callback_data).toBe('order:pay:12345678-aaaa-bbbb-cccc-1234567890ab');
  });

  it('handleConfirmCartOrder aborts checkout and preserves cart when stock is insufficient', async () => {
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
        customerPhone: '+998901234567',
        deliveryMethod: 'PICKUP',
        shippingAddress: 'Самовывоз',
      },
      tenant: {
        id: 'tenant-1',
        name: 'MODA',
        plan: PLAN_TIERS.BASIC_20,
        ownerTelegramId: '111222',
        currency: 'UZS',
        themeConfig: { paynetEnabled: true, paynetQrUrl: MERCHANT_PAYNET_QR_URL },
      },
      reply: vi.fn(async (text: string, opts: any) => {
        replies.push({ text, opts });
      }),
    };

    await handleConfirmCartOrder(ctx);

    expect(mockPrisma.__tx.order.create).not.toHaveBeenCalled();
    expect(ctx.session.cart).toHaveLength(1);
    expect(replies[0].text).toContain('Insufficient stock');
  });

  it('sendMerchantOrderAlert attaches 64B-safe confirm_pay/deliver/cancel buttons & formats UZS cleanly', async () => {
    const sentMessages: Array<{ chatId: string | number; text: string; extra: any }> = [];
    const fakeBot: any = {
      api: {
        sendMessage: vi.fn(async (chatId: string | number, text: string, extra?: any) => {
          sentMessages.push({ chatId, text, extra });
        }),
      },
    };

    const orderId = 'abcdef12-0000-0000-0000-000000000000';
    const compactId = orderId.replace(/-/g, '');
    await sendMerchantOrderAlert(fakeBot, '8240936731', {
      orderId,
      totalAmount: 420000,
      currency: 'UZS',
      customerTelegramId: '555666',
      customerName: 'Aziz',
      status: ORDER_STATUS.PAYMENT_REVIEW,
      items: [{ title: 'Hoodie', variant: 'XL', quantity: 1, price: 420000 }],
    });

    await sendCustomerOrderReceipt(fakeBot, '555666', {
      orderId,
      totalAmount: 420000,
      currency: 'UZS',
      items: [{ title: 'Hoodie', variant: 'XL', quantity: 1, price: 420000 }],
    });

    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0].text).toContain("420 000 so'm");
    expect(sentMessages[0].text).toContain('Hoodie</b> (XL)');
    const merchantKb = sentMessages[0].extra?.reply_markup?.inline_keyboard;
    expect(merchantKb).toHaveLength(3);
    expect(merchantKb[0][0].callback_data).toBe(`merchant:order:confirm_pay:${compactId}`);
    expect(merchantKb[1][0].callback_data).toBe(`merchant:order:deliver:${compactId}`);
    expect(merchantKb[2][0].callback_data).toBe(`merchant:order:cancel:${compactId}`);
    for (const row of merchantKb) {
      expect(Buffer.byteLength(row[0].callback_data, 'utf8')).toBeLessThanOrEqual(64);
    }
    expect(sentMessages[1].text).toContain("420 000 so'm");
  });

  it('order:pay:<id> transitions PENDING -> PAYMENT_REVIEW ONLY (never auto-PAID), notifies merchant, and is idempotent', async () => {
    const bot = createTenantBot({
      botToken: '123456:TEST_TOKEN',
      tenant: {
        id: 't-pay-1',
        name: 'Paynet Shop',
        plan: PLAN_TIERS.PRO_30,
        ownerTelegramId: '8240936731',
        currency: 'UZS',
        themeConfig: {
          paynetEnabled: true,
          paynetQrUrl: MERCHANT_PAYNET_QR_URL,
          supportContact: '@shop_support',
        },
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
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    bot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const orderId = 'order-paynet-cb-1';
    const pendingOrder = {
      id: orderId,
      tenant_id: 't-pay-1',
      status: ORDER_STATUS.PENDING,
      total_amount: 420000,
      customer_telegram_id: '555666',
      customer_name: 'Dilshod',
      status_history: [],
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    };
    const reviewOrder = { ...pendingOrder, status: ORDER_STATUS.PAYMENT_REVIEW };

    mockTenantDb.order.findFirst.mockResolvedValueOnce(pendingOrder);
    mockPrisma.__tx.order.findFirst
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(reviewOrder);
    mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });

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

    // Must transition ONLY to PAYMENT_REVIEW inside transaction, NEVER PAID!
    expect(mockPrisma.__tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: orderId, status: ORDER_STATUS.PENDING }),
        data: expect.objectContaining({
          status: ORDER_STATUS.PAYMENT_REVIEW,
          status_history: expect.arrayContaining([
            expect.objectContaining({ status: ORDER_STATUS.PAYMENT_REVIEW, by: 'customer' }),
          ]),
        }),
      })
    );
    expect(mockTenantDb.order.update).not.toHaveBeenCalled();

    // Sends merchant alert to owner, edits customer message with review notice + supportContact (no premature PAID receipt!)
    const sendMessages = apiCalls.filter((c) => c.method === 'sendMessage');
    expect(sendMessages).toHaveLength(1);
    expect(String(sendMessages[0].payload.chat_id)).toBe('8240936731');
    expect(sendMessages[0].payload.text).toContain("420 000 so'm");

    const editCalls = apiCalls.filter((c) => c.method === 'editMessageText');
    expect(editCalls).toHaveLength(1);
    expect(editCalls[0].payload.text).toContain('на проверку оператору');
    expect(editCalls[0].payload.text).toContain('@shop_support');

    // Second click when already PAYMENT_REVIEW -> idempotent (no update, no duplicate alert)
    apiCalls.length = 0;
    mockPrisma.__tx.order.updateMany.mockReset();
    mockTenantDb.order.findFirst.mockResolvedValueOnce(reviewOrder);

    await bot.handleUpdate({ ...updatePayload(`order:pay:${orderId}`), update_id: 2 });

    expect(mockPrisma.__tx.order.updateMany).not.toHaveBeenCalled();
    expect(apiCalls.filter((c) => c.method === 'sendMessage')).toHaveLength(0);
    expect(apiCalls.some((c) => c.method === 'answerCallbackQuery')).toBe(true);
  });

  it('merchant:order:confirm_pay, deliver, and cancel enforce ownerTelegramId, order state sequence, stock restore, and notifications', async () => {
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
      can_connect_to_business: false,
      has_main_web_app: false,
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

    const orderId = 'abcdef12-3456-7890-abcd-ef1234567890';
    const compactId = orderId.replace(/-/g, '');

    // 1. Non-owner rejected on confirm_pay and deliver
    await bot.handleUpdate(mkCallback(1, 999999, `merchant:order:confirm_pay:${compactId}`));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(apiCalls.find((c) => c.method === 'answerCallbackQuery')?.payload.show_alert).toBe(true);

    // 2. Owner tries deliver while order is still PAYMENT_REVIEW -> blocked with alert!
    apiCalls.length = 0;
    mockTenantDb.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PAYMENT_REVIEW,
      customer_telegram_id: '555666',
    });
    await bot.handleUpdate(mkCallback(2, 8240936731, `merchant:order:deliver:${compactId}`));
    expect(mockTenantDb.order.update).not.toHaveBeenCalled();
    expect(apiCalls.find((c) => c.method === 'answerCallbackQuery')?.payload.show_alert).toBe(true);

    // 3. Owner clicks merchant:order:confirm_pay:<compactId> -> PAYMENT_REVIEW -> PAID + sends customer receipt
    apiCalls.length = 0;
    const reviewOrder = {
      id: orderId,
      tenant_id: 't-merch-1',
      status: ORDER_STATUS.PAYMENT_REVIEW,
      total_amount: 420000,
      customer_telegram_id: '555666',
      status_history: [],
      items: [{ title: 'Hoodie', quantity: 1, price: 420000 }],
    };
    mockPrisma.__tx.order.findFirst
      .mockResolvedValueOnce(reviewOrder)
      .mockResolvedValueOnce({ ...reviewOrder, status: ORDER_STATUS.PAID });
    mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });

    await bot.handleUpdate(mkCallback(3, 8240936731, `merchant:order:confirm_pay:${compactId}`));
    expect(mockPrisma.__tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ORDER_STATUS.PAID,
          verified_by: 'telegram:8240936731',
        }),
      })
    );
    const receiptMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(String(receiptMsg?.payload.chat_id)).toBe('555666');
    expect(receiptMsg?.payload.text).toContain('Оплата подтверждена');

    // 4. Owner marks DELIVERED after PAID
    apiCalls.length = 0;
    mockTenantDb.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.PAID,
      customer_telegram_id: '555666',
      status_history: [],
    });
    mockTenantDb.order.update.mockResolvedValueOnce({
      id: orderId,
      status: ORDER_STATUS.DELIVERED,
      customer_telegram_id: '555666',
    });

    await bot.handleUpdate(mkCallback(4, 8240936731, `merchant:order:deliver:${compactId}`));
    expect(mockTenantDb.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: expect.objectContaining({
          status: ORDER_STATUS.DELIVERED,
          status_history: expect.arrayContaining([
            expect.objectContaining({ status: ORDER_STATUS.DELIVERED, by: 'telegram:8240936731' }),
          ]),
        }),
      })
    );
    const deliveredMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(String(deliveredMsg?.payload.chat_id)).toBe('555666');
    expect(deliveredMsg?.payload.text).toContain('#abcdef12');

    // 5. Owner cancels order -> atomic updateMany + stock restore + customer notify
    apiCalls.length = 0;
    mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      tenant_id: 't-merch-1',
      status: ORDER_STATUS.PAID,
      customer_telegram_id: '555666',
      items: [{ productId: 'prod-1', quantity: 2 }],
      status_history: [],
    });
    mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.__tx.$executeRaw.mockResolvedValueOnce(1);

    await bot.handleUpdate(mkCallback(5, 8240936731, `merchant:order:cancel:${compactId}`));
    expect(mockPrisma.__tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: orderId, tenant_id: 't-merch-1' }),
        data: expect.objectContaining({ status: ORDER_STATUS.CANCELLED }),
      })
    );
    expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    const cancelMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(String(cancelMsg?.payload.chat_id)).toBe('555666');

    // 6. Repeat cancel (already CANCELLED) does NOT double-restore stock or double-notify
    apiCalls.length = 0;
    mockPrisma.__tx.$executeRaw.mockReset();
    mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
      id: orderId,
      tenant_id: 't-merch-1',
      status: ORDER_STATUS.CANCELLED,
      customer_telegram_id: '555666',
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    await bot.handleUpdate(mkCallback(6, 8240936731, `merchant:order:cancel:${compactId}`));
    expect(mockPrisma.__tx.$executeRaw).not.toHaveBeenCalled();
    expect(apiCalls.filter((c) => c.method === 'sendMessage')).toHaveLength(0);
  });

  it('Master Bot pricing removes STANDALONE self-serve, creates PENDING_PAYMENT INV-... invoice, and confirm enters PENDING_REVIEW -> additive +30d approve', async () => {
    const subUuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
    const tenantUuid = 'b1b2c3d4-e5f6-4789-abcd-ef0123456789';
    const cb = buildSubConfirmCallback(subUuid);
    expect(Buffer.byteLength(cb, 'utf8')).toBeLessThanOrEqual(64);

    const approveCb = buildAdminSubApproveCallback(subUuid, PLAN_TIERS.PRO_30);
    const suspendCb = buildAdminSubSuspendCallback(subUuid);
    expect(Buffer.byteLength(approveCb, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(suspendCb, 'utf8')).toBeLessThanOrEqual(64);
    expect(parseAdminSubCallback(approveCb.split(':')[3], approveCb.split(':')[4]).id).toBe(subUuid);
    expect(parseSubConfirmCallback(cb.split(':')[2]).id).toBe(subUuid);
    expect(getPlanDetails(PLAN_TIERS.BASIC_20).priceUzs).toBe(255000);
    expect(getPlanDetails(PLAN_TIERS.PRO_30).priceUzs).toBe(385000);

    const masterBot = createMasterBot('123456:MASTER_TEST_TOKEN');
    masterBot.botInfo = {
      id: 888,
      is_bot: true,
      first_name: 'MasterBot',
      username: 'miraiedu_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    masterBot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const mkMsg = (updateId: number, userId: number, text: string) => ({
      update_id: updateId,
      message: {
        message_id: updateId + 100,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: 'private' as const, first_name: 'User' },
        from: { id: userId, is_bot: false, first_name: 'User', language_code: 'ru' },
        text,
        ...(text.startsWith('/')
          ? { entities: [{ offset: 0, length: text.split(' ')[0].length, type: 'bot_command' as const }] }
          : {}),
      },
    });

    const mkCb = (updateId: number, userId: number, data: string) => ({
      update_id: updateId,
      callback_query: {
        id: `cb-${updateId}`,
        from: { id: userId, is_bot: false, first_name: 'User', language_code: 'ru' },
        chat_instance: 'ci-adm',
        data,
        message: {
          message_id: 50,
          date: Math.floor(Date.now() / 1000),
          chat: { id: userId, type: 'private' as const, first_name: 'User' },
          text: 'Tariff',
        },
      },
    });

    // 1. /pricing hides STANDALONE_LIFETIME self-serve purchase button
    await masterBot.handleUpdate(mkMsg(1, 777888, '/pricing'));
    const pricingSend = apiCalls.find((c) => c.method === 'sendMessage');
    const pricingCbs = pricingSend!.payload.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(pricingCbs).toContain('pricing:plan:BASIC_20');
    expect(pricingCbs).toContain('pricing:plan:PRO_30');
    expect(pricingCbs).toContain('pricing:standalone_info');
    expect(pricingCbs).not.toContain('pricing:plan:STANDALONE_LIFETIME');

    // 2. Selecting STANDALONE_LIFETIME directly is blocked (no Paynet QR, no invoice)
    apiCalls.length = 0;
    await masterBot.handleUpdate(mkCb(2, 777888, 'pricing:plan:STANDALONE_LIFETIME'));
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();

    // 3. Selecting PRO_30 creates PENDING_PAYMENT INV-... invoice and sends Paynet QR
    apiCalls.length = 0;
    mockPrisma.tenant.findFirst.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      plan: PLAN_TIERS.PRO_30,
    });
    mockPrisma.subscription.findFirst.mockResolvedValueOnce(null);
    mockPrisma.subscription.create.mockResolvedValueOnce({
      id: subUuid,
      tenant_id: tenantUuid,
      plan: PLAN_TIERS.PRO_30,
      invoice_number: 'INV-20261118-5555',
      amount_uzs: 385000,
      status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
    });
    await masterBot.handleUpdate(mkCb(3, 777888, 'pricing:plan:PRO_30'));
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
          amount_uzs: 385000,
          invoice_number: expect.stringMatching(/^INV-/),
        }),
      })
    );

    // 4. Clicking sub:confirm:<subId> transitions ONLY to PENDING_REVIEW (never ACTIVE) and alerts superadmin
    apiCalls.length = 0;
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: subUuid,
      tenant_id: tenantUuid,
      plan: PLAN_TIERS.PRO_30,
      invoice_number: 'INV-20261118-5555',
      amount_uzs: 385000,
      status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      tenant: {
        id: tenantUuid,
        name: 'Silk Store',
        owner_telegram_id: '777888',
        subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      },
    });
    mockPrisma.subscription.update.mockResolvedValueOnce({
      id: subUuid,
      tenant_id: tenantUuid,
      plan: PLAN_TIERS.PRO_30,
      invoice_number: 'INV-20261118-5555',
      amount_uzs: 385000,
      status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
    });
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      subscription_status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
    });

    await masterBot.handleUpdate(mkCb(4, 777888, cb));
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SUBSCRIPTION_STATUS.PENDING_REVIEW }),
      })
    );
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscription_status: SUBSCRIPTION_STATUS.PENDING_REVIEW }),
      })
    );
    const superAdminAlert = apiCalls.find(
      (c) => c.method === 'sendMessage' && String(c.payload.chat_id) === '8240936731'
    );
    expect(superAdminAlert).toBeTruthy();
    expect(superAdminAlert!.payload.text).toContain('INV-20261118-5555');
    expect(superAdminAlert!.payload.text).toContain('PENDING_REVIEW');

    // 5. Non-superadmin rejected on admin:sub:approve
    apiCalls.length = 0;
    mockPrisma.tenant.update.mockReset();
    await masterBot.handleUpdate(mkCb(5, 123456, approveCb));
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    expect(apiCalls.find((c) => c.method === 'answerCallbackQuery')?.payload.show_alert).toBe(true);

    // 6. Superadmin approves subscription -> additive +30d from existing period end
    apiCalls.length = 0;
    const futureEnd = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: subUuid,
      tenant_id: tenantUuid,
      plan: PLAN_TIERS.PRO_30,
      invoice_number: 'INV-20261118-5555',
      status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
      reviewed_at: null,
      tenant: {
        id: tenantUuid,
        name: 'Silk Store',
        owner_telegram_id: '777888',
        plan: PLAN_TIERS.PRO_30,
      },
    });
    mockPrisma.subscription.findMany.mockResolvedValueOnce([
      { id: 'prev-active-sub', current_period_end: futureEnd },
    ]);
    mockPrisma.subscription.update.mockImplementationOnce(async (args: any) => ({
      id: subUuid,
      invoice_number: 'INV-20261118-5555',
      ...args.data,
    }));
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      plan: PLAN_TIERS.PRO_30,
      subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
      is_active: true,
    });

    await masterBot.handleUpdate(mkCb(6, 8240936731, approveCb));
    const subUpdData = mockPrisma.subscription.update.mock.calls[1][0].data;
    expect(subUpdData.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(subUpdData.reviewed_by).toBe('tg:8240936731');
    const diffDays = (subUpdData.current_period_end.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(41);
    expect(diffDays).toBeLessThan(43);

    // 7. Superadmin suspends store -> PAST_DUE & is_active: false
    apiCalls.length = 0;
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: subUuid,
      tenant_id: tenantUuid,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      tenant: { id: tenantUuid, name: 'Silk Store', owner_telegram_id: '777888' },
    });
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: tenantUuid,
      name: 'Silk Store',
      owner_telegram_id: '777888',
      is_active: false,
    });
    mockPrisma.subscription.update.mockResolvedValueOnce({ id: subUuid, status: SUBSCRIPTION_STATUS.PAST_DUE });

    await masterBot.handleUpdate(mkCb(7, 8240936731, suspendCb));
    expect(mockPrisma.tenant.update).toHaveBeenLastCalledWith({
      where: { id: tenantUuid },
      data: { is_active: false, subscription_status: SUBSCRIPTION_STATUS.PAST_DUE },
    });
    expect(mockPrisma.subscription.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: subUuid },
        data: expect.objectContaining({ status: SUBSCRIPTION_STATUS.PAST_DUE }),
      })
    );
  });

  it('Master Bot /start bind_ links empty owner_telegram_id, blocks hijacking, and cleans up tenant on setWebhook failure', async () => {
    const masterBot = createMasterBot('123456:MASTER_TEST_TOKEN');
    masterBot.botInfo = {
      id: 888,
      is_bot: true,
      first_name: 'MasterBot',
      username: 'miraiedu_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    const installMockFetch = (overrideHandler?: (url: string, init?: any) => Promise<any> | any) => {
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
        const urlStr = String(url);
        if (overrideHandler) {
          const overridden = await overrideHandler(urlStr, init);
          if (overridden) return overridden;
        }
        const methodMatch = /\/bot[^/]+\/([^/?]+)/.exec(urlStr);
        if (methodMatch) {
          const method = methodMatch[1];
          let payload: any = {};
          try {
            payload = init?.body ? JSON.parse(String(init.body)) : {};
          } catch {
            payload = {};
          }
          apiCalls.push({ method, payload });
        }
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 1, date: 1700000000, text: 'ok' } }),
        } as any;
      });
    };
    installMockFetch();
    (masterBot as any).clientConfig = {
      ...((masterBot as any).clientConfig || {}),
      fetch: (...args: any[]) => (global.fetch as any)(...args),
    };
    masterBot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const mkMsg = (updateId: number, userId: number, text: string) => ({
      update_id: updateId,
      message: {
        message_id: updateId + 200,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: 'private' as const, first_name: 'Merchant' },
        from: { id: userId, is_bot: false, first_name: 'Merchant', language_code: 'ru' },
        text,
        ...(text.startsWith('/')
          ? { entities: [{ offset: 0, length: text.split(' ')[0].length, type: 'bot_command' as const }] }
          : {}),
      },
    });

    const bindTenantId = 'cccccccc-1111-2222-3333-444444444444';
    const validBind = createBindToken(bindTenantId, process.env.JWT_SECRET!);

    // 1. Hijack attempt when tenant already belongs to another Telegram user -> blocked!
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: bindTenantId,
      name: 'Owned Store',
      owner_telegram_id: '999000',
      plan: PLAN_TIERS.PRO_30,
      subscriptions: [],
    });
    await masterBot.handleUpdate(mkMsg(1, 777111, `/start ${validBind}`));
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    expect(apiCalls.some((c) => c.method === 'sendMessage' && c.payload.text.includes('другому Telegram'))).toBe(
      true
    );

    // 2. Valid bind when owner_telegram_id is empty -> links owner_telegram_id and enters bot token prompt
    apiCalls.length = 0;
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: bindTenantId,
      name: 'Web Created Store',
      owner_telegram_id: '',
      plan: PLAN_TIERS.PRO_30,
      subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      subscriptions: [{ id: 'sub-w1', status: SUBSCRIPTION_STATUS.PENDING_PAYMENT }],
    });
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: bindTenantId,
      owner_telegram_id: '777111',
    });
    await masterBot.handleUpdate(mkMsg(2, 777111, `/start ${validBind}`));
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: bindTenantId },
      data: { owner_telegram_id: '777111' },
    });
    expect(
      apiCalls.some((c) => c.method === 'sendMessage' && c.payload.text.includes('привязан к вашему Telegram'))
    ).toBe(true);

    // Exit onboarding conversation cleanly via /cancel
    await masterBot.handleUpdate(mkMsg(3, 777111, '/cancel'));

    // 3. Onboarding /newstore when setWebhook fails -> cleans up draft tenant & does NOT create BotConfig
    apiCalls.length = 0;
    const newDraftId = 'dddddddd-1111-2222-3333-444444444444';
    mockPrisma.adminUser.findFirst.mockResolvedValueOnce(null);
    mockPrisma.tenant.create.mockResolvedValueOnce({
      id: newDraftId,
      name: 'Broken Webhook Shop',
      subscriptions: [{ id: 'sub-bw-1', invoice_number: 'INV-20261118-0001' }],
    });
    mockPrisma.tenant.delete.mockResolvedValueOnce({ id: newDraftId });

    installMockFetch((urlStr) => {
      if (urlStr.includes('/getMe')) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { username: 'broken_hook_bot' } }),
        };
      }
      if (urlStr.includes('/setWebhook')) {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ ok: false, description: 'Bad Request: bad webhook: Failed to resolve host' }),
        };
      }
      return null;
    });

    await masterBot.handleUpdate(mkMsg(4, 555000, '/newstore'));
    await masterBot.handleUpdate(mkMsg(5, 555000, 'Broken Webhook Shop'));
    await masterBot.handleUpdate(mkMsg(6, 555000, '2'));
    await masterBot.handleUpdate(mkMsg(7, 555000, 'broken@shop.uz'));
    await masterBot.handleUpdate(mkMsg(8, 555000, '123456:BROKEN_HOOK_TOKEN'));

    expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({ where: { id: newDraftId } });
    expect(mockPrisma.botConfig.create).not.toHaveBeenCalled();
    expect(
      apiCalls.some(
        (c) =>
          c.method === 'sendMessage' &&
          c.payload.text.includes('Не удалось настроить webhook') &&
          c.payload.text.includes('Failed to resolve host')
      )
    ).toBe(true);
  });

  it('Master Bot /login, /resetpassword, and email linking handle multi-store selection without blind findFirst', async () => {
    const masterBot = createMasterBot('123456:MASTER_TEST_TOKEN');
    masterBot.botInfo = {
      id: 888,
      is_bot: true,
      first_name: 'MasterBot',
      username: 'miraiedu_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const apiCalls: Array<{ method: string; payload: any }> = [];
    masterBot.api.config.use(async (_prev, method, payload) => {
      apiCalls.push({ method, payload });
      return { ok: true, result: true } as any;
    });

    const mkMsg = (updateId: number, userId: number, text: string) => ({
      update_id: updateId,
      message: {
        message_id: updateId + 300,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: 'private' as const, first_name: 'MultiOwner' },
        from: { id: userId, is_bot: false, first_name: 'MultiOwner', language_code: 'ru' },
        text,
        ...(text.startsWith('/')
          ? { entities: [{ offset: 0, length: text.split(' ')[0].length, type: 'bot_command' as const }] }
          : {}),
      },
    });

    const storeAId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const storeBId = 'bbbbbbbb-0000-0000-0000-000000000002';
    const stores = [
      {
        id: storeAId,
        name: 'Store Alpha',
        plan: PLAN_TIERS.PRO_30,
        owner_telegram_id: '333444',
        subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
        botConfig: { bot_username: 'alpha_bot', is_active: true },
        adminUsers: [{ id: 'a1', email: 'alpha@uz.uz', role: 'OWNER' }],
        subscriptions: [{ status: SUBSCRIPTION_STATUS.ACTIVE }],
      },
      {
        id: storeBId,
        name: 'Store Beta',
        plan: PLAN_TIERS.BASIC_20,
        owner_telegram_id: '333444',
        subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
        botConfig: { bot_username: null, is_active: false },
        adminUsers: [{ id: 'a2', email: 'beta@uz.uz', role: 'OWNER' }],
        subscriptions: [{ status: SUBSCRIPTION_STATUS.PENDING_PAYMENT }],
      },
    ];

    // 1. /login lists BOTH stores
    mockPrisma.tenant.findMany.mockResolvedValueOnce(stores);
    await masterBot.handleUpdate(mkMsg(1, 333444, '/login'));
    const loginMsg = apiCalls.find((c) => c.method === 'sendMessage');
    expect(loginMsg!.payload.text).toContain('Store Alpha');
    expect(loginMsg!.payload.text).toContain('Store Beta');
    const selectCbs = loginMsg!.payload.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(selectCbs).toContain(`store:select:${storeAId.replace(/-/g, '')}`);
    expect(selectCbs).toContain(`store:select:${storeBId.replace(/-/g, '')}`);

    // 2. /resetpassword with 2 stores shows selector instead of updating blindly!
    apiCalls.length = 0;
    mockPrisma.tenant.findMany.mockResolvedValueOnce(stores);
    await masterBot.handleUpdate(mkMsg(2, 333444, '/resetpassword'));
    expect(mockPrisma.adminUser.update).not.toHaveBeenCalled();
    const resetMsg = apiCalls.find((c) => c.method === 'sendMessage');
    const resetCbs = resetMsg!.payload.reply_markup.inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(resetCbs).toContain(`store:resetpw:${storeAId.replace(/-/g, '')}`);
    expect(resetCbs).toContain(`store:resetpw:${storeBId.replace(/-/g, '')}`);

    // 3. Email + password linking flow binds unowned web store
    apiCalls.length = 0;
    const webStoreId = 'cccccccc-0000-0000-0000-000000000003';
    const pwHash = await bcrypt.hash('mySecret99', 10);
    await masterBot.handleUpdate({
      update_id: 3,
      callback_query: {
        id: 'cb-link',
        from: { id: 888999, is_bot: false, first_name: 'WebOwner', language_code: 'ru' },
        chat_instance: 'ci-link',
        data: 'auth:link_email',
        message: {
          message_id: 60,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 888999, type: 'private' as const, first_name: 'WebOwner' },
          text: 'Login',
        },
      },
    });
    await masterBot.handleUpdate(mkMsg(4, 888999, 'web@shop.uz'));
    mockPrisma.adminUser.findMany.mockResolvedValueOnce([
      {
        id: 'adm-web-1',
        email: 'web@shop.uz',
        password_hash: pwHash,
        tenant: {
          id: webStoreId,
          name: 'Web Shop',
          owner_telegram_id: '',
          plan: PLAN_TIERS.PRO_30,
          subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
          botConfig: null,
          subscriptions: [],
        },
      },
    ]);
    mockPrisma.tenant.update.mockResolvedValueOnce({
      id: webStoreId,
      name: 'Web Shop',
      owner_telegram_id: '888999',
      plan: PLAN_TIERS.PRO_30,
      subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      botConfig: null,
      subscriptions: [],
    });
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: webStoreId,
      name: 'Web Shop',
      owner_telegram_id: '888999',
      plan: PLAN_TIERS.PRO_30,
      subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      botConfig: null,
      adminUsers: [{ id: 'adm-web-1', email: 'web@shop.uz', role: 'OWNER' }],
      subscriptions: [],
    });

    await masterBot.handleUpdate(mkMsg(5, 888999, 'mySecret99'));
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: webStoreId },
        data: { owner_telegram_id: '888999' },
      })
    );
  });
});
