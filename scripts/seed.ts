import crypto from 'node:crypto';
import { prisma } from '@telegram-commerce/database';
import bcrypt from 'bcryptjs';
import {
  encryptBotToken,
  generateWebhookSecret,
  PLAN_TIERS,
  DEFAULT_THEME_CONFIG,
} from '@telegram-commerce/config';

async function main() {
  console.log('🌱 Seeding database...');

  const demoTenantId = process.env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';
  const ownerTelegramId = process.env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
  const isStandalone = process.env.MODE === 'standalone';
  const allowDemoLogin = process.env.ALLOW_DEMO_LOGIN === 'true' || process.env.NODE_ENV !== 'production';
  const botToken =
    process.env.STANDALONE_BOT_TOKEN ||
    process.env.MASTER_BOT_TOKEN ||
    'PLACEHOLDER_BOT_TOKEN';
  const webhookSecret = process.env.WEBHOOK_SECRET || generateWebhookSecret();
  const encryptedToken = encryptBotToken(botToken);

  const storeName = isStandalone
    ? process.env.STORE_NAME || 'Telegram Storefront'
    : 'MODA Tashkent • Concept Store';
  const storeDesc =
    'Премиальная одежда и аксессуары из 100% узбекского хлопка и натуральной кожи с доставкой по Ташкенту и Узбекистану.';

  const themeConfig = {
    ...DEFAULT_THEME_CONFIG,
    storeName,
    primaryColor: '#1a6fd4',
    accentColor: '#38bdf8',
    backgroundColor: '#ffffff',
    textColor: '#18181b',
    bannerUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
    description: storeDesc,
    currency: 'UZS',
    currencySymbol: "so'm",
    paynetEnabled: false,
    paynetQrUrl: '',
    isDemo: !isStandalone,
    legalName: isStandalone ? '' : 'DEMO STORE (Тестовая витрина — оплата отключена)',
    supportContact: isStandalone ? '' : '@miraiedu_bot',
  };

  await prisma.tenant.upsert({
    where: { id: demoTenantId },
    create: {
      id: demoTenantId,
      name: storeName,
      owner_telegram_id: ownerTelegramId,
      plan: isStandalone ? PLAN_TIERS.STANDALONE_LIFETIME : PLAN_TIERS.PRO_30,
      subscription_status: 'ACTIVE',
      is_active: true,
      botConfig: {
        create: {
          bot_token_encrypted: encryptedToken,
          bot_username: isStandalone ? null : 'miraiedu_bot',
          webhook_secret: webhookSecret,
          is_active: true,
          currency: 'UZS',
          theme_config: themeConfig,
        },
      },
    },
    update: {
      is_active: true,
      subscription_status: 'ACTIVE',
      owner_telegram_id: ownerTelegramId,
      name: storeName,
    },
  });

  if (isStandalone && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const existing = await prisma.adminUser.findFirst({
      where: { tenant_id: demoTenantId, email },
    });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          tenant_id: demoTenantId,
          email,
          password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
          role: 'OWNER',
        },
      });
    }
  } else if (allowDemoLogin) {
    const demoEmail = 'demo_merchant@telegram-commerce.local';
    const existing = await prisma.adminUser.findFirst({
      where: { tenant_id: demoTenantId, email: demoEmail },
    });
    if (!existing) {
      await prisma.adminUser.create({
        data: {
          tenant_id: demoTenantId,
          email: demoEmail,
          password_hash: await bcrypt.hash('password123', 10),
          role: 'OWNER',
        },
      });
    }
  } else {
    const demoEmail = 'demo_merchant@telegram-commerce.local';
    const existing = await prisma.adminUser.findFirst({
      where: { tenant_id: demoTenantId, email: demoEmail },
    });
    if (existing) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { password_hash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10) },
      });
    }
  }

  const productsData = [
    {
      title: 'Оверсайз худи Tashkent Edition',
      description: 'Плотный премиальный футер 420г/м² из 100% узбекского длинноволокнистого хлопка пенье. Мягкий начес, глубокий капюшон, минималистичная вышивка на груди.',
      price: 420000,
      stock: 35,
      category: 'Apparel',
      variants: ['S', 'M', 'L', 'XL'],
      images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Базовая футболка Heavyweight Cotton',
      description: 'Плотный узбекский хлопок 240г/м². Спущенная линия плеча, усиленный воротник, не садится и не деформируется после многочисленных стирок.',
      price: 190000,
      stock: 60,
      category: 'Apparel',
      variants: ['S', 'M', 'L', 'XL'],
      images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Брюки карго Urban Tech с карманами',
      description: 'Износостойкий хлопковый рипстоп с грязе- и водоотталкивающей пропиткой. Эластичный пояс на шнурке, 6 функциональных карманов.',
      price: 380000,
      stock: 25,
      category: 'Apparel',
      variants: ['M', 'L', 'XL'],
      images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кожаные кроссовки Classic Street Low',
      description: 'Натуральная матовая телячья кожа, мягкая анатомическая стелька, вулканизированная нескользящая подошва. Универсальная городская классика.',
      price: 650000,
      stock: 18,
      category: 'Footwear',
      variants: ['40', '41', '42', '43', '44'],
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кепка-бейсболка вышитая "Toshkent"',
      description: '100% саржевый премиальный хлопок. Латунная пряжка с гравировкой для регулировки размера, вентиляционные люверсы, плотный козырек.',
      price: 140000,
      stock: 40,
      category: 'Accessories',
      variants: [],
      images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кожаный картхолдер ручной работы',
      description: 'Ручной седельный шов, натуральная вощеная кожа растительного дубления. 6 отделений для банковских карт и центральный карман для купюр.',
      price: 160000,
      stock: 30,
      category: 'Accessories',
      variants: [],
      images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Поясная сумка-кроссбоди Cordura 1000D',
      description: 'Сверхпрочный водонепроницаемый нейлон Cordura 1000D, японские молнии YKK, регулируемый ремень. Вмещает телефон, ключи и документы.',
      price: 240000,
      stock: 22,
      category: 'Accessories',
      variants: [],
      images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Утепленный бомбер Minimalist Black',
      description: 'Ветрозащитная матовая мембранная ткань, дышащий утеплитель холлофайбер, плотные эластичные манжеты, внутренний потайной карман.',
      price: 790000,
      stock: 15,
      category: 'Apparel',
      variants: ['M', 'L', 'XL'],
      images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80'],
    },
  ];

  await prisma.product.deleteMany({
    where: { tenant_id: demoTenantId },
  });

  for (const p of productsData) {
    await prisma.product.create({
      data: {
        tenant_id: demoTenantId,
        title: p.title,
        description: p.description,
        price: p.price as any,
        stock: p.stock,
        category: p.category,
        variants: p.variants as any,
        images: p.images,
        is_active: true,
      },
    });
  }

  console.log(`✅ Seeded ${productsData.length} Tashkent catalog products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
