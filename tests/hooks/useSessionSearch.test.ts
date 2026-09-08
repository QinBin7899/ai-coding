import { describe, expect, it } from "vitest";
import { getSessionTextMatchScore } from "@/hooks/useSessionSearch";

describe("session search matching", () => {
  it("requires the complete phrase in exact mode", () => {
    expect(
      getSessionTextMatchScore(
        "修复会话搜索失败，同时检查 AI Coding",
        "会话搜索失败",
        "exact",
      ),
    ).toBeGreaterThan(0);
    expect(
      getSessionTextMatchScore("修复 会话 搜索失败", "修复会话", "exact"),
    ).toBe(0);
  });

  it("matches without regard to case in exact mode", () => {
    expect(
      getSessionTextMatchScore(
        "Fix the AI Coding search",
        "ai coding",
        "exact",
      ),
    ).toBeGreaterThan(0);
  });

  it("ignores punctuation and spacing in fuzzy mode", () => {
    expect(
      getSessionTextMatchScore("修复 会话-搜索失败", "修复会话搜索", "fuzzy"),
    ).toBeGreaterThanOrEqual(900);
  });

  it("matches separated task keywords in fuzzy mode", () => {
    expect(
      getSessionTextMatchScore(
        "先修复列表，随后重新实现会话的关键词搜索",
        "修复 会话 搜索",
        "fuzzy",
      ),
    ).toBeGreaterThanOrEqual(700);
  });

  it("tolerates a transposed Chinese pair in a longer fuzzy query", () => {
    expect(
      getSessionTextMatchScore(
        "会话搜索失败，需要重新建立索引",
        "会话搜素失败",
        "fuzzy",
      ),
    ).toBeGreaterThanOrEqual(400);
  });
});
