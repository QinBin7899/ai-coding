import { useCallback, useMemo } from "react";
import type { SessionMeta, SessionSearchMode } from "@/types";

interface UseSessionSearchOptions {
  sessions: SessionMeta[];
  providerFilter: string;
  mode: SessionSearchMode;
}

interface UseSessionSearchResult {
  search: (query: string) => SessionMeta[];
}

const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase();

const compactSearchText = (value: string) =>
  Array.from(normalizeSearchText(value))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");

const splitSearchTerms = (value: string) =>
  normalizeSearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const countOccurrences = (text: string, needle: string) => {
  if (!needle) return 0;

  let count = 0;
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + Math.max(needle.length, 1);
  }
  return count;
};

const orderedBigramScore = (text: string, query: string) => {
  const queryChars = Array.from(query);
  if (queryChars.length < 4) return 0;

  const bigrams = queryChars
    .slice(0, -1)
    .map((char, index) => `${char}${queryChars[index + 1]}`);
  let cursor = 0;
  let first = -1;
  let last = -1;
  let matched = 0;

  for (const bigram of bigrams) {
    const index = text.indexOf(bigram, cursor);
    if (index < 0) continue;
    if (first < 0) first = index;
    last = index + bigram.length;
    matched += 1;
    cursor = index + 1;
  }

  const ratio = matched / bigrams.length;
  const span = first < 0 ? Number.POSITIVE_INFINITY : last - first;
  const maxSpan = Math.max(64, query.length * 6);
  if (ratio < 0.6 || span > maxSpan) return 0;

  return 400 + Math.round(ratio * 100);
};

/**
 * Returns a comparable metadata score. Zero means no match.
 *
 * Exact mode requires the complete phrase. Fuzzy mode additionally accepts
 * punctuation/spacing differences, separated keywords, and a close ordered
 * bigram match for longer queries.
 */
export const getSessionTextMatchScore = (
  text: string,
  query: string,
  mode: SessionSearchMode,
) => {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return 0;

  const exactCount = countOccurrences(normalizedText, normalizedQuery);
  if (exactCount > 0) return 1_000 + Math.min(exactCount, 99);
  if (mode === "exact") return 0;

  const compactText = compactSearchText(normalizedText);
  const compactQuery = compactSearchText(normalizedQuery);
  if (!compactQuery) return 0;

  const compactCount = countOccurrences(compactText, compactQuery);
  if (compactCount > 0) return 900 + Math.min(compactCount, 99);

  const terms = splitSearchTerms(normalizedQuery);
  if (terms.length > 1) {
    const matchedTerms = terms.filter((term) => normalizedText.includes(term));
    const required = Math.ceil(terms.length * 0.6);
    if (matchedTerms.length >= required) {
      return 700 + matchedTerms.length * 10;
    }
  }

  return orderedBigramScore(compactText, compactQuery);
};

const getSessionSearchText = (session: SessionMeta) =>
  [
    session.sessionId,
    session.title,
    session.summary,
    session.projectDir,
    session.sourcePath,
  ]
    .filter(Boolean)
    .join("\n");

/** 搜索标题、摘要、项目目录、会话 ID 与源路径。 */
export function useSessionSearch({
  sessions,
  providerFilter,
  mode,
}: UseSessionSearchOptions): UseSessionSearchResult {
  const filteredByProvider = useMemo(() => {
    if (providerFilter === "all") return sessions;
    return sessions.filter((session) => session.providerId === providerFilter);
  }, [sessions, providerFilter]);

  const search = useCallback(
    (query: string): SessionMeta[] => {
      const needle = query.trim();

      if (!needle) {
        return [...filteredByProvider].sort((a, b) => {
          const aTs = a.lastActiveAt ?? a.createdAt ?? 0;
          const bTs = b.lastActiveAt ?? b.createdAt ?? 0;
          return bTs - aTs;
        });
      }

      return filteredByProvider
        .map((session) => ({
          session,
          score: getSessionTextMatchScore(
            getSessionSearchText(session),
            needle,
            mode,
          ),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aTs = a.session.lastActiveAt ?? a.session.createdAt ?? 0;
          const bTs = b.session.lastActiveAt ?? b.session.createdAt ?? 0;
          return bTs - aTs;
        })
        .map(({ session }) => session);
    },
    [filteredByProvider, mode],
  );

  return { search };
}
