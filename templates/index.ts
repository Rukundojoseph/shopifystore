import type { Section, SiteConfig, Theme } from "@/lib/editor/schema";
import { createSection } from "@/lib/editor/sections";

// Templates are configuration, not separate websites: each one is a starting
// SiteConfig rendered by the single shared storefront renderer.

const u = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

export type DemoProduct = { name: string; price: number; compareAtPrice?: number; image: string; category: string };

export type TemplateDef = {
  key: string;
  name: string;
  category: string;
  description: string;
  highlights: string[];
  theme: Theme;
  heroImage: string;
  demoCategories: { name: string; image: string }[];
  demoProducts: DemoProduct[];
  build: (storeName: string) => Pick<SiteConfig, "header" | "footer" | "pages">;
};

function standardPages(home: Section[], storeName: string, aboutImage: string): SiteConfig["pages"] {
  return [
    { id: "home", name: "Home", slug: "/", sections: home },
    {
      id: "about",
      name: "About",
      slug: "/about",
      sections: [
        createSection("text", { heading: `About ${storeName}`, body: "We are a Rwandan business committed to quality products and friendly service. Tell your story here: how you started, what you sell and why customers love you." }),
        createSection("image", { image: aboutImage, alt: `${storeName} shop`, fullWidth: false }),
        createSection("features"),
      ],
    },
    {
      id: "contact",
      name: "Contact",
      slug: "/contact",
      sections: [createSection("contact")],
    },
  ];
}

function header(storeName: string, style = "light") {
  return createSection("header", { logoText: storeName, style });
}
function footer(storeName: string, bg = "#111111", fg = "#e4e4e7") {
  return createSection("footer", { text: `${storeName} — proudly Rwandan. Delivery across Kigali and beyond.`, backgroundColor: bg, textColor: fg });
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: "fashion",
    name: "Atelier",
    category: "Fashion & clothing",
    description: "Editorial look with a full-bleed hero and image-led product grid. Made for clothing, shoes and accessories.",
    highlights: ["Full-screen hero", "Portrait product images", "Lookbook gallery"],
    theme: { primaryColor: "#111111", secondaryColor: "#f5f0eb", backgroundColor: "#ffffff", textColor: "#18181b", font: "Inter", headingFont: "Playfair Display", radius: "none" },
    heroImage: u("photo-1483985988355-763728e1935b"),
    demoCategories: [
      { name: "Women", image: u("photo-1515886657613-9f3515b0c78f", 800) },
      { name: "Men", image: u("photo-1521572163474-6864f9cf17ab", 800) },
      { name: "Shoes", image: u("photo-1542291026-7eec264c27ff", 800) },
      { name: "Accessories", image: u("photo-1523275335684-37898b6baf30", 800) },
    ],
    demoProducts: [
      { name: "Linen summer dress", price: 32000, compareAtPrice: 40000, image: u("photo-1515886657613-9f3515b0c78f", 800), category: "Women" },
      { name: "Classic white tee", price: 9500, image: u("photo-1521572163474-6864f9cf17ab", 800), category: "Men" },
      { name: "Red runner sneakers", price: 45000, image: u("photo-1542291026-7eec264c27ff", 800), category: "Shoes" },
      { name: "Minimal wrist watch", price: 38000, image: u("photo-1523275335684-37898b6baf30", 800), category: "Accessories" },
      { name: "Weekend wardrobe set", price: 55000, image: u("photo-1434389677669-e08b4cac3105", 800), category: "Women" },
      { name: "Kitenge print shirt", price: 18000, image: u("photo-1512436991641-6745cdb1723f", 800), category: "Men" },
      { name: "Street style jacket", price: 42000, image: u("photo-1529139574466-a303027c1d8b", 800), category: "Women" },
      { name: "Everyday hoodie", price: 22000, image: u("photo-1556905055-8f358a7a47b2", 800), category: "Men" },
    ],
    build: (name) => ({
      header: header(name),
      footer: footer(name),
      pages: standardPages(
        [
          createSection("announcement", { text: "New season collection — free delivery in Kigali over 50,000 RWF" }),
          createSection("hero", { heading: "The new season edit", subheading: "Timeless pieces, made to be worn every day.", backgroundImage: u("photo-1483985988355-763728e1935b"), height: "full", overlay: 30 }),
          createSection("categories", { heading: "Shop the collection", columns: "4" }),
          createSection("product-grid", { heading: "New arrivals", imageRatio: "portrait", columns: "4", limit: 8 }),
          createSection("promo-banner", { heading: "End of season sale", text: "Up to 30% off selected styles.", image: u("photo-1441986300917-64674bd600d8", 1200), backgroundColor: "#f5f0eb" }),
          createSection("testimonials"),
          createSection("newsletter", { backgroundColor: "#f5f0eb" }),
        ],
        name,
        u("photo-1441986300917-64674bd600d8", 1400),
      ),
    }),
  },
  {
    key: "electronics",
    name: "Circuit",
    category: "Electronics",
    description: "Category-first layout for phones, laptops and accessories, with selling points up front.",
    highlights: ["Category navigation first", "Dense product grid", "Warranty & delivery badges"],
    theme: { primaryColor: "#2563eb", secondaryColor: "#eff6ff", backgroundColor: "#f8fafc", textColor: "#0f172a", font: "Inter", headingFont: "Space Grotesk", radius: "md" },
    heroImage: u("photo-1498049794561-7780e7231661"),
    demoCategories: [
      { name: "Phones", image: u("photo-1511707171634-5f897ff02aa9", 800) },
      { name: "Laptops", image: u("photo-1496181133206-80ce9b88a853", 800) },
      { name: "Audio", image: u("photo-1505740420928-5e560c06d30e", 800) },
      { name: "Accessories", image: u("photo-1583394838336-acd977736f90", 800) },
    ],
    demoProducts: [
      { name: "Smartphone 128GB", price: 320000, compareAtPrice: 350000, image: u("photo-1511707171634-5f897ff02aa9", 800), category: "Phones" },
      { name: "Ultrabook 14\"", price: 890000, image: u("photo-1496181133206-80ce9b88a853", 800), category: "Laptops" },
      { name: "Wireless headphones", price: 85000, image: u("photo-1505740420928-5e560c06d30e", 800), category: "Audio" },
      { name: "Earbuds Pro", price: 65000, image: u("photo-1583394838336-acd977736f90", 800), category: "Audio" },
      { name: "Smart watch", price: 120000, image: u("photo-1523275335684-37898b6baf30", 800), category: "Accessories" },
      { name: "Desk setup bundle", price: 240000, image: u("photo-1498049794561-7780e7231661", 800), category: "Laptops" },
      { name: "Portable speaker", price: 45000, image: u("photo-1608043152269-423dbba4e7e1", 800), category: "Audio" },
      { name: "USB-C hub", price: 25000, image: u("photo-1583394838336-acd977736f90", 800), category: "Accessories" },
    ],
    build: (name) => ({
      header: header(name, "dark"),
      footer: footer(name, "#0f172a", "#cbd5e1"),
      pages: standardPages(
        [
          createSection("hero", { heading: "Tech that keeps Rwanda connected", subheading: "Genuine phones, laptops and accessories with warranty.", backgroundImage: u("photo-1498049794561-7780e7231661"), layout: "split", align: "left", height: "md", textColor: "#0f172a", backgroundColor: "#eff6ff", overlay: 0 }),
          createSection("categories", { heading: "Shop by category", style: "tiles", columns: "4" }),
          createSection("features", { items: [{ title: "Genuine products", text: "12-month warranty" }, { title: "Pay with MoMo", text: "Fast, secure checkout" }, { title: "Kigali delivery", text: "Within 24 hours" }] }),
          createSection("product-grid", { heading: "Best sellers", columns: "4", limit: 8 }),
          createSection("promo-banner", { heading: "Trade in your old phone", text: "Visit our shop for an instant valuation.", buttonText: "Contact us", buttonLink: "/contact", backgroundColor: "#2563eb", textColor: "#ffffff" }),
          createSection("newsletter"),
        ],
        name,
        u("photo-1498049794561-7780e7231661", 1400),
      ),
    }),
  },
  {
    key: "beauty",
    name: "Glow",
    category: "Beauty & cosmetics",
    description: "Soft palette and rounded shapes for skincare, make-up and beauty products.",
    highlights: ["Soft pastel theme", "Testimonials up front", "Rounded product cards"],
    theme: { primaryColor: "#be185d", secondaryColor: "#fdf2f8", backgroundColor: "#fffafb", textColor: "#3f1d2b", font: "DM Sans", headingFont: "Cormorant Garamond", radius: "lg" },
    heroImage: u("photo-1596462502278-27bfdc403348"),
    demoCategories: [
      { name: "Skincare", image: u("photo-1556228578-8c89e6adf883", 800) },
      { name: "Make-up", image: u("photo-1596462502278-27bfdc403348", 800) },
      { name: "Hair", image: u("photo-1522335789203-aabd1fc54bc9", 800) },
      { name: "Fragrance", image: u("photo-1571781926291-c477ebfd024b", 800) },
    ],
    demoProducts: [
      { name: "Hydrating face serum", price: 18000, image: u("photo-1620916566398-39f1143ab7be", 800), category: "Skincare" },
      { name: "Daily moisturiser", price: 14500, image: u("photo-1556228578-8c89e6adf883", 800), category: "Skincare" },
      { name: "Lip & cheek palette", price: 21000, compareAtPrice: 26000, image: u("photo-1596462502278-27bfdc403348", 800), category: "Make-up" },
      { name: "Shea body butter", price: 9000, image: u("photo-1571781926291-c477ebfd024b", 800), category: "Skincare" },
      { name: "Natural hair oil", price: 12000, image: u("photo-1522335789203-aabd1fc54bc9", 800), category: "Hair" },
      { name: "Signature perfume", price: 48000, image: u("photo-1571781926291-c477ebfd024b", 800), category: "Fragrance" },
    ],
    build: (name) => ({
      header: header(name),
      footer: footer(name, "#3f1d2b", "#fce7f3"),
      pages: standardPages(
        [
          createSection("hero", { heading: "Beauty, naturally", subheading: "Skincare and cosmetics loved across Rwanda.", backgroundImage: u("photo-1596462502278-27bfdc403348"), height: "lg", overlay: 25 }),
          createSection("product-grid", { heading: "Customer favourites", columns: "3", limit: 6, imageRatio: "portrait" }),
          createSection("categories", { heading: "Shop by need", style: "pills" }),
          createSection("testimonials", { backgroundColor: "#fdf2f8" }),
          createSection("text", { heading: "Clean ingredients, real results", body: "Every product we stock is selected for quality and suitability for our climate." }),
          createSection("newsletter", { heading: "Join the glow club", backgroundColor: "#fdf2f8" }),
        ],
        name,
        u("photo-1522335789203-aabd1fc54bc9", 1400),
      ),
    }),
  },
  {
    key: "grocery",
    name: "Isoko",
    category: "Grocery & supermarket",
    description: "Practical, high-density layout for supermarkets and grocers with quick category access.",
    highlights: ["Category buttons", "Delivery promise strip", "Many products per row"],
    theme: { primaryColor: "#15803d", secondaryColor: "#f0fdf4", backgroundColor: "#ffffff", textColor: "#14532d", font: "Nunito", headingFont: "Nunito", radius: "md" },
    heroImage: u("photo-1542838132-92c53300491e"),
    demoCategories: [
      { name: "Fresh produce", image: u("photo-1540574163026-643ea20ade25", 800) },
      { name: "Pantry", image: u("photo-1574323347407-f5e1ad6d020b", 800) },
      { name: "Bakery", image: u("photo-1550989460-0adf9ea622e2", 800) },
      { name: "Household", image: u("photo-1583394838336-acd977736f90", 800) },
    ],
    demoProducts: [
      { name: "Fresh avocados (1kg)", price: 1500, image: u("photo-1540574163026-643ea20ade25", 800), category: "Fresh produce" },
      { name: "Rwandan coffee 500g", price: 7000, image: u("photo-1574323347407-f5e1ad6d020b", 800), category: "Pantry" },
      { name: "Fresh bread loaf", price: 1200, image: u("photo-1550989460-0adf9ea622e2", 800), category: "Bakery" },
      { name: "Sweet bananas (bunch)", price: 2000, image: u("photo-1567306226416-28f0efdc88ce", 800), category: "Fresh produce" },
      { name: "Basmati rice 5kg", price: 9500, image: u("photo-1574323347407-f5e1ad6d020b", 800), category: "Pantry" },
      { name: "Market basket", price: 15000, compareAtPrice: 18000, image: u("photo-1542838132-92c53300491e", 800), category: "Fresh produce" },
    ],
    build: (name) => ({
      header: header(name, "brand"),
      footer: footer(name, "#14532d", "#dcfce7"),
      pages: standardPages(
        [
          createSection("announcement", { text: "Order before 2pm for same-day delivery in Kigali", backgroundColor: "#15803d" }),
          createSection("hero", { heading: "Fresh groceries, delivered", subheading: "Fruit, vegetables and household essentials at market prices.", backgroundImage: u("photo-1542838132-92c53300491e"), layout: "split", align: "left", height: "md", backgroundColor: "#f0fdf4", textColor: "#14532d", overlay: 0 }),
          createSection("categories", { heading: "Aisles", style: "pills" }),
          createSection("product-grid", { heading: "Today's picks", columns: "5", limit: 10 }),
          createSection("features", { items: [{ title: "Same-day delivery", text: "Order before 2pm" }, { title: "Fresh guarantee", text: "Or your money back" }, { title: "MoMo or cash", text: "Pay how you like" }], backgroundColor: "#f0fdf4" }),
        ],
        name,
        u("photo-1542838132-92c53300491e", 1400),
      ),
    }),
  },
  {
    key: "furniture",
    name: "Nest",
    category: "Furniture & home",
    description: "Calm, spacious layout with large imagery for furniture and home décor.",
    highlights: ["Landscape imagery", "Lookbook gallery", "Warm neutral palette"],
    theme: { primaryColor: "#78350f", secondaryColor: "#faf5ef", backgroundColor: "#fdfbf7", textColor: "#292524", font: "Manrope", headingFont: "Lora", radius: "sm" },
    heroImage: u("photo-1555041469-a586c61ea9bc"),
    demoCategories: [
      { name: "Living room", image: u("photo-1555041469-a586c61ea9bc", 800) },
      { name: "Bedroom", image: u("photo-1505693416388-ac5ce068fe85", 800) },
      { name: "Décor", image: u("photo-1586023492125-27b2c045efd7", 800) },
    ],
    demoProducts: [
      { name: "Three-seat sofa", price: 650000, image: u("photo-1555041469-a586c61ea9bc", 800), category: "Living room" },
      { name: "Lounge armchair", price: 210000, image: u("photo-1586023492125-27b2c045efd7", 800), category: "Living room" },
      { name: "Oak side chair", price: 85000, image: u("photo-1503602642458-232111445657", 800), category: "Décor" },
      { name: "Accent cushions (set)", price: 28000, compareAtPrice: 35000, image: u("photo-1586023492125-27b2c045efd7", 800), category: "Décor" },
      { name: "Reading nook set", price: 320000, image: u("photo-1538688525198-9b88f6f53126", 800), category: "Living room" },
      { name: "Woven basket", price: 15000, image: u("photo-1586023492125-27b2c045efd7", 800), category: "Décor" },
    ],
    build: (name) => ({
      header: header(name),
      footer: footer(name, "#292524", "#e7e5e4"),
      pages: standardPages(
        [
          createSection("hero", { heading: "Make your house a home", subheading: "Handcrafted furniture, made to last.", backgroundImage: u("photo-1555041469-a586c61ea9bc"), height: "lg", align: "left", overlay: 30 }),
          createSection("product-grid", { heading: "Featured pieces", columns: "3", limit: 6, imageRatio: "landscape" }),
          createSection("gallery", { heading: "Inspiration", columns: "3", images: [{ image: u("photo-1586023492125-27b2c045efd7", 900), caption: "" }, { image: u("photo-1538688525198-9b88f6f53126", 900), caption: "" }, { image: u("photo-1503602642458-232111445657", 900), caption: "" }] }),
          createSection("promo-banner", { heading: "Custom orders welcome", text: "Tell us your size and finish — our workshop will build it.", buttonText: "Talk to us", buttonLink: "/contact", backgroundColor: "#faf5ef" }),
          createSection("testimonials"),
        ],
        name,
        u("photo-1538688525198-9b88f6f53126", 1400),
      ),
    }),
  },
  {
    key: "general",
    name: "Essentials",
    category: "General store",
    description: "A clean, flexible layout that suits any mix of products.",
    highlights: ["Balanced layout", "Works for any category", "Easy to customise"],
    theme: { primaryColor: "#0f766e", secondaryColor: "#f0fdfa", backgroundColor: "#ffffff", textColor: "#111827", font: "Poppins", headingFont: "Poppins", radius: "md" },
    heroImage: u("photo-1441986300917-64674bd600d8"),
    demoCategories: [
      { name: "Home", image: u("photo-1586023492125-27b2c045efd7", 800) },
      { name: "Fashion", image: u("photo-1512436991641-6745cdb1723f", 800) },
      { name: "Tech", image: u("photo-1505740420928-5e560c06d30e", 800) },
      { name: "Beauty", image: u("photo-1556228578-8c89e6adf883", 800) },
    ],
    demoProducts: [
      { name: "Wireless headphones", price: 85000, image: u("photo-1505740420928-5e560c06d30e", 800), category: "Tech" },
      { name: "Everyday tote", price: 15000, image: u("photo-1512436991641-6745cdb1723f", 800), category: "Fashion" },
      { name: "Daily moisturiser", price: 14500, image: u("photo-1556228578-8c89e6adf883", 800), category: "Beauty" },
      { name: "Accent cushion", price: 12000, image: u("photo-1586023492125-27b2c045efd7", 800), category: "Home" },
      { name: "Sneakers", price: 45000, compareAtPrice: 52000, image: u("photo-1542291026-7eec264c27ff", 800), category: "Fashion" },
      { name: "Smart watch", price: 120000, image: u("photo-1523275335684-37898b6baf30", 800), category: "Tech" },
      { name: "Shea body butter", price: 9000, image: u("photo-1571781926291-c477ebfd024b", 800), category: "Beauty" },
      { name: "Portable speaker", price: 45000, image: u("photo-1608043152269-423dbba4e7e1", 800), category: "Tech" },
    ],
    build: (name) => ({
      header: header(name),
      footer: footer(name),
      pages: standardPages(
        [
          createSection("hero", { heading: `Welcome to ${name}`, subheading: "Everything you need, delivered to your door.", backgroundImage: u("photo-1441986300917-64674bd600d8"), height: "md", overlay: 40 }),
          createSection("features"),
          createSection("product-grid", { heading: "Popular right now" }),
          createSection("categories"),
          createSection("testimonials"),
          createSection("newsletter"),
        ],
        name,
        u("photo-1441986300917-64674bd600d8", 1400),
      ),
    }),
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

export function buildSiteConfig(templateKey: string, storeName: string, description?: string | null): SiteConfig {
  const t = TEMPLATE_MAP[templateKey] ?? TEMPLATE_MAP.general;
  const built = t.build(storeName);
  return {
    version: 1,
    template: t.key,
    theme: { ...t.theme },
    seo: { title: storeName, description: description ?? undefined, noindex: false },
    ...built,
  };
}

/** Map an onboarding business category to the closest template. */
export function templateForCategory(category: string): string {
  const map: Record<string, string> = {
    fashion: "fashion", electronics: "electronics", beauty: "beauty", grocery: "grocery",
    supermarket: "grocery", furniture: "furniture", food: "grocery", general: "general",
  };
  return map[category] ?? "general";
}
