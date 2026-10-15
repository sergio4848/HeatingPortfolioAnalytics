import { describe, it, expect } from "vitest";
import brand from "../../../packages/brand/brand.json";
describe("locale and brand contract", () => {
  it("does not advertise unreviewed Latvian as supported", () => {
    expect(brand.supportedLocales).toEqual(["en"]);
    expect(brand.preparedLocales).toContain("lv");
  });
  it("keeps the provisional status explicit", () => {
    expect(brand.status.toLowerCase()).toContain("pending");
  });
});
