import { prisma } from '@telegram-commerce/database';
import bcrypt from 'bcryptjs';
import { encryptBotToken, generateWebhookSecret, PLAN_TIERS } from '@telegram-commerce/config';

async function main() {
  console.log('🌱 Seeding database...');

  const demoTenantId = process.env.STANDALONE_TENANT_ID || '00000000-0000-0000-0000-000000000001';
  const ownerTelegramId = process.env.STANDALONE_ADMIN_TELEGRAM_ID || '8240936731';
  const botToken = process.env.MASTER_BOT_TOKEN || '8524216143:AAE1XYNOpSrGicGW2VmC4u883_bzIN1JzT0';
  const passwordHash = await bcrypt.hash('password123', 10);
  const webhookSecret = generateWebhookSecret();
  const encryptedToken = encryptBotToken(botToken);

  const storeName = 'MODA Tashkent • Concept Store';
  const storeDesc = 'Премиальная одежда и аксессуары из 100% узбекского хлопка и натуральной кожи с доставкой по Ташкенту и Узбекистану.';

  const tenant = await prisma.tenant.upsert({
    where: { id: demoTenantId },
    create: {
      id: demoTenantId,
      name: storeName,
      owner_telegram_id: ownerTelegramId,
      plan: PLAN_TIERS.PRO_30,
      is_active: true,
      botConfig: {
        create: {
          bot_token_encrypted: encryptedToken,
          bot_username: 'miraiedu_bot',
          webhook_secret: webhookSecret,
          currency: 'UZS',
          theme_config: {
            storeName,
            primaryColor: '#1a6fd4',
            accentColor: '#38bdf8',
            backgroundColor: '#ffffff',
            textColor: '#18181b',
            bannerUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
            logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
            description: storeDesc,
          },
        },
      },
      adminUsers: {
        create: {
          email: 'demo_merchant@telegram-commerce.local',
          password_hash: passwordHash,
          role: 'OWNER',
        },
      },
    },
    update: {
      is_active: true,
      owner_telegram_id: ownerTelegramId,
      name: storeName,
    },
  });

  const productsData = [
    {
      title: 'Оверсайз худи Tashkent Edition',
      description: 'Плотный премиальный футер 420г/м² из 100% узбекского длинноволокнистого хлопка пенье. Мягкий начес, глубокий капюшон, минималистичная вышивка на груди.',
      price: 420000,
      stock: 35,
      category: 'Apparel',
      images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Базовая футболка Heavyweight Cotton',
      description: 'Плотный узбекский хлопок 240г/м². Спущенная линия плеча, усиленный воротник, не садится и не деформируется после многочисленных стирок.',
      price: 190000,
      stock: 60,
      category: 'Apparel',
      images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Брюки карго Urban Tech с карманами',
      description: 'Износостойкий хлопковый рипстоп с грязе- и водоотталкивающей пропиткой. Эластичный пояс на шнурке, 6 функциональных карманов.',
      price: 380000,
      stock: 25,
      category: 'Apparel',
      images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кожаные кроссовки Classic Street Low',
      description: 'Натуральная матовая телячья кожа, мягкая анатомическая стелька, вулканизированная нескользящая подошва. Универсальная городская классика.',
      price: 650000,
      stock: 18,
      category: 'Footwear',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кепка-бейсболка вышитая "Toshkent"',
      description: '100% саржевый премиальный хлопок. Латунная пряжка с гравировкой для регулировки размера, вентиляционные люверсы, плотный козырек.',
      price: 140000,
      stock: 40,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Кожаный картхолдер ручной работы',
      description: 'Ручной седельный шов, натуральная вощеная кожа растительного дубления. 6 отделений для банковских карт и центральный карман для купюр.',
      price: 160000,
      stock: 30,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Поясная сумка-кроссбоди Cordura 1000D',
      description: 'Сверхпрочный водонепроницаемый нейлон Cordura 1000D, японские молнии YKK, регулируемый ремень. Вмещает телефон, ключи и документы.',
      price: 240000,
      stock: 22,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Утепленный бомбер Minimalist Black',
      description: 'Ветрозащитная матовая мембранная ткань, дышащий утеплитель холлофайбер, плотные эластичные манжеты, внутренний потайной карман.',
      price: 790000,
      stock: 15,
      category: 'Apparel',
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
