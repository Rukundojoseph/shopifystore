import type { ListItem, Section, SettingValue } from "./schema";

// Section registry shared by the editor (fields → properties panel) and the
// storefront renderer (defaults). React components live in
// components/storefront/sections and are mapped by `type`.

export type FieldDef = (
  | { key: string; label: string; type: "text" | "textarea" | "color" | "image" | "link" }
  | { key: string; label: string; type: "number"; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: "toggle" }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "category" }
  | { key: string; label: string; type: "note" }
  | { key: string; label: string; type: "list"; itemLabel: string; fields: { key: string; label: string; type: "text" | "textarea" | "image" | "link" }[] }
) & {
  /** Only show this field while a toggle is on (key), or while every listed setting equals its value. */
  showIf?: string | { key: string; equals: SettingValue }[];
};

export type SectionDef = {
  type: string;
  label: string;
  description: string;
  group: "Layout" | "Content" | "Commerce" | "Engagement" | "Advanced";
  global?: boolean; // header/footer: edited once, shown on every page
  /** The fixed content block of a built-in shop page (product list, cart…): can be moved, not removed. */
  system?: boolean;
  fields: FieldDef[];
  defaults: Record<string, SettingValue>;
};

const opt = (...values: [string, string][]) => values.map(([value, label]) => ({ value, label }));

const spacing: FieldDef = {
  key: "paddingY",
  label: "Spacing",
  type: "select",
  options: opt(["none", "None"], ["sm", "Small"], ["md", "Medium"], ["lg", "Large"]),
};
const bg: FieldDef = { key: "backgroundColor", label: "Background colour", type: "color" };
const fg: FieldDef = { key: "textColor", label: "Text colour", type: "color" };
const align: FieldDef = { key: "align", label: "Text alignment", type: "select", options: opt(["left", "Left"], ["center", "Centre"], ["right", "Right"]) };

const systemMain = (kind: string, label: string, description: string): SectionDef => ({
  type: `${kind}-main`, label, description, group: "Layout", system: true, fields: [], defaults: {},
});

export const SECTION_DEFS: SectionDef[] = [
  systemMain("shop", "Product list", "All products with search, sorting and categories"),
  systemMain("product", "Product details", "Gallery, price, options and add to cart"),
  systemMain("collection", "Category products", "Products in the current category"),
  systemMain("cart", "Cart", "The shopper's cart and totals"),
  systemMain("checkout", "Checkout", "Delivery details and payment"),
  systemMain("order", "Order confirmation", "Order summary and payment status"),
  {
    type: "custom",
    label: "Custom layout",
    description: "Build anything from containers and elements",
    group: "Advanced",
    fields: [],
    defaults: {},
  },
  {
    type: "header",
    label: "Navigation bar",
    description: "Logo, menu links, search and cart",
    group: "Layout",
    global: true,
    fields: [
      { key: "navMode", label: "Navigation bar", type: "select", options: opt(["standard", "Standard (logo, links, icons)"], ["custom", "Fully custom — design it yourself"]) },
      { key: "navCustomNote", label: "Your navigation bar is now a layout of elements (Logo, Menu, Search, Cart…) you can change freely: select any of them on the canvas, drag in buttons, images or containers, and set spacing, borders and placement in each element's Advanced tab.", type: "note", showIf: [{ key: "navMode", equals: "custom" }] },
      { key: "logoText", label: "Store name / logo text", type: "text" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "logoImage", label: "Logo image", type: "image" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "showSearch", label: "Show search", type: "toggle" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "showCart", label: "Show cart", type: "toggle" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "sticky", label: "Stick to top when scrolling", type: "toggle" },
      { key: "style", label: "Style", type: "select", options: opt(["light", "Light"], ["dark", "Dark"], ["brand", "Brand colour"]) },
      { key: "backgroundColor", label: "Background colour (overrides style)", type: "color" },
      { key: "textColor", label: "Text colour (overrides style)", type: "color" },
      { key: "logoPosition", label: "Logo position", type: "select", options: opt(["left", "Left"], ["center", "Centre"]) , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "linksPosition", label: "Menu links position", type: "select", options: opt(["left", "Next to the logo"], ["center", "Centre"], ["right", "Right, beside the icons"]) , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "linksGap", label: "Space between links", type: "select", options: opt(["sm", "Small"], ["md", "Medium"], ["lg", "Large"], ["xl", "Extra large"]) , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "linkSize", label: "Link text size", type: "select", options: opt(["sm", "Small"], ["md", "Medium"], ["lg", "Large"]) , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "linksUppercase", label: "Links in capitals", type: "toggle" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "navHeight", label: "Bar height (px)", type: "number", min: 48, max: 140, step: 4 , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "showLinks", label: "Show menu links", type: "toggle" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "navElements", label: "Add your own elements to the bar", type: "toggle" , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "navElementsPosition", label: "Your elements' position", type: "select", options: opt(["left", "After the logo"], ["center", "Centre"], ["right", "Before the icons"]), showIf: [{ key: "navMode", equals: "standard" }, { key: "navElements", equals: true }] },
      { key: "navNote", label: "Your elements sit in a container in the bar: drag buttons, icons, images, text, search, containers or columns into it from the Add panel. Select the container to change its layout and spacing.", type: "note", showIf: [{ key: "navMode", equals: "standard" }, { key: "navElements", equals: true }] },
      { key: "links", label: "Menu links", type: "list", itemLabel: "Link", fields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Destination", type: "link" }] , showIf: [{ key: "navMode", equals: "standard" }] },
      { key: "topBar", label: "Information bar above the header", type: "toggle" },
      { key: "topBarMode", label: "Information bar content", type: "select", options: opt(["simple", "Simple text"], ["custom", "Custom layout (images, buttons…)"]), showIf: "topBar" },
      { key: "topBarText", label: "Information bar text", type: "text", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarLink", label: "Information bar link (optional)", type: "link", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarBg", label: "Information bar background", type: "color", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarColor", label: "Information bar text colour", type: "color", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarImage", label: "Information bar background image", type: "image", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarOverlay", label: "Darken background image (%)", type: "number", min: 0, max: 80, step: 5, showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "simple" }] },
      { key: "topBarNote", label: "Design the bar right on the canvas: click it to select its container, then drag images, buttons, text or columns into it from the Add panel. Each element has its own Style and Advanced tabs, conditions and workflows.", type: "note", showIf: [{ key: "topBar", equals: true }, { key: "topBarMode", equals: "custom" }] },
    ],
    defaults: {
      logoText: "", logoImage: "", showSearch: true, showCart: true, sticky: true, style: "light",
      backgroundColor: "", textColor: "",
      logoPosition: "left", linksPosition: "left", linksGap: "md", linkSize: "sm", linksUppercase: false, navHeight: 64,
      showLinks: true, navElements: false, navElementsPosition: "right", navMode: "standard",
      topBar: false, topBarMode: "simple", topBarText: "Free delivery in Kigali on orders over 50,000 RWF", topBarLink: "", topBarBg: "", topBarColor: "", topBarImage: "", topBarOverlay: 30,
      links: [{ label: "Shop", href: "/products" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }],
    },
  },
  {
    type: "announcement",
    label: "Announcement bar",
    description: "Thin strip for offers and notices",
    group: "Layout",
    fields: [{ key: "text", label: "Message", type: "text" }, { key: "link", label: "Link", type: "link" }, bg, fg],
    defaults: { text: "Free delivery in Kigali on orders over 50,000 RWF", link: "", backgroundColor: "#111111", textColor: "#ffffff" },
  },
  {
    type: "hero",
    label: "Hero banner",
    description: "Large headline with image and button",
    group: "Content",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "subheading", label: "Subtitle", type: "textarea" },
      { key: "buttonText", label: "Button text", type: "text" },
      { key: "buttonLink", label: "Button destination", type: "link" },
      { key: "backgroundImage", label: "Background image", type: "image" },
      { key: "layout", label: "Layout", type: "select", options: opt(["overlay", "Text over image"], ["split", "Image beside text"]) },
      align,
      { key: "height", label: "Section height", type: "select", options: opt(["sm", "Short"], ["md", "Medium"], ["lg", "Tall"], ["full", "Full screen"]) },
      { key: "overlay", label: "Image darkening (%)", type: "number", min: 0, max: 80, step: 5 },
      bg, fg, spacing,
    ],
    defaults: {
      heading: "Discover our collection", subheading: "Quality products, delivered across Rwanda.",
      buttonText: "Shop now", buttonLink: "/products", backgroundImage: "", layout: "overlay", align: "center",
      height: "lg", overlay: 35, backgroundColor: "#f4f4f5", textColor: "#ffffff", paddingY: "none",
    },
  },
  {
    type: "features",
    label: "Selling points",
    description: "Icons row: delivery, payment, returns",
    group: "Content",
    fields: [
      { key: "items", label: "Items", type: "list", itemLabel: "Item", fields: [{ key: "title", label: "Title", type: "text" }, { key: "text", label: "Text", type: "text" }] },
      bg, fg, spacing,
    ],
    defaults: {
      items: [
        { title: "Fast delivery", text: "Same-day delivery in Kigali" },
        { title: "Pay with MoMo", text: "Secure MTN Mobile Money checkout" },
        { title: "Easy returns", text: "7-day return policy" },
      ],
      backgroundColor: "", textColor: "", paddingY: "md",
    },
  },
  {
    type: "text",
    label: "Text block",
    description: "Heading and paragraph",
    group: "Content",
    fields: [{ key: "heading", label: "Heading", type: "text" }, { key: "body", label: "Text", type: "textarea" }, align, bg, fg, spacing],
    defaults: { heading: "Our story", body: "Tell customers who you are and what makes your products special.", align: "center", backgroundColor: "", textColor: "", paddingY: "lg" },
  },
  {
    type: "image",
    label: "Image",
    description: "Single image with optional caption",
    group: "Content",
    fields: [
      { key: "image", label: "Image", type: "image" },
      { key: "alt", label: "Description (for accessibility)", type: "text" },
      { key: "caption", label: "Caption", type: "text" },
      { key: "link", label: "Link", type: "link" },
      { key: "fullWidth", label: "Full width", type: "toggle" },
      spacing,
    ],
    defaults: { image: "", alt: "", caption: "", link: "", fullWidth: false, paddingY: "md" },
  },
  {
    type: "gallery",
    label: "Image gallery",
    description: "Grid of images",
    group: "Content",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "columns", label: "Columns", type: "select", options: opt(["2", "2"], ["3", "3"], ["4", "4"]) },
      { key: "images", label: "Images", type: "list", itemLabel: "Image", fields: [{ key: "image", label: "Image", type: "image" }, { key: "caption", label: "Caption", type: "text" }] },
      bg, spacing,
    ],
    defaults: { heading: "Gallery", columns: "3", images: [], backgroundColor: "", paddingY: "lg" },
  },
  {
    type: "product-grid",
    label: "Product grid",
    description: "Show products from your catalogue",
    group: "Commerce",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "source", label: "Products to display", type: "select", options: opt(["latest", "Newest products"], ["featured", "Featured products"], ["category", "From a category"]) },
      { key: "category", label: "Category", type: "category" },
      { key: "limit", label: "Number of products", type: "number", min: 1, max: 24 },
      { key: "columns", label: "Columns (desktop)", type: "select", options: opt(["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]) },
      { key: "imageRatio", label: "Image ratio", type: "select", options: opt(["square", "Square"], ["portrait", "Portrait"], ["landscape", "Landscape"]) },
      { key: "sort", label: "Sort by", type: "select", options: opt(["newest", "Newest"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["name", "Name"]) },
      { key: "showViewAll", label: "Show 'View all' link", type: "toggle" },
      { key: "cardAlign", label: "Card text alignment", type: "select", options: opt(["left", "Left"], ["center", "Centred"]) },
      { key: "cardButton", label: "Show 'Add to cart' button", type: "toggle" },
      bg, spacing,
    ],
    defaults: { heading: "Featured products", source: "latest", category: "", limit: 8, columns: "4", imageRatio: "square", sort: "newest", showViewAll: true, cardAlign: "left", cardButton: false, backgroundColor: "", paddingY: "lg" },
  },
  {
    type: "categories",
    label: "Product categories",
    description: "Links to your categories",
    group: "Commerce",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "style", label: "Style", type: "select", options: opt(["tiles", "Image tiles"], ["pills", "Buttons"]) },
      { key: "columns", label: "Columns", type: "select", options: opt(["2", "2"], ["3", "3"], ["4", "4"], ["6", "6"]) },
      bg, spacing,
    ],
    defaults: { heading: "Shop by category", style: "tiles", columns: "4", backgroundColor: "", paddingY: "lg" },
  },
  {
    type: "promo-banner",
    label: "Promotional banner",
    description: "Highlight a sale or campaign",
    group: "Commerce",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "buttonText", label: "Button text", type: "text" },
      { key: "buttonLink", label: "Button destination", type: "link" },
      { key: "image", label: "Image", type: "image" },
      bg, fg, spacing,
    ],
    defaults: { heading: "Season sale — up to 30% off", text: "Limited time only. While stocks last.", buttonText: "Shop the sale", buttonLink: "/products", image: "", backgroundColor: "", textColor: "", paddingY: "md" },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "What your customers say",
    group: "Engagement",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "items", label: "Testimonials", type: "list", itemLabel: "Testimonial", fields: [{ key: "quote", label: "Quote", type: "textarea" }, { key: "author", label: "Name", type: "text" }, { key: "role", label: "Location / detail", type: "text" }] },
      bg, spacing,
    ],
    defaults: {
      heading: "What our customers say",
      items: [
        { quote: "Delivery was quick and the quality is excellent.", author: "Aline", role: "Kigali" },
        { quote: "Paying with MoMo made it so easy.", author: "Eric", role: "Musanze" },
        { quote: "Great service, I will order again.", author: "Diane", role: "Huye" },
      ],
      backgroundColor: "", paddingY: "lg",
    },
  },
  {
    type: "newsletter",
    label: "Newsletter signup",
    description: "Collect customer emails",
    group: "Engagement",
    fields: [{ key: "heading", label: "Heading", type: "text" }, { key: "text", label: "Text", type: "text" }, { key: "buttonText", label: "Button text", type: "text" }, bg, spacing],
    defaults: { heading: "Stay in the loop", text: "New arrivals and offers, straight to your inbox.", buttonText: "Subscribe", backgroundColor: "", paddingY: "lg" },
  },
  {
    type: "contact",
    label: "Contact information",
    description: "Phone, WhatsApp, email and location",
    group: "Engagement",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "text", label: "Text", type: "textarea" },
      { key: "showPhone", label: "Show phone", type: "toggle" },
      { key: "showWhatsApp", label: "Show WhatsApp button", type: "toggle" },
      { key: "showEmail", label: "Show email", type: "toggle" },
      { key: "showLocation", label: "Show location", type: "toggle" },
      { key: "hours", label: "Opening hours", type: "text" },
      bg, spacing,
    ],
    defaults: { heading: "Get in touch", text: "We usually reply within an hour.", showPhone: true, showWhatsApp: true, showEmail: true, showLocation: true, hours: "Mon–Sat, 8:00–20:00", backgroundColor: "", paddingY: "lg" },
  },
  {
    type: "button",
    label: "Button",
    description: "A single call-to-action button",
    group: "Content",
    fields: [
      { key: "text", label: "Text", type: "text" },
      { key: "link", label: "Destination", type: "link" },
      { key: "style", label: "Style", type: "select", options: opt(["solid", "Solid"], ["outline", "Outline"]) },
      align, spacing,
    ],
    defaults: { text: "Shop now", link: "/products", style: "solid", align: "center", paddingY: "md" },
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Empty vertical space",
    group: "Layout",
    fields: [{ key: "height", label: "Height (px)", type: "number", min: 8, max: 240, step: 8 }, bg],
    defaults: { height: 48, backgroundColor: "" },
  },
  {
    type: "footer",
    label: "Footer",
    description: "Links, social media and contact",
    group: "Layout",
    global: true,
    fields: [
      { key: "text", label: "About text", type: "textarea" },
      { key: "links", label: "Links", type: "list", itemLabel: "Link", fields: [{ key: "label", label: "Label", type: "text" }, { key: "href", label: "Destination", type: "link" }] },
      { key: "instagram", label: "Instagram URL", type: "link" },
      { key: "facebook", label: "Facebook URL", type: "link" },
      { key: "tiktok", label: "TikTok URL", type: "link" },
      { key: "x", label: "X (Twitter) URL", type: "link" },
      { key: "whatsapp", label: "WhatsApp number", type: "text" },
      bg, fg,
    ],
    defaults: {
      text: "", instagram: "", facebook: "", tiktok: "", x: "", whatsapp: "",
      links: [{ label: "Shop", href: "/products" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }],
      backgroundColor: "#111111", textColor: "#e4e4e7",
    },
  },
];

export const SECTION_MAP: Record<string, SectionDef> = Object.fromEntries(SECTION_DEFS.map((d) => [d.type, d]));
export const PLACEABLE_SECTIONS = SECTION_DEFS.filter((d) => !d.global && !d.system);

/** Default content of a built-in shop page: just its main block. */
export function defaultSystemSections(kind: string): Section[] {
  return [{ id: `${kind}-main`, type: `${kind}-main`, settings: {} }];
}

export function newSectionId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSection(type: string, overrides: Record<string, SettingValue> = {}): Section {
  const def = SECTION_MAP[type];
  if (!def) throw new Error(`Unknown section type: ${type}`);
  return { id: newSectionId(type), type, settings: { ...structuredClone(def.defaults), ...overrides } };
}

/** Setting with registry default fallback. */
export function setting<T extends SettingValue>(section: Section, key: string): T {
  const v = section.settings[key];
  if (v !== undefined) return v as T;
  return SECTION_MAP[section.type]?.defaults[key] as T;
}

export const str = (s: Section, k: string) => {
  const v = setting(s, k);
  return typeof v === "string" ? v : v == null ? "" : String(v);
};
export const num = (s: Section, k: string, d = 0) => {
  const v = Number(setting(s, k));
  return Number.isFinite(v) ? v : d;
};
export const bool = (s: Section, k: string) => setting(s, k) === true;
export const list = (s: Section, k: string): ListItem[] => {
  const v = setting(s, k);
  return Array.isArray(v) ? v : [];
};
