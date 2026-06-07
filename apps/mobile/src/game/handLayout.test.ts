import { describe, expect, it } from "vitest";
import { computeHandLayout } from "./handLayout";

describe("computeHandLayout", () => {
  it("caps spacing tighter with larger horizontal padding", () => {
    const wide = 390;
    const cardW = 76;
    const cardH = 106;
    const withSmallPad = computeHandLayout(wide, cardW, cardH, 6, 20);
    const withLargePad = computeHandLayout(wide, cardW, cardH, 6, 40);
    expect(withLargePad.spacing).toBeLessThanOrEqual(withSmallPad.spacing);
  });

  it("uses less rotation per slot for larger hands", () => {
    const layout4 = computeHandLayout(390, 76, 106, 4);
    const layout6 = computeHandLayout(390, 76, 106, 6);
    expect(layout6.rotPerSlot).toBeLessThan(layout4.rotPerSlot);
  });
});
