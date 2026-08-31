import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptBotToken, generateWebhookSecret, PLAN_TIERS } from '@telegram-commerce/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Telegram E-Commerce database...');

  const demoTenantId = '00000000-0000-0000-0000-000000000001';
  const ownerTelegramId = '987654321';
  const passwordHash = await bcrypt.hash('password123', 10);
  const webhookSecret = generateWebhookSecret();
  const encryptedDummyToken = encryptBotToken('123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ');

  // Upsert Demo Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: demoTenantId },
    create: {
      id: demoTenantId,
      name: 'Cyberpunk Apparel & Gear',
      owner_telegram_id: ownerTelegramId,
      plan: PLAN_TIERS.PRO_30,
      is_active: true,
      botConfig: {
        create: {
          bot_token_encrypted: encryptedDummyToken,
          bot_username: 'cyberpunk_store_bot',
          webhook_secret: webhookSecret,
          currency: 'USD',
          theme_config: {
            storeName: 'Cyberpunk Apparel & Gear',
            primaryColor: '#0ea5e9',
            accentColor: '#38bdf8',
            backgroundColor: '#0f172a',
            textColor: '#f8fafc',
            bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
            description: 'Futuristic streetwear, cybernetic accessories, and urban techwear with instant Telegram delivery.',
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
      name: 'Cyberpunk Apparel & Gear',
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // Seed Products
  const productsData = [
    {
      title: 'Neon Horizon Cyber Hoodie',
      description: 'Waterproof techwear hoodie with reflective cyan circuit patterns and insulated ergonomic hood.',
      price: 89.99,
      stock: 35,
      category: 'Apparel',
      images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Vortex Runner Pulse Sneakers',
      description: 'Ultra-lightweight knit runners with carbon fiber shank and reactive kinetic cushioning.',
      price: 139.50,
      stock: 20,
      category: 'Footwear',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Matrix Neural Smart Sunglasses',
      description: 'Polarized UV400 lenses with integrated micro-HUD display and Bluetooth bone-conduction audio.',
      price: 199.00,
      stock: 12,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Tactical Modular Crossbody Bag',
      description: 'MOLLE-compatible ripstop nylon bag with Fidlock magnetic buckle and waterproof YKK zippers.',
      price: 54.00,
      stock: 45,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Titanium Mech Mechanical Keyboard',
      description: 'Compact 75% hot-swappable mechanical keyboard with lubricated linear switches and RGB underglow.',
      price: 165.00,
      stock: 8,
      category: 'Electronics',
      images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Quantum ANC Wireless Earbuds',
      description: 'Active noise cancelling with 40-hour battery life, low-latency gaming mode, and wireless charging.',
      price: 119.00,
      stock: 25,
      category: 'Electronics',
      images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Stealth Cargo Tech Pants',
      description: 'Stretch ripstop fabric with 8 concealed utility pockets, ankle cinch straps, and DWR coating.',
      price: 78.00,
      stock: 30,
      category: 'Apparel',
      images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80'],
    },
    {
      title: 'Cybernetic Glow LED Wristband',
      description: 'Programmable RGB wristband synced via Telegram app with customizable pulse animations.',
      price: 24.99,
      stock: 100,
      category: 'Accessories',
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'],
    },
  ];

  // Delete existing products for demo tenant to prevent duplicate accumulation
  await prisma.product.deleteMany({ where: { tenant_id: demoTenantId } });

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
  console.log(`✅ Seeded ${productsData.length} catalog products`);

  // Seed sample orders
  await prisma.order.deleteMany({ where: { tenant_id: demoTenantId } });

  await prisma.order.create({
    data: {
      tenant_id: demoTenantId,
      customer_telegram_id: '1122334455',
      customer_name: 'Sarah Connor',
      customer_phone: '+1 555-0199',
      shipping_address: '42 Skyway Blvd, Neo-Tokyo',
      total_amount: 229.49 as any,
      status: 'PAID',
      payment_method: 'STRIPE',
      items: [
        { title: 'Neon Horizon Cyber Hoodie', price: 89.99, quantity: 1 },
        { title: 'Vortex Runner Pulse Sneakers', price: 139.50, quantity: 1 },
      ],
    },
  });

  await prisma.order.create({
    data: {
      tenant_id: demoTenantId,
      customer_telegram_id: '9988776655',
      customer_name: 'David Martinez',
      customer_phone: '+1 555-0842',
      shipping_address: 'Apartment 7B, Night City',
      total_amount: 199.00 as any,
      status: 'DELIVERED',
      payment_method: 'TELEGRAM_STARS',
      items: [
        { title: 'Matrix Neural Smart Sunglasses', price: 199.00, quantity: 1 },
      ],
    },
  });

  console.log('✅ Seeded demo orders');
  console.log('\n🎉 Seeding complete! Login to Admin Backoffice with:');
  console.log('   Email: demo_merchant@telegram-commerce.local');
  console.log('   Password: password123\n');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
