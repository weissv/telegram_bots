import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps/api/package.json'));
const bcrypt = requireFromApi('bcryptjs');
import {
  PLATFORM_PAYNET_QR_URL,
  DEFAULT_THEME_CONFIG,
  PLAN_PRICING,
  PLAN_TIERS,
  ORDER_STATUS,
  SUBSCRIPTION_STATUS,
  PAYMENT_METHODS,
  encryptBotToken,
  verifyBindToken,
} from '@telegram-commerce/config';

const { mockPrisma, mockTenantDb, resetMocks } = vi.hoisted(() => {
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
      updateMany: vi.fn(),
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
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };

  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    botConfig: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    adminUser: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
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

    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
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
  AdminRole: {
    OWNER: 'OWNER',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
  },
}));

import { createServer } from '../../apps/api/src/server.js';
import {
  ensureBotInitialized,
  getOrInitBot,
  invalidateTenantBot,
} from '../../apps/api/src/services/botManager.js';
import { sweepExpiredPendingOrders } from '../../apps/api/src/services/reservationWorker.js';
import { ensureDatabaseSeeded } from '../../apps/api/src/services/seedService.js';

const MERCHANT_PAYNET_QR_URL =
  'https://app.paynet.uz/qr-online/00020101021140440012qr-online.uz0118merchant99999999990202115204531153038605802UZ6304ABCD';

function buildInitData(botToken: string, telegramUserId: number, firstName = 'Aziz'): string {
  const authDate = Math.floor(Date.now() / 1000);
  const params: Array<[string, string]> = [
    ['auth_date', String(authDate)],
    ['user', JSON.stringify({ id: telegramUserId, first_name: firstName })],
  ];
  params.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = params.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const sp = new URLSearchParams();
  params.forEach(([k, v]) => sp.append(k, v));
  sp.append('hash', hash);
  return sp.toString();
}

describe('Fastify API Routes & Phase 3 Security Remediations', () => {
  let app: FastifyInstance;
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowDemo = process.env.ALLOW_DEMO_LOGIN;

  beforeEach(async () => {
    resetMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_DEMO_LOGIN;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1, username: 'test_shop_bot', id: 123456, is_bot: true, first_name: 'ShopBot' } }),
    } as any);
    app = await createServer();
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowDemo !== undefined) {
      process.env.ALLOW_DEMO_LOGIN = originalAllowDemo;
    } else {
      delete process.env.ALLOW_DEMO_LOGIN;
    }
    if (app) {
      await app.close();
    }
    global.fetch = originalFetch;
  });

  describe('Core System & Health Routes', () => {
    it('GET /health returns 200 with db: ok when PostgreSQL responds', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.db).toBe('ok');
      expect(body).toHaveProperty('mode');
      expect(body).toHaveProperty('timestamp');
    });

    it('GET /health returns 503 with db: down when database query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('error');
      expect(body.db).toBe('down');
    });

    it('GET /robots.txt returns plain text allow-all policy', async () => {
      const res = await app.inject({ method: 'GET', url: '/robots.txt' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.body).toBe('User-agent: *\nAllow: /\n');
    });
  });

  describe('Billing Routes (/api/v1/billing/*)', () => {
    it('POST /api/v1/billing/checkout rejects STANDALONE_LIFETIME and invalid plans with 400', async () => {
      const standaloneRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: {
          plan: PLAN_TIERS.STANDALONE_LIFETIME,
          email: 'owner@store.uz',
          password: 'password123',
        },
      });
      expect(standaloneRes.statusCode).toBe(400);
      expect(standaloneRes.json().error).toContain('Standalone');

      const invalidRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: { plan: 'UNKNOWN_PLAN', email: 'owner@store.uz', password: 'password123' },
      });
      expect(invalidRes.statusCode).toBe(400);
      expect(invalidRes.json().error).toBe('Invalid plan selected');

      const missingCredsRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: { plan: PLAN_TIERS.PRO_30 },
      });
      expect(missingCredsRes.statusCode).toBe(400);
    });

    it('POST /api/v1/billing/checkout creates unified account, INV-... PENDING_PAYMENT invoice, JWT, and signed bind_ deep link', async () => {
      const tenantId = '11111111-2222-3333-4444-555555555555';
      mockPrisma.adminUser.findFirst.mockResolvedValueOnce(null);
      mockPrisma.tenant.create.mockResolvedValueOnce({
        id: tenantId,
        name: 'Tashkent Silk',
        plan: PLAN_TIERS.PRO_30,
        subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
        adminUsers: [{ id: 'adm-1', email: 'silk@uzshop.uz', role: 'OWNER' }],
      });
      mockPrisma.subscription.create.mockResolvedValueOnce({
        id: 'sub-inv-1',
        tenant_id: tenantId,
        plan: PLAN_TIERS.PRO_30,
        invoice_number: 'INV-20261118-4242',
        amount_uzs: PLAN_PRICING[PLAN_TIERS.PRO_30].priceUzs,
        status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: {
          plan: PLAN_TIERS.PRO_30,
          email: '  Silk@UzShop.UZ ',
          password: 'strong-password-1',
          storeName: 'Tashkent Silk',
          phone: '+998901112233',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.provider).toBe('paynet');
      expect(body.paynetQrUrl).toBe(PLATFORM_PAYNET_QR_URL);
      expect(body.plan).toBe(PLAN_TIERS.PRO_30);
      expect(body.priceUsd).toBe(30);
      expect(body.priceUzs).toBe(385000);
      expect(body.token).toBeTruthy();
      expect(body.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
      expect(body.subscription.status).toBe(SUBSCRIPTION_STATUS.PENDING_PAYMENT);
      expect(body.botDeepLink).toContain('?start=bind_');

      // Verify bindToken cryptographically resolves back to tenantId
      const verifiedBind = verifyBindToken(body.bindToken, process.env.JWT_SECRET);
      expect(verifiedBind.valid).toBe(true);
      expect(verifiedBind.tenantId).toBe(tenantId);

      // Verify tenant draft created with PENDING_PAYMENT & unpublished BotConfig (zero platform QR)
      const createTenantCall = mockPrisma.tenant.create.mock.calls[0][0];
      expect(createTenantCall.data.subscription_status).toBe(SUBSCRIPTION_STATUS.PENDING_PAYMENT);
      expect(createTenantCall.data.botConfig.create.is_active).toBe(false);
      expect(createTenantCall.data.botConfig.create.theme_config.paynetEnabled).toBe(false);
      expect(createTenantCall.data.botConfig.create.theme_config.paynetQrUrl).toBe('');
    });

    it('POST /api/v1/billing/checkout returns 409 EMAIL_EXISTS on wrong password and reuses tenant on valid password', async () => {
      const existingHash = await bcrypt.hash('correct-pass', 10);
      const existingTenantId = '11111111-aaaa-bbbb-cccc-000000000001';

      mockPrisma.adminUser.findFirst.mockResolvedValueOnce({
        id: 'adm-ex-1',
        tenant_id: existingTenantId,
        email: 'existing@uz.uz',
        password_hash: existingHash,
        role: 'OWNER',
        tenant: {
          id: existingTenantId,
          name: 'Existing Shop',
          plan: PLAN_TIERS.BASIC_20,
          subscription_status: SUBSCRIPTION_STATUS.PAST_DUE,
        },
      });

      const conflictRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: {
          plan: PLAN_TIERS.BASIC_20,
          email: 'existing@uz.uz',
          password: 'wrong-password',
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().code).toBe('EMAIL_EXISTS');

      mockPrisma.adminUser.findFirst.mockResolvedValueOnce({
        id: 'adm-ex-1',
        tenant_id: existingTenantId,
        email: 'existing@uz.uz',
        password_hash: existingHash,
        role: 'OWNER',
        tenant: {
          id: existingTenantId,
          name: 'Existing Shop',
          plan: PLAN_TIERS.BASIC_20,
          subscription_status: SUBSCRIPTION_STATUS.PAST_DUE,
        },
      });
      mockPrisma.subscription.create.mockResolvedValueOnce({
        id: 'sub-renew-1',
        tenant_id: existingTenantId,
        plan: PLAN_TIERS.BASIC_20,
        invoice_number: 'INV-20261118-7777',
        amount_uzs: 255000,
        status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
      });

      const okRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: {
          plan: PLAN_TIERS.BASIC_20,
          email: 'existing@uz.uz',
          password: 'correct-pass',
        },
      });
      expect(okRes.statusCode).toBe(200);
      expect(okRes.json().tenant.id).toBe(existingTenantId);
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
    });

    it('POST /api/v1/billing/confirm-paynet moves invoice to PENDING_REVIEW (NEVER ACTIVE) and alerts superadmin', async () => {
      const tenantId = '11111111-1111-1111-1111-111111111111';
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        id: 'sub-inv-99',
        tenant_id: tenantId,
        plan: PLAN_TIERS.PRO_30,
        invoice_number: 'INV-20261118-9999',
        amount_uzs: 385000,
        status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
        tenant: {
          id: tenantId,
          name: 'Mirai Demo Store',
          owner_telegram_id: '987654321',
          plan: PLAN_TIERS.PRO_30,
          subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
          is_active: true,
        },
      });
      mockPrisma.subscription.update.mockResolvedValueOnce({
        id: 'sub-inv-99',
        invoice_number: 'INV-20261118-9999',
        status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
      });
      mockPrisma.tenant.update.mockResolvedValueOnce({
        id: tenantId,
        subscription_status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/confirm-paynet',
        payload: {
          invoiceNumber: 'INV-20261118-9999',
          paymentReference: 'PAYNET-TRX-7788',
          customerEmail: 'merchant@uzshop.uz',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        success: true,
        plan: PLAN_TIERS.PRO_30,
        invoiceNumber: 'INV-20261118-9999',
        subscriptionId: 'sub-inv-99',
        subscriptionStatus: SUBSCRIPTION_STATUS.PENDING_REVIEW,
      });

      // NEVER auto-activate on self-report
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-inv-99' },
          data: expect.objectContaining({
            status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
            payment_reference: 'PAYNET-TRX-7788',
          }),
        })
      );
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tenantId },
          data: expect.objectContaining({
            subscription_status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
          }),
        })
      );

      const sendCall = (global.fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/sendMessage'));
      expect(sendCall).toBeTruthy();
      const sentBody = JSON.parse(sendCall[1].body);
      expect(sentBody.text).toContain('INV-20261118-9999');
      expect(sentBody.text).toContain('PENDING_REVIEW');
      const inlineKeyboard = sentBody.reply_markup?.inline_keyboard;
      expect(inlineKeyboard).toHaveLength(2);
      const approveCb = inlineKeyboard[0][0].callback_data;
      const suspendCb = inlineKeyboard[1][0].callback_data;
      expect(approveCb).toBe('admin:sub:approve:11111111111111111111111111111111:PRO_30');
      expect(suspendCb).toBe('admin:sub:suspend:11111111111111111111111111111111');
      expect(Buffer.byteLength(approveCb, 'utf8')).toBeLessThanOrEqual(64);
      expect(Buffer.byteLength(suspendCb, 'utf8')).toBeLessThanOrEqual(64);
    });

    it('POST /api/v1/billing/confirm-paynet rejects STANDALONE_LIFETIME and missing invoices', async () => {
      const standaloneRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/confirm-paynet',
        payload: { plan: PLAN_TIERS.STANDALONE_LIFETIME },
      });
      expect(standaloneRes.statusCode).toBe(400);

      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      const missingRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/confirm-paynet',
        payload: { invoiceNumber: 'INV-NOT-FOUND' },
      });
      expect(missingRes.statusCode).toBe(404);
    });

    it('POST /api/v1/billing/approve enforces superadmin auth and extends active period additively by +30 days', async () => {
      const unauthRes = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/approve',
        payload: { invoiceNumber: 'INV-20261118-9999' },
      });
      expect(unauthRes.statusCode).toBe(403);

      const tenantId = '11111111-1111-1111-1111-111111119999';
      const existingEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days remaining
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        id: 'sub-app-1',
        tenant_id: tenantId,
        plan: PLAN_TIERS.PRO_30,
        invoice_number: 'INV-20261118-9999',
        status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
        current_period_end: null,
      });
      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Additive Store',
        plan: PLAN_TIERS.PRO_30,
      });
      mockPrisma.subscription.findMany.mockResolvedValueOnce([
        { id: 'sub-prev-active', current_period_end: existingEnd },
      ]);
      mockPrisma.subscription.update.mockImplementationOnce(async (args: any) => ({
        id: 'sub-app-1',
        ...args.data,
      }));
      mockPrisma.tenant.update.mockResolvedValueOnce({
        id: tenantId,
        plan: PLAN_TIERS.PRO_30,
        subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
        is_active: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/approve',
        headers: { 'x-superadmin-secret': process.env.JWT_SECRET! },
        payload: { invoiceNumber: 'INV-20261118-9999', reviewedBy: 'admin@platform' },
      });

      expect(res.statusCode).toBe(200);
      const subUpdateData = mockPrisma.subscription.update.mock.calls[0][0].data;
      expect(subUpdateData.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
      expect(subUpdateData.reviewed_by).toBe('admin@platform');
      // Additive: ~40 days from now (10 remaining + 30 new), NOT just 30 days
      const diffDays = (subUpdateData.current_period_end.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(39);
      expect(diffDays).toBeLessThan(41);
    });
  });

  describe('Shop Routes (/api/v1/shop/*)', () => {
    it('GET /api/v1/shop/bootstrap NEVER injects platform Paynet QR and reports checkoutDisabledReason when unconfigured', async () => {
      const tenantId = '22222222-2222-2222-2222-222222222201';
      await invalidateTenantBot(tenantId);

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Tashkent Fashion',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          is_active: true,
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
      expect(body.theme.paynetQrUrl).toBe('');
      expect(body.theme.paynetQrUrl).not.toBe(PLATFORM_PAYNET_QR_URL);
      expect(body.checkoutEnabled).toBe(false);
      expect(body.checkoutDisabledReason).toBe('PAYNET_NOT_CONFIGURED');
      expect(body.featuredProducts).toHaveLength(1);
      expect(mockTenantDb.product.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { is_active: true } })
      );
      expect(mockTenantDb.product.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { is_active: true }, take: 200 })
      );
    });

    it('GET /api/v1/shop/bootstrap enables checkout ONLY when active, subscribed, published, non-demo, and valid merchant Paynet QR', async () => {
      const tenantId = '22222222-2222-2222-2222-222222222202';
      await invalidateTenantBot(tenantId);

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Ready Store',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          is_active: true,
          currency: 'UZS',
          theme_config: {
            paynetEnabled: true,
            paynetQrUrl: MERCHANT_PAYNET_QR_URL,
            legalName: 'ИП Рахимов',
            supportContact: '@ready_support',
          },
        },
      });
      mockTenantDb.product.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/bootstrap?tenant_id=${tenantId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.checkoutEnabled).toBe(true);
      expect(body.checkoutDisabledReason).toBeNull();
      expect(body.theme.paynetQrUrl).toBe(MERCHANT_PAYNET_QR_URL);
    });

    it('GET /api/v1/shop/products supports ?q=, ?category=, ?limit=, ?offset= and returns total + pagination', async () => {
      const tenantId = '22222222-2222-2222-2222-222222222203';
      mockTenantDb.product.count.mockResolvedValueOnce(1);
      mockTenantDb.product.findMany.mockResolvedValueOnce([
        { id: 'p-hoodie', title: 'Tashkent Hoodie', category: 'Apparel', price: 420000, stock: 5 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/products?tenant_id=${tenantId}&q=hoodie&category=Apparel&limit=10&offset=0`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBe(1);
      expect(body.products).toHaveLength(1);
      expect(mockTenantDb.product.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          is_active: true,
          category: 'Apparel',
          OR: [
            { title: { contains: 'hoodie', mode: 'insensitive' } },
            { description: { contains: 'hoodie', mode: 'insensitive' } },
            { category: { contains: 'hoodie', mode: 'insensitive' } },
          ],
        }),
      });
    });

    it('POST /api/v1/shop/checkout blocks when Paynet QR is missing/disabled, phone/address missing, or demo store', async () => {
      const unconfiguredTenant = '33333333-3333-3333-3333-333333333301';
      await invalidateTenantBot(unconfiguredTenant);

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: unconfiguredTenant,
        name: 'No Paynet Store',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          is_active: true,
          currency: 'UZS',
          theme_config: { ...DEFAULT_THEME_CONFIG },
        },
      });

      const noPaynetRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/checkout?tenant_id=${unconfiguredTenant}`,
        payload: {
          customerTelegramId: '777888',
          customerName: 'Aziz',
          customerPhone: '+998901234567',
          shippingAddress: 'Tashkent, Amir Temur 1',
          items: [{ productId: 'prod-1', quantity: 1 }],
        },
      });
      expect(noPaynetRes.statusCode).toBe(400);
      expect(noPaynetRes.json().error).toContain('PAYNET_NOT_CONFIGURED');

      const validTenant = '33333333-3333-3333-3333-333333333302';
      await invalidateTenantBot(validTenant);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: validTenant,
        name: 'Valid Store',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          is_active: true,
          currency: 'UZS',
          theme_config: {
            paynetEnabled: true,
            paynetQrUrl: MERCHANT_PAYNET_QR_URL,
          },
        },
      });

      const noPhoneRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/checkout?tenant_id=${validTenant}`,
        payload: {
          customerTelegramId: '777888',
          customerName: 'Aziz',
          shippingAddress: 'Tashkent',
          items: [{ productId: 'prod-1', quantity: 1 }],
        },
      });
      expect(noPhoneRes.statusCode).toBe(400);
      expect(noPhoneRes.json().error).toContain('PHONE_REQUIRED');

      const noAddrRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/checkout?tenant_id=${validTenant}`,
        payload: {
          customerTelegramId: '777888',
          customerName: 'Aziz',
          customerPhone: '+998901234567',
          deliveryMethod: 'COURIER',
          items: [{ productId: 'prod-1', quantity: 1 }],
        },
      });
      expect(noAddrRes.statusCode).toBe(400);
      expect(noAddrRes.json().error).toContain('ADDRESS_REQUIRED');
    });

    it('POST /api/v1/shop/checkout calculates delivery fee, saves variant & access_token, and returns merchant Paynet URL', async () => {
      const tenantCheckoutId = '33333333-3333-3333-3333-333333333303';
      await invalidateTenantBot(tenantCheckoutId);

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantCheckoutId,
        name: 'UZ Store',
        plan: 'PRO_30',
        owner_telegram_id: '555123',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'secret',
          is_active: true,
          currency: 'UZS',
          theme_config: {
            ...DEFAULT_THEME_CONFIG,
            paynetEnabled: true,
            paynetQrUrl: MERCHANT_PAYNET_QR_URL,
            deliveryFeeUzs: 25000,
            freeDeliveryThresholdUzs: 300000,
          },
        },
      });

      mockPrisma.__tx.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        tenant_id: tenantCheckoutId,
        title: 'Cotton T-Shirt',
        price: 150000,
        stock: 5,
        variants: ['S', 'M', 'L'],
        images: [],
        is_active: true,
      });
      mockPrisma.__tx.$executeRaw.mockResolvedValue(1);
      mockPrisma.__tx.order.create.mockResolvedValue({
        id: 'order-paynet-1',
        total_amount: 175000,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/checkout?tenant_id=${tenantCheckoutId}`,
        payload: {
          customerTelegramId: '777888',
          customerName: 'Aziz',
          customerPhone: '+998901234567',
          shippingAddress: 'Tashkent, Chilonzor 5',
          deliveryMethod: 'COURIER',
          items: [{ productId: 'prod-1', quantity: 1, variant: 'L' }],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.provider).toBe('paynet');
      expect(body.paynetQrUrl).toBe(MERCHANT_PAYNET_QR_URL);
      expect(body.paynetQrUrl).not.toBe(PLATFORM_PAYNET_QR_URL);
      expect(body.accessToken).toMatch(/^[0-9a-f]{48}$/);
      expect(body.subtotal).toBe(150000);
      expect(body.deliveryFee).toBe(25000);
      expect(body.totalAmount).toBe(175000);
      expect(mockPrisma.__tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
            delivery_method: 'COURIER',
            delivery_fee: 25000,
            total_amount: 175000,
            access_token: body.accessToken,
            items: [expect.objectContaining({ productId: 'prod-1', variant: 'L', quantity: 1 })],
          }),
        })
      );
    });

    it('GET /api/v1/shop/orders/:id rejects unauthenticated/wrong-token/cross-user calls and strips access_token when authorized', async () => {
      const tenantId = '44444444-4444-4444-4444-444444444401';
      const botToken = '123456:SHOP_BOT_TOKEN';
      await invalidateTenantBot(tenantId);

      const orderRecord = {
        id: 'order-secret-1',
        tenant_id: tenantId,
        customer_telegram_id: '777888',
        access_token: 'secret-order-access-token-12345',
        status: ORDER_STATUS.PENDING,
        total_amount: 175000,
      };
      mockTenantDb.order.findFirst.mockResolvedValue(orderRecord);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Protected Shop',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken(botToken),
          webhook_secret: 'sec',
          is_active: true,
          currency: 'UZS',
          theme_config: {},
        },
      });

      // 1. Unauthenticated -> 401
      const unauthRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}`,
      });
      expect(unauthRes.statusCode).toBe(401);

      // 2. Wrong order token -> 403
      const wrongTokRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}&token=wrong-token`,
      });
      expect(wrongTokRes.statusCode).toBe(403);

      // 3. Matching order token -> 200 and strips access_token
      const validTokRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}&token=secret-order-access-token-12345`,
      });
      expect(validTokRes.statusCode).toBe(200);
      expect(validTokRes.json().order.id).toBe('order-secret-1');
      expect(validTokRes.json().order.access_token).toBeUndefined();

      // 4. Telegram initData for WRONG user -> 403
      const otherInitData = buildInitData(botToken, 999999, 'OtherUser');
      const wrongUserRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}`,
        headers: { 'x-telegram-init-data': otherInitData },
      });
      expect(wrongUserRes.statusCode).toBe(403);

      // 5. Telegram initData for OWNER customer -> 200
      const ownerInitData = buildInitData(botToken, 777888, 'Aziz');
      const okInitDataRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}`,
        headers: { 'x-telegram-init-data': ownerInitData },
      });
      expect(okInitDataRes.statusCode).toBe(200);
      expect(okInitDataRes.json().order.access_token).toBeUndefined();

      // 6. Cross-tenant Admin JWT -> 403, Same-tenant Admin JWT -> 200
      const otherAdminJwt = (app as any).jwt.sign({
        userId: 'u-other',
        tenantId: '99999999-9999-9999-9999-999999999999',
        email: 'other@shop.uz',
        role: 'OWNER',
      });
      const crossAdminRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}`,
        headers: { Authorization: `Bearer ${otherAdminJwt}` },
      });
      expect(crossAdminRes.statusCode).toBe(403);

      const sameAdminJwt = (app as any).jwt.sign({
        userId: 'u-same',
        tenantId,
        email: 'owner@shop.uz',
        role: 'OWNER',
      });
      const sameAdminRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shop/orders/order-secret-1?tenant_id=${tenantId}`,
        headers: { Authorization: `Bearer ${sameAdminJwt}` },
      });
      expect(sameAdminRes.statusCode).toBe(200);
    });

    it('POST /api/v1/shop/orders/:id/confirm-paynet requires auth, moves PENDING -> PAYMENT_REVIEW (NEVER PAID), and is idempotent on PAYMENT_REVIEW', async () => {
      const tenantPayId = '44444444-4444-4444-4444-444444444402';
      await invalidateTenantBot(tenantPayId);

      // Unauthenticated call rejected with 401
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-pending-1',
        tenant_id: tenantPayId,
        access_token: 'tok-abc',
        status: ORDER_STATUS.PENDING,
        items: [],
      });
      const unauthRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-pending-1/confirm-paynet?tenant_id=${tenantPayId}`,
        payload: {},
      });
      expect(unauthRes.statusCode).toBe(401);

      // Authorized PENDING -> PAYMENT_REVIEW
      const pendingOrder = {
        id: 'order-pending-1',
        tenant_id: tenantPayId,
        access_token: 'tok-abc',
        status: ORDER_STATUS.PENDING,
        customer_telegram_id: '555666',
        total_amount: 200000,
        status_history: [{ status: 'PENDING', at: '2026-11-18T10:00:00Z', by: 'customer' }],
        items: [{ title: 'Hoodie', quantity: 1, price: 200000 }],
        tenant: { owner_telegram_id: '111222', botConfig: { currency: 'UZS' } },
      };
      mockPrisma.order.findUnique.mockResolvedValue(pendingOrder);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantPayId,
        name: 'Review Shop',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'sec',
          is_active: true,
          currency: 'UZS',
          theme_config: {},
        },
      });
      mockPrisma.order.update.mockResolvedValueOnce({
        ...pendingOrder,
        status: ORDER_STATUS.PAYMENT_REVIEW,
      });

      const reviewRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-pending-1/confirm-paynet?tenant_id=${tenantPayId}`,
        payload: { accessToken: 'tok-abc', note: 'Paid from Humo' },
      });
      expect(reviewRes.statusCode).toBe(200);
      expect(reviewRes.json().success).toBe(true);
      expect(reviewRes.json().order.status).toBe(ORDER_STATUS.PAYMENT_REVIEW);
      expect(reviewRes.json().order.access_token).toBeUndefined();

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ORDER_STATUS.PAYMENT_REVIEW);
      expect(updateCall.data.payment_id).toBeUndefined();
      expect(updateCall.data.status_history).toHaveLength(2);

      // Idempotent when already PAYMENT_REVIEW
      mockPrisma.order.update.mockReset();
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-already-review',
        tenant_id: tenantPayId,
        access_token: 'tok-rev',
        status: ORDER_STATUS.PAYMENT_REVIEW,
        items: [],
        tenant: { botConfig: { currency: 'UZS' } },
      });
      const idempotentRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-already-review/confirm-paynet?tenant_id=${tenantPayId}`,
        headers: { 'x-order-token': 'tok-rev' },
        payload: {},
      });
      expect(idempotentRes.statusCode).toBe(200);
      expect(idempotentRes.json().success).toBe(true);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();

      // Rejects CANCELLED (and PAID) from entering PAYMENT_REVIEW
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-cancelled',
        tenant_id: tenantPayId,
        access_token: 'tok-can',
        status: ORDER_STATUS.CANCELLED,
        items: [],
        tenant: { botConfig: { currency: 'UZS' } },
      });
      const cancelledRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-cancelled/confirm-paynet?tenant_id=${tenantPayId}`,
        headers: { 'x-order-token': 'tok-can' },
        payload: {},
      });
      expect(cancelledRes.statusCode).toBe(400);
    });

    it('POST /api/v1/shop/orders/:id/confirm-paynet rejects cross-tenant access with 404', async () => {
      const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-tenant-a',
        tenant_id: tenantA,
        access_token: 'tok-a',
        status: ORDER_STATUS.PENDING,
        items: [],
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-tenant-a/confirm-paynet?tenant_id=${tenantB}`,
        payload: { accessToken: 'tok-a' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Order not found');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('POST /api/v1/shop/orders/:id/cancel enforces access_token and restores stock atomically for PENDING orders only', async () => {
      const tenantId = '44444444-4444-4444-4444-444444444403';
      const pendingOrder = {
        id: 'order-cancel-1',
        tenant_id: tenantId,
        access_token: 'cancel-tok-1',
        status: ORDER_STATUS.PENDING,
        items: [{ productId: 'prod-9', quantity: 2 }],
        status_history: [],
      };
      mockPrisma.order.findUnique.mockResolvedValueOnce(pendingOrder);
      const unauthCancel = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-cancel-1/cancel?tenant_id=${tenantId}`,
        payload: {},
      });
      expect(unauthCancel.statusCode).toBe(401);

      mockPrisma.order.findUnique.mockResolvedValueOnce(pendingOrder);
      mockPrisma.__tx.order.findFirst
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce({ ...pendingOrder, status: ORDER_STATUS.CANCELLED });
      mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.__tx.$executeRaw.mockResolvedValueOnce(1);

      const okCancel = await app.inject({
        method: 'POST',
        url: `/api/v1/shop/orders/order-cancel-1/cancel?tenant_id=${tenantId}`,
        payload: { accessToken: 'cancel-tok-1' },
      });
      expect(okCancel.statusCode).toBe(200);
      expect(okCancel.json().success).toBe(true);
      expect(okCancel.json().order.status).toBe(ORDER_STATUS.CANCELLED);
      expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('GET /api/v1/shop/orders/:id/success never marks Paynet orders PAID even with session_id=cs_...', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'order-paynet-s1',
        payment_method: PAYMENT_METHODS.PAYNET_XOLIS,
        status: ORDER_STATUS.PENDING,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/shop/orders/order-paynet-s1/success?session_id=cs_spoofed_123',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('Order Pending Payment Verification');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('Admin Routes (/api/v1/admin/*)', () => {
    it('POST /api/v1/admin/auth/register returns 201 and creates PENDING_PAYMENT draft with Paynet disabled', async () => {
      const createdTenantId = '55555555-5555-5555-5555-555555555555';
      mockPrisma.adminUser.findFirst.mockResolvedValueOnce(null);
      mockPrisma.tenant.create.mockResolvedValueOnce({
        id: createdTenantId,
        name: 'Samarkand Silk',
        plan: 'BASIC_20',
        subscription_status: SUBSCRIPTION_STATUS.PENDING_PAYMENT,
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

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.token).toBeTruthy();
      expect(body.tenant.id).toBe(createdTenantId);
      expect(body.tenant.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.PENDING_PAYMENT);

      const createArgs = mockPrisma.tenant.create.mock.calls[0][0];
      expect(createArgs.data.subscription_status).toBe(SUBSCRIPTION_STATUS.PENDING_PAYMENT);
      expect(createArgs.data.botConfig.create.is_active).toBe(false);
      expect(createArgs.data.botConfig.create.currency).toBe('UZS');
      expect(createArgs.data.botConfig.create.theme_config).toMatchObject({
        currency: 'UZS',
        paynetEnabled: false,
        paynetQrUrl: '',
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

    it('POST /api/v1/admin/auth/login blocks demo credentials in production unless ALLOW_DEMO_LOGIN=true', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_LOGIN;

      const blockedRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'demo_merchant@telegram-commerce.local',
          password: 'password123',
        },
      });
      expect(blockedRes.statusCode).toBe(403);
      expect(mockPrisma.adminUser.findFirst).not.toHaveBeenCalled();
    });

    it('GET /api/v1/admin/auth/me returns botConfig, subscription, and launch readiness checklist', async () => {
      const tenantId = '66666666-6666-6666-6666-666666666601';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId,
        email: 'a@b.uz',
        role: 'OWNER',
      });

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: tenantId,
        name: 'Checklist Store',
        plan: PLAN_TIERS.PRO_30,
        subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
        is_active: true,
        owner_telegram_id: '12345',
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:REAL_BOT_TOKEN'),
          bot_username: 'checklist_bot',
          is_active: false,
          currency: 'UZS',
          theme_config: {
            paynetEnabled: true,
            paynetQrUrl: MERCHANT_PAYNET_QR_URL,
            legalName: 'ИП Алимов',
            supportContact: '@alimov_support',
          },
        },
        subscriptions: [{ id: 'sub-1', status: SUBSCRIPTION_STATUS.ACTIVE }],
      });
      mockPrisma.product.count.mockResolvedValueOnce(2);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.readiness).toEqual({
        botConnected: true,
        paynetConfigured: true,
        legalConfigured: true,
        hasActiveProduct: true,
        activeProductCount: 2,
        canPublish: true,
      });
      expect(body.subscription.id).toBe('sub-1');
    });

    it('PUT /api/v1/admin/settings enforces setWebhook success, valid Paynet QR + legal fields, and publish readiness', async () => {
      const tenantId = '66666666-6666-6666-6666-666666666602';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId,
        email: 'a@b.uz',
        role: 'OWNER',
      });

      // 1. Enabling Paynet without valid QR -> 400
      mockPrisma.botConfig.findUnique.mockResolvedValueOnce({
        tenant_id: tenantId,
        theme_config: {},
      });
      const badQrRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          themeConfig: { paynetEnabled: true, paynetQrUrl: 'https://evil.com/qr' },
        },
      });
      expect(badQrRes.statusCode).toBe(400);

      // 2. Enabling Paynet with valid QR but missing legalName / supportContact -> 400
      mockPrisma.botConfig.findUnique.mockResolvedValueOnce({
        tenant_id: tenantId,
        theme_config: {},
      });
      const missingLegalRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          themeConfig: { paynetEnabled: true, paynetQrUrl: MERCHANT_PAYNET_QR_URL },
        },
      });
      expect(missingLegalRes.statusCode).toBe(400);

      // 3. Changing botToken when Telegram setWebhook fails -> 502 and does NOT upsert botConfig
      mockPrisma.botConfig.findUnique.mockResolvedValueOnce({
        tenant_id: tenantId,
        theme_config: {},
      });
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/getMe')) {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { username: 'new_shop_bot' } }),
          } as any;
        }
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ ok: false, description: 'Bad Request: bad webhook' }),
        } as any;
      });
      const hookFailRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/settings',
        headers: { Authorization: `Bearer ${token}` },
        payload: { botToken: '999999:NEW_BOT_TOKEN' },
      });
      expect(hookFailRes.statusCode).toBe(502);
      expect(hookFailRes.json().error).toContain('webhook');
      expect(mockPrisma.botConfig.upsert).not.toHaveBeenCalled();
    });

    it('POST and PUT /api/v1/admin/products accept both is_active and isActive and normalize variants', async () => {
      const tenantAdminId = '66666666-6666-6666-6666-666666666666';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId: tenantAdminId,
        email: 'a@b.uz',
        role: 'OWNER',
      });

      mockTenantDb.product.create.mockResolvedValue({ id: 'p-new', is_active: false, variants: ['S', 'M', 'L'] });
      mockTenantDb.product.update.mockResolvedValue({ id: 'p-new', is_active: false, variants: ['40', '41'] });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          title: 'Silk Scarf',
          price: 120000,
          stock: 8,
          variants: 'S, M, L',
          is_active: false,
        },
      });
      expect(createRes.statusCode).toBe(201);
      expect(mockTenantDb.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false, variants: ['S', 'M', 'L'] }),
        })
      );

      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/p-new',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          is_active: false,
          variants: ['40', '41'],
        },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(mockTenantDb.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_active: false, variants: ['40', '41'] }),
        })
      );
    });

    it('PATCH /api/v1/admin/orders/:id enforces paymentId + duplicate 409 on PAID and restores stock once on CANCELLED/REFUNDED', async () => {
      const tenantAdminId = '77777777-7777-7777-7777-777777777777';
      await invalidateTenantBot(tenantAdminId);

      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId: tenantAdminId,
        email: 'merchant@uz.uz',
        role: 'OWNER',
      });

      const reviewOrder = {
        id: 'ord-pay-1',
        tenant_id: tenantAdminId,
        status: ORDER_STATUS.PAYMENT_REVIEW,
        customer_telegram_id: '99887766',
        status_history: [],
        items: [{ productId: 'prod-abc', quantity: 2 }],
      };

      // 1. PAID without paymentId -> 400
      mockTenantDb.order.findFirst.mockResolvedValueOnce(reviewOrder);
      const missingPayIdRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-pay-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: ORDER_STATUS.PAID },
      });
      expect(missingPayIdRes.statusCode).toBe(400);

      // 2. PAID with duplicate paymentId in same tenant -> 409
      mockTenantDb.order.findFirst.mockResolvedValueOnce(reviewOrder);
      mockPrisma.order.findFirst.mockResolvedValueOnce({ id: 'other-ord', payment_id: 'PN-111' });
      const dupPayIdRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-pay-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: ORDER_STATUS.PAID, paymentId: 'PN-111' },
      });
      expect(dupPayIdRes.statusCode).toBe(409);
      expect(dupPayIdRes.json().code).toBe('DUPLICATE_PAYMENT_ID');

      // 3. PAID with unique paymentId + receiptUrl -> 200, verified_at/by + customer receipt notification
      mockTenantDb.order.findFirst.mockResolvedValueOnce(reviewOrder);
      mockPrisma.order.findFirst.mockResolvedValueOnce(null);
      mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
        ...reviewOrder,
        status: ORDER_STATUS.PAID,
        payment_id: 'PN-222',
        receipt_url: 'https://ofd.soliq.uz/check?t=222',
        verified_by: 'merchant@uz.uz',
      });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantAdminId,
        name: 'Tashkent Shop',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'sec',
          is_active: true,
          currency: 'UZS',
          theme_config: {},
        },
      });
      const botData = await getOrInitBot(tenantAdminId);
      const sendMessageSpy = vi.spyOn(botData!.bot.api, 'sendMessage').mockResolvedValue({} as any);

      const okPaidRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-pay-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          status: ORDER_STATUS.PAID,
          paymentId: 'PN-222',
          receiptUrl: 'https://ofd.soliq.uz/check?t=222',
        },
      });
      expect(okPaidRes.statusCode).toBe(200);
      expect(okPaidRes.json().order.status).toBe(ORDER_STATUS.PAID);
      expect(okPaidRes.json().order.payment_id).toBe('PN-222');
      expect(sendMessageSpy).toHaveBeenCalledWith(
        '99887766',
        expect.stringContaining('https://ofd.soliq.uz/check?t=222'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );

      // 4. PAID -> REFUNDED restores stock once and notifies customer
      mockPrisma.__tx.$executeRaw.mockReset();
      sendMessageSpy.mockClear();
      const paidOrder = {
        ...reviewOrder,
        status: ORDER_STATUS.PAID,
        payment_id: 'PN-222',
      };
      mockTenantDb.order.findFirst.mockResolvedValueOnce(paidOrder);
      mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
        ...paidOrder,
        status: ORDER_STATUS.REFUNDED,
      });

      const refundRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-pay-1',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: ORDER_STATUS.REFUNDED, note: 'Customer requested return' },
      });
      expect(refundRes.statusCode).toBe(200);
      expect(refundRes.json().order.status).toBe(ORDER_STATUS.REFUNDED);
      expect(mockPrisma.__tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        '99887766',
        expect.stringContaining('#ord-pay-'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );

      // 5. REFUNDED -> CANCELLED must NOT double-restore stock!
      mockPrisma.__tx.$executeRaw.mockReset();
      mockTenantDb.order.findFirst.mockResolvedValueOnce({
        ...paidOrder,
        status: ORDER_STATUS.REFUNDED,
      });
      mockPrisma.__tx.order.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.__tx.order.findFirst.mockResolvedValueOnce({
        ...paidOrder,
        status: ORDER_STATUS.CANCELLED,
      });

      const doubleTransitionRes = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/orders/ord-pay-1/status',
        headers: { Authorization: `Bearer ${token}` },
        payload: { status: ORDER_STATUS.CANCELLED },
      });
      expect(doubleTransitionRes.statusCode).toBe(200);
      expect(mockPrisma.__tx.$executeRaw).not.toHaveBeenCalled();
    });

    it('GET /api/v1/admin/orders/export streams UTF-8 BOM CSV with formula-injection escaping', async () => {
      const tenantAdminId = '77777777-7777-7777-7777-777777777702';
      const token = (app as any).jwt.sign({
        userId: 'u1',
        tenantId: tenantAdminId,
        email: 'merchant@uz.uz',
        role: 'OWNER',
      });

      mockTenantDb.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-csv-1',
          createdAt: new Date('2026-11-18T10:00:00Z'),
          status: ORDER_STATUS.PAID,
          customer_name: '=CMD|calc',
          customer_phone: '+998901234567',
          customer_telegram_id: '112233',
          delivery_method: 'COURIER',
          shipping_address: 'Tashkent',
          payment_method: 'PAYNET_XOLIS',
          payment_id: 'PN-999',
          receipt_url: '',
          delivery_fee: 25000,
          total_amount: 445000,
          items: [{ title: 'Hoodie', variant: 'L', quantity: 1 }],
        },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/export',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.body.startsWith('\uFEFF')).toBe(true);
      expect(res.body).toContain('"\'=CMD|calc"');
      expect(res.body).toContain('Hoodie (L) × 1');
    });
  });

  describe('BotManager botInfo Initialization, Paused Webhooks & Production Demo Safety', () => {
    it('ensureBotInitialized initializes botInfo safely via getMe or fallback so handleUpdate never throws Bot info not initialized', async () => {
      const tenantId = '88888888-1111-2222-3333-444444444401';
      await invalidateTenantBot(tenantId);

      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        name: 'Fallback Bot Store',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('654321:FAKE_TOKEN'),
          bot_username: 'fallback_shop_bot',
          webhook_secret: 'sec-hook',
          is_active: true,
          currency: 'UZS',
          theme_config: {},
        },
      });

      // Simulate getMe failing with 401 -> fallback botInfo still prevents "Bot info not initialized"
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }),
      } as any);

      const botData = await getOrInitBot(tenantId);
      expect(botData).not.toBeNull();
      expect(botData!.bot.isInited()).toBe(true);
      expect(botData!.bot.botInfo.username).toBe('fallback_shop_bot');

      // Also test ensureBotInitialized caching when getMe succeeds
      const freshBot: any = {
        isInited: vi.fn(() => false),
        init: vi.fn(async () => {
          freshBot.botInfo = { id: 99, is_bot: true, first_name: 'OK', username: 'ok_bot' };
          freshBot.isInited = () => true;
        }),
      };
      await ensureBotInitialized(freshBot, '998877:REAL_OK_TOKEN', 'ok_bot', 'OK Store');
      expect(freshBot.init).toHaveBeenCalledTimes(1);
    });

    it('POST /api/v1/webhooks/telegram/:tenant_id responds politely and returns 200 when store is paused/unpublished', async () => {
      const pausedTenantId = '88888888-1111-2222-3333-444444444402';
      await invalidateTenantBot(pausedTenantId);

      mockPrisma.tenant.findUnique.mockResolvedValueOnce({
        id: pausedTenantId,
        name: 'Paused Shop',
        plan: 'PRO_30',
        owner_telegram_id: '111222',
        subscription_status: SUBSCRIPTION_STATUS.PENDING_REVIEW,
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:PAUSED_TOKEN'),
          bot_username: 'paused_shop_bot',
          webhook_secret: 'paused-secret',
          is_active: false,
          currency: 'UZS',
          theme_config: { supportContact: '@paused_support' },
        },
      });

      const sendMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      });
      global.fetch = sendMock;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/webhooks/telegram/${pausedTenantId}`,
        headers: { 'x-telegram-bot-api-secret-token': 'paused-secret' },
        payload: {
          update_id: 500,
          message: {
            message_id: 1,
            date: 1700000000,
            chat: { id: 777888, type: 'private' },
            from: { id: 777888, is_bot: false, first_name: 'Buyer' },
            text: '/start',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
      expect(res.json().reason).toContain('paused');

      // Should have sent polite pause message containing supportContact
      const sendMsgCall = sendMock.mock.calls.find((c) => String(c[0]).includes('/sendMessage'));
      expect(sendMsgCall).toBeTruthy();
      const body = JSON.parse(sendMsgCall![1].body);
      expect(body.chat_id).toBe(777888);
      expect(body.text).toContain('приостановлен');
      expect(body.text).toContain('@paused_support');
    });

    it('ensureDatabaseSeeded scrubs platform QR from demo store and scrambles demo password in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEMO_LOGIN;

      mockPrisma.tenant.upsert.mockResolvedValueOnce({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'MODA Tashkent • Concept Store',
      });
      mockPrisma.botConfig.findUnique.mockResolvedValueOnce({
        tenant_id: '00000000-0000-0000-0000-000000000001',
        is_active: true,
        theme_config: {
          paynetEnabled: true,
          paynetQrUrl: PLATFORM_PAYNET_QR_URL,
        },
      });
      mockPrisma.botConfig.update.mockResolvedValueOnce({});
      mockPrisma.adminUser.findFirst.mockResolvedValueOnce({
        id: 'demo-admin-id',
        email: 'demo_merchant@telegram-commerce.local',
      });
      mockPrisma.adminUser.update.mockResolvedValueOnce({});
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'p1', title: 'Regular Shirt' }]);

      await ensureDatabaseSeeded();

      // Scrubbed legacy platform Paynet QR & forced paynetEnabled: false + isDemo: true
      expect(mockPrisma.botConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            theme_config: expect.objectContaining({
              paynetEnabled: false,
              paynetQrUrl: '',
              isDemo: true,
            }),
          }),
        })
      );

      // Replaced predictable demo password with random unguessable hash (cannot log in with password123)
      expect(mockPrisma.adminUser.update).toHaveBeenCalledTimes(1);
      const updatedHash = mockPrisma.adminUser.update.mock.calls[0][0].data.password_hash;
      expect(await bcrypt.compare('password123', updatedHash)).toBe(false);
    });
  });

  describe('Reservation Sweeper (sweepExpiredPendingOrders)', () => {
    it('cancels stale PENDING orders, restores stock when updateMany count=1, and notifies customer', async () => {
      const tenantSweepId = '88888888-8888-8888-8888-888888888888';
      await invalidateTenantBot(tenantSweepId);

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
        subscription_status: 'ACTIVE',
        is_active: true,
        botConfig: {
          bot_token_encrypted: encryptBotToken('123456:FAKE_TOKEN'),
          webhook_secret: 'sec',
          is_active: true,
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
