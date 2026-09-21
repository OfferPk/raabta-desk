import { describe, it, expect } from "vitest";
import {
  normalizePhoneDigits,
  toWhatsAppUrl,
  phoneHint,
  preparePhoneForStorage,
  rewritePkLocalPhone,
} from "@/lib/phone";

describe("normalizePhoneDigits", () => {
  it("strips non-digits and leading +", () => {
    expect(normalizePhoneDigits("+92 300 1112233")).toBe("923001112233");
    expect(normalizePhoneDigits("(92) 300-111-2233")).toBe("923001112233");
  });

  it("returns null for too-short input", () => {
    expect(normalizePhoneDigits("123")).toBeNull();
    expect(normalizePhoneDigits("")).toBeNull();
  });
});

describe("toWhatsAppUrl", () => {
  it("builds wa.me link", () => {
    expect(toWhatsAppUrl("923001112233")).toBe("https://wa.me/923001112233");
    expect(toWhatsAppUrl("+92 300 1112233")).toBe(
      "https://wa.me/923001112233"
    );
  });

  it("returns null for invalid phone", () => {
    expect(toWhatsAppUrl("abc")).toBeNull();
  });

  it("appends ?text= when prefill provided", () => {
    const url = toWhatsAppUrl("923001112233", "Assalam-o-alaikum");
    expect(url).toBe(
      "https://wa.me/923001112233?text=" + encodeURIComponent("Assalam-o-alaikum")
    );
  });

  it("omits text when empty/whitespace", () => {
    expect(toWhatsAppUrl("923001112233", "  ")).toBe("https://wa.me/923001112233");
  });
});

describe("phoneHint", () => {
  it("warns on local PK 03… format", () => {
    const hint = phoneHint("03001234567");
    expect(hint).toMatch(/92/);
  });

  it("is silent for proper country-coded numbers", () => {
    expect(phoneHint("923001234567")).toBeNull();
  });
});

describe("preparePhoneForStorage (F12)", () => {
  it("rewrites PK 03… to 92…", () => {
    expect(rewritePkLocalPhone("03001234567")).toBe("923001234567");
    expect(preparePhoneForStorage("03001234567")).toBe("923001234567");
    expect(preparePhoneForStorage("0300-123-4567")).toBe("923001234567");
  });

  it("keeps already country-coded numbers", () => {
    expect(preparePhoneForStorage("+92 300 1234567")).toBe("923001234567");
  });

  it("returns null for short phones", () => {
    expect(preparePhoneForStorage("123")).toBeNull();
  });
});
