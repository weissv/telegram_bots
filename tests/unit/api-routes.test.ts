import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  DEFAULT_PAYNET_QR_URL,
  PLATFORM_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  PLAN_PRICING,
  PLAN_TIERS,
  ORDER_STATUS,
  PAYMENT_METHODS,
  encryptBotToken,
} from '@telegram-commerce/config';

const { mockPrisma, mockTenantDb, resetMocks } = vi.hoisted(() => {
  // Vitest/Vite sets MODE='test', whereas AppEnv expects 'saas' | 'standalone'
  process.env.MODE = 'saas';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/telegram_commerce';
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345678';
  process.env.MASTER_BOT_TOKEN = process.env.MASTER_BOT_TOKEN || '123456789:TEST_MASTER_BOT_TOKEN';

  const mockTenantDb = {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    botConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

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

  const mockPrisma = {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    botConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    adminUser: {
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)),
    __tx: mockTx,
  };

  function resetMocks() {
    for (const group of [mockTenantDb.product, mockTenantDb.order, mockTenantDb.botConfig]) {
      Object.values(group).forEach((fn) => fn.mockReset());
    }
    Object.values(mockTx.product).forEach((fn) => fn.mockReset());
    Object.values(mockTx.order).forEach((fn) => fn.mockReset());
    mockTx.$executeRaw.mockReset();

    Object.values(mockPrisma.tenant).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.botConfig).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.subscription).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.adminUser).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.order).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.product).forEach((fn) => fn.mockReset());
    mockPrisma.$transaction.mockClear();
  }

  return { mockPrisma, mockTenantDb, resetMocks };
});

vi.mock('@telegram-commerce/database', () => ({
  prisma: mockPrisma,
  getTenantDb: vi.fn(() => mockTenantDb),
}));

import { createServer } from '../../apps/api/src/server.js';
import { getOrInitBot } from '../../apps/api/src/services/botManager.js';
import { sweepExpiredPendingOrders } from '../../apps/api/src/services/reservationWorker.js';

const EXACT_PAYNET_QR_URL =
  "https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz01186r2s8nPSzGNGRQjdxV0202115204531153038605802UZ5910AO'PAYNET'6008Tashkent610610002164280002uz0106PAYNET0208Toshkent80520012qr-online.uz03097120207070419marketing@paynet.uz63043D65";

describe('Fastify API Routes (createServer + app.inject)', () => {
  let app: FastifyInstance;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    resetMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    } as any);
    app = await createServer();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    global.fetch = originalFetch;
  });

  describe('Core System & SEO Routes', () => {
    it('GET /health returns ok status and mode', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('mode');
      expect(body).toHaveProperty('timestamp');
    });

    it('GET /robots.txt returns plain text allow-all policy', async () => {
      const res = await app.inject({ method: 'GET', url: '/robots.txt' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body).toBe('User-agent: *\nAllow: /\n');
    });
  });

  describe('Billing Routes (/api/v1/billing/*)', () => {
    it('POST /api/v1/billing/checkout returns Paynet provider and exact PLATFORM_PAYNET_QR_URL for all plans', async () => {
      const plans = [
        { plan: undefined, expectedPlan: PLAN_TIERS.PRO_30, usd: 30, uzs: 385000 },
        { plan: PLAN_TIERS.BASIC_20, expectedPlan: PLAN_TIERS.BASIC_20, usd: 20, uzs: 255000 },
        { plan: PLAN_TIERS.PRO_30, expectedPlan: PLAN_TIERS.PRO_30, usd: 30, uzs: 385000 },
        { plan: PLAN_TIERS.STANDALONE_LIFETIME, expectedPlan: PLAN_TIERS.STANDALONE_LIFETIME, usd: 350, uzs: 4500000 },
      ];

      for (const tc of plans) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/billing/checkout',
          payload: tc.plan ? { plan: tc.plan } : {},
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.provider).toBe('paynet');
        expect(body.paymentUrl).toBe(PLATFORM_PAYNET_QR_URL);
        expect(body.paynetQrUrl).toBe(EXACT_PAYNET_QR_URL);
        expect(body.plan).toBe(tc.expectedPlan);
        expect(body.priceUsd).toBe(tc.usd);
        expect(body.priceUzs).toBe(tc.uzs);
        expect(body.priceUzs).toBe(PLAN_PRICING[tc.expectedPlan].priceUzs);
      }
    });

    it('POST /api/v1/billing/checkout rejects invalid plan with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: { plan: 'UNKNOWN_PLAN' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Invalid plan selected');
    });

    it('POST /api/v1/billing/confirm-paynet activates tenant subscription and alerts platform owner', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Mirai Demo Store',
        owner_telegram_id: '987654321',
        plan: 'BASIC_20',
        is_active: true,
      });
      mockPrisma.tenant.update.mockResolvedValue({ id: tenantId, plan: 'STANDALONE_LIFETIME' });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/confirm-paynet',
        payload: {
          tenantId,
          plan: 'STANDALONE_LIFETIME',
          customerEmail: 'merchant@uzshop.uz',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        success: true,
        plan: 'STANDALONE_LIFETIME',
        subscriptionStatus: 'ACTIVE',
      });

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: { plan: 'STANDALONE_LIFETIME', is_active: true },
      });
      expect(mockPrisma.subscription.create).toHaveBeenCalledTimes(1);
      const subCreateArg = mockPrisma.subscription.create.mock.calls[0][0];
      expect(subCreateArg.data.status).toBe('ACTIVE');
      // Standalone lifetime period should be ~100 years in the future
      expect(subCreateArg.data.current_period_end.getFullYear()).toBeGreaterThanOrEqual(
        new Date().getFullYear() + 99
      );

      // Platform owner notification via Telegram API with 1-click inline approval buttons (<= 64 bytes)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({ method: 'POST' })
      );
      const sendCall = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/sendMessage'));
      const sentBody = JSON.parse(sendCall[1].body);
      const inlineKeyboard = sentBody.reply_markup?.inline_keyboard;
      expect(inlineKeyboard).toHaveLength(2);
      const approveCb = inlineKeyboard[0][0].callback_data;
      const suspendCb = inlineKeyboard[1][0].callback_data;
      expect(approveCb).toBe('admin:sub:approve:11111111111111111111111111111111:STANDALONE');
      expect(suspendCb).toBe('admin:sub:suspend:11111111111111111111111111111111');
      expect(Buffer.byteLength(approveCb, 'utf8')).toBeLessThanOrEqual(64);
      expect(Buffer.byteLength(suspendCb, 'utf8')).toBeLessThanOrEqual(64);
    });

    it('POST /api/v1/billing/confirm-paynet rejects missing/invalid plan with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/confirm-paynet',
        payload: { plan: 'INVALID' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Shop Routes (/api/v1/shop/*)', () => {
    const tenantId = '22222222-2222-2222-2222-222222222222';

    it('GET /api/v1/shop/bootstrap fetches up to 200 products and falls back to UZS currency', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Tashkent Fashion',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          currency: '',
          theme_config: { storeName: 'Tashkent Fashion' },
        },
      });
      mockTenantDb.product.findMany
        .mockResolvedValueOnce([{ category: 'Apparel' }])
        .mockResolvedValueOnce([{ id: 'p1', title: 'Hoodie', price: 420000, stock: 10 }]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/bootstrap?tenant_id=${tenantId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tenant.currency).toBe('UZS');
      expect(body.theme.currency).toBe('UZS');
      expect(body.theme.paynetQrUrl).toBe(DEFAULT_PAYNET_QR_URL);
      expect(body.featuredProducts).toHaveLength(1);

      expect(mockTenantDb.product.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ take: 200 })
      );
    });

    it('POST /api/v1/shop/checkout defaults to PAYNET_XOLIS and returns paynet provider & URL', async () => {
      const tenantCheckoutId = '33333333-3333-3333-3333-333333333333';
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantCheckoutId,
        name: 'UZ Store',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          currency: 'UZS',
          theme_config: { ...DEFAULT_THEME_CONFIG },
        },
      });

      mockPrisma.__tx.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        tenant_id: tenantCheckoutId,
        title: 'Chapan Jacket',
        price: 350000,
        stock: 5,
        images: [],
        is_active: true,
      });
      mockPrisma.__tx.$executeRaw.mockResolvedValue(1);
      mockPrisma.__tx.order.create.mockResolvedValue({
        id: 'order-paynet-1',
        total_amount: 700000,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/checkout?tenant_id=${tenantCheckoutId}`,
        payload: {
          customerTelegramId: '777888',
          customerName: 'Aziz',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.provider).toBe('paynet');
      expect(body.paynetQrUrl).toBe(DEFAULT_PAYNET_QR_URL);
      expect(body.payment.provider).toBe('paynet');
      expect(body.currency).toBe('UZS');
      expect(body.totalAmount).toBe(700000);
      expect(mockPrisma.__tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
          }),
        })
      );
    });

    it('POST /api/v1/shop/orders/:id/confirm-paynet is idempotent when already PAID and rejects CANCELLED', async () => {
      const tenantPayId = '44444444-4444-4444-4444-444444444444';
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-already-paid',
        tenant_id: tenantPayId,
        status: ORDER_STATUS.PAID,
        items: [],
        tenant: { botConfig: { currency: 'UZS' } },
      });

      const paidRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-already-paid/confirm-paynet?tenant_id=${tenantPayId}`,
        payload: {},
      });
      expect(paidRes.statusCode).toBe(200);
      expect(paidRes.json().success).toBe(true);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-cancelled',
        tenant_id: tenantPayId,
        status: ORDER_STATUS.CANCELLED,
        items: [],
        tenant: { botConfig: { currency: 'UZS' } },
      });

      const cancelledRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-cancelled/confirm-paynet?tenant_id=${tenantPayId}`,
        payload: {},
      });
      expect(cancelledRes.statusCode).toBe(400);
      expect(cancelledRes.json().error).toContain('cancelled');
    });

    it('POST /api/v1/shop/orders/:id/confirm-paynet rejects cross-tenant access when tenant_id mismatches', async () => {
      const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-tenant-a',
        tenant_id: tenantA,
        status: ORDER_STATUS.PENDING,
        items: [],
        tenant: { botConfig: { currency: 'UZS' } },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-tenant-a/confirm-paynet?tenant_id=${tenantB}`,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Order not found');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('GET /api/v1/shop/orders/:id/success fulfills only when session_id starts with cs_ or mock_sess_', async () => {
      // Missing session_id -> should NOT call fulfillOrder / prisma.order.findUnique
      const missingRes = await app.inject({
        method: 'GET',
        url: '/api/v1/shop/orders/order-s1/success',
      });
      expect(missingRes.statusCode).toBe(200);
      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();

      // Invalid/spoofed session_id -> should NOT fulfill
      const invalidRes = await app.inject({
        method: 'GET',
        url: '/api/v1/shop/orders/order-s1/success?session_id=forged_session',
      });
      expect(invalidRes.statusCode).toBe(200);
      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();

      // Valid cs_ session_id -> SHOULD call fulfillOrder
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-s1',
        status: ORDER_STATUS.PAID,
      });
      const validRes = await app.inject({
        method: 'GET',
        url: '/api/v1/shop/orders/order-s1/success?session_id=cs_test_123',
      });
      expect(validRes.statusCode).toBe(200);
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order-s1' } })
      );
    });
  });

  describe('Admin Routes (/api/v1/admin/*)', () => {
    it('POST /api/v1/admin/auth/register creates tenant with UZS currency and Paynet theme defaults', async () => {
      const createdTenantId = '55555555-5555-5555-5555-555555555555';
      mockPrisma.tenant.create.mockResolvedValue({
        id: createdTenantId,
        name: 'Samarkand Silk',
        plan: 'BASIC_20',
        adminUsers: [
          {
            id: 'admin-1',
            email: 'owner@silk.uz',
            role: 'OWNER',
          },
        ],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/register',
        payload: {
          email: 'owner@silk.uz',
          password: 'strong-password',
          storeName: 'Samarkand Silk',
          ownerTelegramId: '100200300',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.token).toBeTruthy();
      expect(body.tenant.id).toBe(createdTenantId);

      const createArgs = mockPrisma.tenant.create.mock.calls[0][0];
      expect(createArgs.data.botConfig.create.currency).toBe('UZS');
      expect(createArgs.data.botConfig.create.theme_config).toMatchObject({
        currency: 'UZS',
        paynetEnabled: true,
        paynetQrUrl: DEFAULT_PAYNET_QR_URL,
        storeName: 'Samarkand Silk',
      });
    });

    it('POST /api/v1/admin/auth/register returns 409 on duplicate email (case/whitespace normalized)', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValueOnce({
        id: 'existing-admin',
        email: 'owner@silk.uz',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/register',
        payload: {
          email: '  Owner@Silk.UZ  ',
          password: 'strong-password',
          storeName: 'Duplicate Store',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('уже зарегистрирован');
      expect(mockPrisma.adminUser.findFirst).toHaveBeenCalledWith({
        where: { email: 'owner@silk.uz' },
      });
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });

    it('POST and PUT /api/v1/admin/products accept both is_active and isActive (including false)', async () => {
      const tenantAdminId = '66666666-6666-6666-6666-666666666666';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId: tenantAdminId,
        email: 'a@b.uz',
        role: 'OWNER',
      });

      mockTenantDb.product.create.mockResolvedValue({ id: 'p-new', is_active: false });
      mockTenantDb.product.update.mockResolvedValue({ id: 'p-new', is_active: false });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          title: 'Silk Scarf',
          price: 120000,
          stock: 8,
          is_active: false,
        },
      });
      expect(createRes.statusCode).toBe(201);
      expect(mockTenantDb.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false }),
        })
      );

      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/p-new',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          is_active: false,
        },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(mockTenantDb.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false }),
        })
      );
    });

    it('PATCH /api/v1/admin/orders/:id/status restores stock on PENDING->CANCELLED and notifies customer via Telegram', async () => {
      const tenantAdminId = '77777777-7777-7777-7777-777777777777';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId: tenantAdminId,
        email: 'a@b.uz',
        role: 'OWNER',
      });

      // Invalid status -> 400
      const badRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-1/status',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: 'NOT_A_STATUS' },
      });
      expect(badRes.statusCode).toBe(400);

      // Valid PENDING -> CANCELLED transition
      const existingOrder = {
        id: 'ord-restore-1',
        tenant_id: tenantAdminId,
        status: ORDER_STATUS.PENDING,
        customer_telegram_id: '99887766',
        items: [{ productId: 'prod-abc', quantity: 3 }],
      };
      mockTenantDb.order.findFirst.mockResolvedValue(existingOrder);
      mockPrisma.__tx.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.__tx.order.findFirst.mockResolvedValue({
        ...existingOrder,
        status: ORDER_STATUS.CANCELLED,
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantAdminId,
        name: 'Tashkent Shop',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'sec',
          currency: 'UZS',
          theme_config: {},
        },
      });

      const botData = await getOrInitBot(tenantAdminId);
      expect(botData).not.toBeNull();
      const sendMessageSpy = vi.spyOn(botData!.bot.api, 'sendMessage').mockResolvedValue({} as any);

      const cancelRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-restore-1/status',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: ORDER_STATUS.CANCELLED },
      });

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.json().order.status).toBe(ORDER_STATUS.CANCELLED);
      // Stock restoration raw SQL executed inside transaction
      expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
      // Customer notified via Telegram Bot API
      expect(sendMessageSpy).toHaveBeenCalledWith(
        '99887766',
        expect.stringContaining('#ord-rest'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });
  });

  describe('Reservation Sweeper (sweepExpiredPendingOrders)', () => {
    it('cancels stale PENDING orders, restores stock when updateMany count=1, and notifies customer', async () => {
      const tenantSweepId = '88888888-8888-8888-8888-888888888888';
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'stale-order-1',
          tenant_id: tenantSweepId,
          customer_telegram_id: '44556677',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        {
          id: 'already-paid-race',
          tenant_id: tenantSweepId,
          customer_telegram_id: '99112233',
          items: [{ productId: 'prod-2', quantity: 1 }],
        },
      ]);

      mockPrisma.__tx.order.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockPrisma.__tx.$executeRaw.mockResolvedValue(1);

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantSweepId,
        name: 'Sweep Store',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'sec',
          currency: 'UZS',
          theme_config: {},
        },
      });

      const botData = await getOrInitBot(tenantSweepId);
      const sendSpy = vi.spyOn(botData!.bot.api, 'sendMessage').mockResolvedValue({} as any);

      const cancelled = await sweepExpiredPendingOrders();

      expect(cancelled).toBe(1);
      expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(
        '44556677',
        expect.stringContaining('#stale-or'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });
  });
});
