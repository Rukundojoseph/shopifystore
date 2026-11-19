import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildSiteConfig, TEMPLATE_MAP } from "../templates";
import { slugify } from "../lib/slug";

const db = new PrismaClient();

const PLANS = [
  { key: "starter", name: "Starter", description: "For businesses testing online selling", priceMonthly: 0, maxProducts: 15, maxStaff: 0, allowCustomDomain: false, allowMomo: false, allTemplates: false, position: 0,
    features: ["One online store", "3 starter templates", "Up to 15 products", "yourstore.storehub.rw address", "Pay-on-delivery orders", "Basic order management"] },
  { key: "business", name: "Business", description: "For established small businesses", priceMonthly: 15000, maxProducts: 500, maxStaff: 2, allowCustomDomain: true, allowMomo: true, allTemplates: true, position: 1,
    features: ["Up to 500 products", "All templates", "Full website editor", "MTN MoMo checkout", "Inventory management", "Sales analytics", "Custom domain"] },
  { key: "professional", name: "Professional", description: "For growing businesses", priceMonthly: 45000, maxProducts: null, maxStaff: 10, allowCustomDomain: true, allowMomo: true, allTemplates: true, position: 2,
    features: ["Unlimited products", "Everything in Business", "Multiple staff accounts", "Advanced customisation", "Priority support"] },
];

async function main() {
  for (const p of PLANS) await db.subscriptionPlan.upsert({ where: { key: p.key }, create: p, update: {} });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@storehub.rw";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminPassword) {
    await db.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: "Platform Admin", role: "PLATFORM_ADMIN", passwordHash: await bcrypt.hash(adminPassword, 12), emailVerifiedAt: new Date() },
      update: { role: "PLATFORM_ADMIN" },
    });
    console.log(`Admin: ${adminEmail}`);
  } else {
    console.log("SEED_ADMIN_PASSWORD not set — skipping admin user");
  }

  if (process.env.NODE_ENV === "production") return;

  // Demo store: Kigali Fashion
  const owner = await db.user.upsert({
    where: { email: "demo@storehub.rw" },
    create: { email: "demo@storehub.rw", name: "Aline Uwase", passwordHash: await bcrypt.hash("Demo12345!", 12), emailVerifiedAt: new Date() },
    update: {},
  });
  if (await db.store.findUnique({ where: { slug: "kigalifashion" } })) return console.log("Demo store exists");

  const t = TEMPLATE_MAP.fashion;
  const config = buildSiteConfig("fashion", "Kigali Fashion", "Contemporary fashion made in Kigali.");
  const business = await db.subscriptionPlan.findUniqueOrThrow({ where: { key: "business" } });
  const store = await db.store.create({
    data: {
      ownerId: owner.id, businessName: "Kigali Fashion Ltd", name: "Kigali Fashion", slug: "kigalifashion", category: "fashion",
      description: "Contemporary fashion made in Kigali.", phone: "+250788123456", email: "hello@kigalifashion.rw", location: "KN 4 Ave, Nyarugenge, Kigali",
      templateKey: "fashion", draftConfig: config, publishedConfig: config, publishedAt: new Date(), status: "PUBLISHED",
      members: { create: { userId: owner.id, role: "OWNER" } },
      settings: { create: { deliveryFee: 2000, freeDeliveryOver: 50000, acceptMomo: true, acceptCashOnDelivery: true } },
      domains: { create: { domain: "kigalifashion.localhost", type: "SUBDOMAIN", verifiedAt: new Date(), isPrimary: true } },
      subscriptions: { create: { planId: business.id, status: "ACTIVE" } },
    },
  });

  const cats = new Map<string, string>();
  for (const [i, c] of t.demoCategories.entries()) {
    const cat = await db.category.create({ data: { storeId: store.id, name: c.name, slug: slugify(c.name), imageUrl: c.image, position: i } });
    cats.set(c.name, cat.id);
  }
  for (const [i, p] of t.demoProducts.entries()) {
    const withVariants = i === 1 || i === 7;
    await db.product.create({
      data: {
        storeId: store.id, name: p.name, slug: slugify(p.name), price: p.price, compareAtPrice: p.compareAtPrice ?? null,
        description: `${p.name} from Kigali Fashion.\n\nCarefully selected quality. Delivery across Rwanda.`,
        images: [p.image], status: "ACTIVE", featured: i < 4, categoryId: cats.get(p.category), stockQuantity: 20,
        options: withVariants ? [{ name: "Size", values: ["S", "M", "L", "XL"] }] : undefined,
        variants: withVariants ? { create: ["S", "M", "L", "XL"].map((s, j) => ({ storeId: store.id, title: s, optionValues: { Size: s }, stockQuantity: j === 3 ? 0 : 8, position: j })) } : undefined,
      },
    });
  }
  console.log("Demo store: kigalifashion (demo@storehub.rw / Demo12345!)");
}

main().finally(() => db.$disconnect());
