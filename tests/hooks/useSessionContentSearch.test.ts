import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionContentSearch } from "@/hooks/useSessionContentSearch";
import { sessionsApi } from "@/lib/api/sessions";
import type { SessionMeta, SessionSearchHit, SessionSearchMode } from "@/types";

const session: SessionMeta = {
  providerId: "codex",
  sessionId: "session-1",
  sourcePath: "/mock/session-1.jsonl",
};
const hit: SessionSearchHit = {
  providerId: session.providerId,
  sessionId: session.sessionId,
  sourcePath: session.sourcePath!,
  matchCount: 1,
  score: 901,
  snippet: "修复 会话搜索",
};

const flushDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

describe("useSessionContentSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears fuzzy hits immediately when switching to exact mode", async () => {
    const searchContents = vi
      .spyOn(sessionsApi, "searchContents")
      .mockResolvedValueOnce([hit])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ mode }: { mode: SessionSearchMode }) =>
        useSessionContentSearch({
          sessions: [session],
          query: "修复会话",
          mode,
        }),
      { initialProps: { mode: "fuzzy" as SessionSearchMode } },
    );

    await flushDebounce();
    expect(result.current.hits.size).toBe(1);

    rerender({ mode: "exact" });
    expect(result.current.hits.size).toBe(0);
    expect(result.current.isSearching).toBe(true);

    await flushDebounce();
    expect(searchContents).toHaveBeenLastCalledWith(
      [session],
      "修复会话",
      "exact",
      1,
    );
    expect(result.current.hits.size).toBe(0);
    expect(result.current.isSearching).toBe(false);
  });

  it("does not restore fuzzy results when an older request finishes last", async () => {
    let resolveFuzzy!: (hits: SessionSearchHit[]) => void;
    vi.spyOn(sessionsApi, "searchContents")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFuzzy = resolve;
          }),
      )
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ mode }: { mode: SessionSearchMode }) =>
        useSessionContentSearch({
          sessions: [session],
          query: "修复会话",
          mode,
        }),
      { initialProps: { mode: "fuzzy" as SessionSearchMode } },
    );

    await flushDebounce();
    rerender({ mode: "exact" });
    await flushDebounce();
    await act(async () => resolveFuzzy([hit]));

    expect(result.current.hits.size).toBe(0);
    expect(result.current.isSearching).toBe(false);
  });

  it("clears previous hits when the query changes or is emptied", async () => {
    const searchContents = vi
      .spyOn(sessionsApi, "searchContents")
      .mockResolvedValue([hit]);
    const { result, rerender } = renderHook(
      ({ query }) =>
        useSessionContentSearch({ sessions: [session], query, mode: "fuzzy" }),
      { initialProps: { query: "修复会话" } },
    );

    await flushDebounce();
    expect(result.current.hits.size).toBe(1);
    rerender({ query: "其他内容" });
    expect(result.current.hits.size).toBe(0);

    rerender({ query: "   " });
    await flushDebounce();
    expect(searchContents).toHaveBeenCalledTimes(1);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("requests enough results for every candidate instead of stopping at 200", async () => {
    const searchContents = vi
      .spyOn(sessionsApi, "searchContents")
      .mockResolvedValue([]);
    const sessions = Array.from({ length: 250 }, (_, index) => ({
      ...session,
      sessionId: `session-${index}`,
      sourcePath: `/mock/session-${index}.jsonl`,
    }));
    renderHook(() =>
      useSessionContentSearch({ sessions, query: "会话", mode: "exact" }),
    );

    await flushDebounce();
    expect(searchContents).toHaveBeenCalledWith(sessions, "会话", "exact", 250);
  });
});
