import { useEffect, useMemo, useRef, useState } from "react";
import { sessionsApi } from "@/lib/api/sessions";
import type { SessionMeta, SessionSearchHit, SessionSearchMode } from "@/types";
import { getSessionKey } from "@/components/sessions/utils";

/** 输入停止多久后才发起正文检索（毫秒）。 */
const DEBOUNCE_MS = 300;

interface UseSessionContentSearchOptions {
  /** 已按 provider 过滤后的会话列表。 */
  sessions: SessionMeta[];
  query: string;
  mode: SessionSearchMode;
}

interface UseSessionContentSearchResult {
  /** sessionKey → 命中信息（含片段） */
  hits: Map<string, SessionSearchHit>;
  isSearching: boolean;
  error: string | null;
}

/**
 * 会话正文全文检索。
 *
 * 元数据搜索只覆盖标题 / 摘要 / 目录等列表信息。本 hook 在输入稳定
 * 300ms 后把当前会话集合交给后端检索完整聊天正文，并将命中合并回列表。
 */
export function useSessionContentSearch({
  sessions,
  query,
  mode,
}: UseSessionContentSearchOptions): UseSessionContentSearchResult {
  const [hits, setHits] = useState<Map<string, SessionSearchHit>>(
    () => new Map(),
  );
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const needle = query.trim();

  // 只在会话集合的「身份」变化时重新检索，避免列表刷新导致的无意义重查。
  const identity = useMemo(
    () =>
      sessions
        .map((session) => getSessionKey(session))
        .sort()
        .join("|"),
    [sessions],
  );

  useEffect(() => {
    if (!needle) {
      requestSeq.current += 1;
      setHits(new Map());
      setIsSearching(false);
      setError(null);
      return;
    }

    const seq = ++requestSeq.current;
    const items = sessions
      .filter((session) => Boolean(session.sourcePath))
      .map((session) => ({
        providerId: session.providerId,
        sessionId: session.sessionId,
        sourcePath: session.sourcePath as string,
      }));

    if (items.length === 0) {
      setHits(new Map());
      setIsSearching(false);
      setError(null);
      return;
    }

    // 命中只属于当前查询和匹配方式，切换到精准模式时不能继续展示旧模糊结果。
    setHits(new Map());
    setIsSearching(true);
    setError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          // A hit count cannot exceed the number of candidate sessions. Using the
          // candidate count avoids silently dropping matches after the old 200 cap.
          const results = await sessionsApi.searchContents(
            items,
            needle,
            mode,
            items.length,
          );
          if (seq !== requestSeq.current) return;

          const next = new Map<string, SessionSearchHit>();
          for (const hit of results) {
            next.set(
              getSessionKey({
                providerId: hit.providerId,
                sessionId: hit.sessionId,
                sourcePath: hit.sourcePath,
              }),
              hit,
            );
          }
          setHits(next);
          setError(null);
        } catch (searchError) {
          if (seq !== requestSeq.current) return;
          console.warn("session content search unavailable", searchError);
          setHits(new Map());
          setError(
            searchError instanceof Error
              ? searchError.message
              : String(searchError),
          );
        } finally {
          if (seq === requestSeq.current) {
            setIsSearching(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
    // sessions 的内容通过 identity 参与依赖，避免引用变化触发重查
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, identity, mode]);

  return { hits, isSearching, error };
}
