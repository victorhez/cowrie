import { describe, it, expect } from "vitest";
import lab from "@/data/circle-lab.json";
import { LAB_CONFIGS, STATUS } from "@/data/status";
import { readFileSync } from "node:fs";

describe("published counts agree with the data", () => {
  it("LAB_CONFIGS equals the number of Circle Lab rows", () => {
    expect(LAB_CONFIGS).toBe(lab.cells.length);
    expect(LAB_CONFIGS).toBe(72); // 2 sizes x 4 default rates x 3 collateral x 3 safety-pot levels
  });
  it("status page and README quote the same count", () => {
    const lb = STATUS.find((s) => s.id === "lab")!;
    expect(lb.note).toContain(`${LAB_CONFIGS} configurations`);
    expect(readFileSync("README.md", "utf8")).toContain(`${LAB_CONFIGS} configurations`);
  });
  it("no page hard-codes the old count", () => {
    expect(readFileSync("src/app/page.tsx", "utf8")).not.toMatch(/<b>48<\/b>/);
  });
});
