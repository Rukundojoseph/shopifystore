import { describe, expect, it } from "vitest";
import { normalizeRwandaPhone, isMtnNumber, formatRwandaPhone } from "@/lib/phone";
import { deliveryFeeFor, formatMoney } from "@/lib/money";
import { isValidStoreSlug, slugify } from "@/lib/slug";
import { safeHref, safeImage, siteConfigSchema } from "@/lib/editor/schema";
import { SECTION_DEFS, createSection } from "@/lib/editor/sections";
import { TEMPLATES, buildSiteConfig } from "@/templates";
import { mapRemoteStatus } from "@/lib/payments/momo";
import { sniffImage } from "@/lib/storage";

describe("phone numbers", () => {
  it("normalises Rwandan mobile formats", () => {
    expect(normalizeRwandaPhone("078 812 3456")).toBe("250788123456");
    expect(normalizeRwandaPhone("+250 788 123 456")).toBe("250788123456");
    expect(normalizeRwandaPhone("788123456")).toBe("250788123456");
    expect(normalizeRwandaPhone("0731234567")).toBe("250731234567");
  });
  it("rejects non-mobile numbers", () => {
    expect(normalizeRwandaPhone("0123456789")).toBeNull();
    expect(normalizeRwandaPhone("0751234567")).toBeNull();
    expect(normalizeRwandaPhone("12345")).toBeNull();
  });
  it("identifies MTN numbers", () => {
    expect(isMtnNumber("250788123456")).toBe(true);
    expect(isMtnNumber("250791234567")).toBe(true);
    expect(isMtnNumber("250731234567")).toBe(false);
    expect(formatRwandaPhone("250788123456")).toBe("0788 123 456");
  });
});

describe("money", () => {
  it("formats RWF without decimals", () => expect(formatMoney(15000)).toMatch(/15,000/));
  it("applies the free-delivery threshold", () => {
    expect(deliveryFeeFor(49_999, { deliveryFee: 2000, freeDeliveryOver: 50_000 })).toBe(2000);
    expect(deliveryFeeFor(50_000, { deliveryFee: 2000, freeDeliveryOver: 50_000 })).toBe(0);
    expect(deliveryFeeFor(10, { deliveryFee: 1500, freeDeliveryOver: null })).toBe(1500);
  });
});

describe("store slugs", () => {
  it("slugifies names", () => expect(slugify("Kigali Fashion & Co.")).toBe("kigali-fashion-co"));
  it("blocks reserved and malformed slugs", () => {
    expect(isValidStoreSlug("kigalifashion")).toBe(true);
    expect(isValidStoreSlug("admin")).toBe(false);
    expect(isValidStoreSlug("a")).toBe(false);
    expect(isValidStoreSlug("-bad")).toBe(false);
  });
});

describe("website builder config", () => {
  it.each(TEMPLATES.map((t) => t.key))("template %s produces a valid config", (key) => {
    const cfg = buildSiteConfig(key, "Test Store");
    expect(siteConfigSchema.safeParse(cfg).success).toBe(true);
    expect(cfg.pages.find((p) => p.slug === "/")).toBeTruthy();
  });
  it("every section type can be created with defaults", () => {
    for (const d of SECTION_DEFS) expect(createSection(d.type).settings).toEqual(expect.objectContaining(d.defaults));
  });
  it("rejects HTML-ish / malformed configs", () => {
    const cfg = buildSiteConfig("general", "X");
    expect(siteConfigSchema.safeParse({ ...cfg, theme: { ...cfg.theme, primaryColor: "red;background:url(x)" } }).success).toBe(false);
    expect(siteConfigSchema.safeParse({ ...cfg, pages: [] }).success).toBe(false);
  });
  it("only renders safe links and images", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("//evil.com")).toBe("#");
    expect(safeHref("/products")).toBe("/products");
    expect(safeHref("https://wa.me/250788")).toBe("https://wa.me/250788");
    expect(safeImage("http://insecure.example/x.png")).toBeNull();
    expect(safeImage("data:image/svg+xml,<svg>")).toBeNull();
    expect(safeImage("/uploads/a/b.png")).toBe("/uploads/a/b.png");
  });
});

describe("MTN status mapping", () => {
  it("maps final statuses", () => {
    expect(mapRemoteStatus({ status: "SUCCESSFUL" })).toBe("successful");
    expect(mapRemoteStatus({ status: "PENDING" })).toBe("processing");
    expect(mapRemoteStatus({ status: "FAILED", reason: "APPROVAL_REJECTED" })).toBe("cancelled");
    expect(mapRemoteStatus({ status: "FAILED", reason: "EXPIRED" })).toBe("expired");
    expect(mapRemoteStatus({ status: "FAILED", reason: { code: "INTERNAL_PROCESSING_ERROR" } })).toBe("failed");
  });
});

describe("upload validation", () => {
  it("detects real image types by magic bytes", () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(sniffImage(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});
