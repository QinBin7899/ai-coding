//! 会话正文全文检索
//!
//! 会话列表页的元数据与聊天正文都支持两种匹配：
//! - 精准：完整短语的大小写不敏感子串匹配；
//! - 模糊：在精准匹配之外，允许标点/空格差异、分散关键词，以及较长
//!   查询的有序双字片段近似匹配。
//!
//! 正文按 mtime + size 缓存在内存中。SQLite 来源无法用 mtime 判断，
//! 使用 60 秒 TTL。单会话正文设有字符上限，首轮解析并行执行。

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::load_messages;

/// 单个会话缓存的正文字符上限（按字符计）。
const MAX_TEXT_CHARS: usize = 2_000_000;
/// SQLite 来源的缓存有效期。
const SQLITE_TTL: Duration = Duration::from_secs(60);
/// 片段前后各保留的字符数。
const SNIPPET_CONTEXT_CHARS: usize = 60;
/// 单会话最多统计的命中次数。
const MAX_MATCH_COUNT: usize = 99;
/// 并行解析的线程数上限。
const MAX_WORKERS: usize = 6;

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SessionSearchMode {
    Exact,
    #[default]
    Fuzzy,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRef {
    pub provider_id: String,
    pub session_id: String,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSearchHit {
    pub provider_id: String,
    pub session_id: String,
    pub source_path: String,
    pub match_count: usize,
    pub score: usize,
    pub snippet: String,
}

struct CachedText {
    /// 文件 mtime（毫秒）+ 大小，用于判断是否过期；SQLite 来源为 None。
    fingerprint: Option<(i64, u64)>,
    loaded_at: Instant,
    /// 小写化后的正文（中文不受影响，英文实现大小写不敏感匹配）。
    text_lc: String,
}

static CACHE: OnceLock<Mutex<HashMap<String, CachedText>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, CachedText>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn file_fingerprint(path: &str) -> Option<(i64, u64)> {
    let meta = std::fs::metadata(Path::new(path)).ok()?;
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Some((mtime_ms, meta.len()))
}

/// 把会话消息拼成一段可检索的纯文本（小写）。
fn build_text(provider_id: &str, source_path: &str) -> Option<String> {
    let messages = load_messages(provider_id, source_path).ok()?;
    let mut text = String::new();
    let mut chars = 0usize;
    for message in messages {
        for ch in message.content.chars() {
            if chars >= MAX_TEXT_CHARS {
                return Some(text.to_lowercase());
            }
            text.push(ch);
            chars += 1;
        }
        text.push('\n');
        chars += 1;
    }
    Some(text.to_lowercase())
}

/// 确保缓存里有该会话的最新正文。克隆可缩短全局锁持有时间。
fn fresh_text(item: &SessionRef) -> Option<String> {
    let is_sqlite = item.source_path.starts_with("sqlite:");
    let fingerprint = if is_sqlite {
        None
    } else {
        file_fingerprint(&item.source_path)
    };

    if let Ok(map) = cache().lock() {
        if let Some(entry) = map.get(&item.source_path) {
            let fresh = if is_sqlite {
                entry.loaded_at.elapsed() < SQLITE_TTL
            } else {
                entry.fingerprint == fingerprint && fingerprint.is_some()
            };
            if fresh {
                return Some(entry.text_lc.clone());
            }
        }
    }

    let text_lc = build_text(&item.provider_id, &item.source_path)?;
    if let Ok(mut map) = cache().lock() {
        map.insert(
            item.source_path.clone(),
            CachedText {
                fingerprint,
                loaded_at: Instant::now(),
                text_lc: text_lc.clone(),
            },
        );
    }
    Some(text_lc)
}

fn count_occurrences(text: &str, needle: &str) -> usize {
    if needle.is_empty() {
        return 0;
    }

    let mut count = 0usize;
    let mut cursor = 0usize;
    while let Some(pos) = text[cursor..].find(needle) {
        count += 1;
        cursor += pos + needle.len();
        if count >= MAX_MATCH_COUNT || cursor >= text.len() {
            break;
        }
    }
    count
}

fn snippet_around(text: &str, first: usize, match_len: usize) -> String {
    let mut start = first;
    let mut taken = 0usize;
    while start > 0 && taken < SNIPPET_CONTEXT_CHARS {
        start -= 1;
        while !text.is_char_boundary(start) {
            start -= 1;
        }
        taken += 1;
    }

    let mut end = first + match_len;
    taken = 0;
    while end < text.len() && taken < SNIPPET_CONTEXT_CHARS {
        end += 1;
        while end < text.len() && !text.is_char_boundary(end) {
            end += 1;
        }
        taken += 1;
    }

    let mut snippet: String = text[start..end]
        .chars()
        .map(|c| {
            if c == '\n' || c == '\r' || c == '\t' {
                ' '
            } else {
                c
            }
        })
        .collect();
    snippet = snippet.split_whitespace().collect::<Vec<_>>().join(" ");
    if start > 0 {
        snippet.insert(0, '…');
    }
    if end < text.len() {
        snippet.push('…');
    }
    snippet
}

/// 完整短语的大小写不敏感子串匹配。
pub(crate) fn find_exact_matches(text_lc: &str, needle_lc: &str) -> Option<(usize, String)> {
    let first = text_lc.find(needle_lc)?;
    let count = count_occurrences(text_lc, needle_lc);
    Some((count, snippet_around(text_lc, first, needle_lc.len())))
}

fn compact_search_text(text: &str) -> String {
    text.chars().filter(|ch| ch.is_alphanumeric()).collect()
}

fn split_search_terms(query: &str) -> Vec<&str> {
    query
        .split(|ch: char| !ch.is_alphanumeric())
        .filter(|term| !term.is_empty())
        .collect()
}

fn snippet_for_candidates(text: &str, candidates: &[&str]) -> String {
    for candidate in candidates {
        if let Some((_, snippet)) = find_exact_matches(text, candidate) {
            return snippet;
        }
    }

    let preview: String = text.chars().take(SNIPPET_CONTEXT_CHARS * 2).collect();
    if preview.chars().count() < text.chars().count() {
        format!("{preview}…")
    } else {
        preview
    }
}

fn ordered_bigram_match(text: &str, query: &str) -> Option<(usize, usize, Vec<String>)> {
    let query_chars: Vec<char> = query.chars().collect();
    if query_chars.len() < 4 {
        return None;
    }

    let bigrams: Vec<String> = query_chars
        .windows(2)
        .map(|window| window.iter().collect())
        .collect();
    let mut cursor = 0usize;
    let mut first = None;
    let mut last = 0usize;
    let mut matched = 0usize;
    let mut matched_bigrams = Vec::new();

    for bigram in &bigrams {
        let Some(relative) = text[cursor..].find(bigram) else {
            continue;
        };
        let absolute = cursor + relative;
        first.get_or_insert(absolute);
        last = absolute + bigram.len();
        matched += 1;
        matched_bigrams.push(bigram.clone());
        let advance = text[absolute..]
            .chars()
            .next()
            .map(char::len_utf8)
            .unwrap_or(1);
        cursor = absolute + advance;
    }

    let total = bigrams.len();
    if matched * 100 < total * 60 {
        return None;
    }

    let span = last.saturating_sub(first?);
    let max_span = query.len().saturating_mul(6).saturating_add(64);
    if span > max_span {
        return None;
    }

    Some((matched, total, matched_bigrams))
}

fn find_fuzzy_matches(text_lc: &str, needle_lc: &str) -> Option<(usize, usize, String)> {
    if let Some((count, snippet)) = find_exact_matches(text_lc, needle_lc) {
        return Some((count, 1_000_000 + count, snippet));
    }

    let compact_query = compact_search_text(needle_lc);
    if compact_query.is_empty() {
        return None;
    }
    let compact_text = compact_search_text(text_lc);

    if compact_text.contains(&compact_query) {
        let count = count_occurrences(&compact_text, &compact_query);
        let terms = split_search_terms(needle_lc);
        let snippet = snippet_for_candidates(text_lc, &terms);
        return Some((count, 900_000 + count, snippet));
    }

    let terms = split_search_terms(needle_lc);
    if terms.len() > 1 {
        let mut matched_terms = Vec::new();
        let mut match_count = 0usize;
        for term in &terms {
            let count = count_occurrences(text_lc, term);
            if count > 0 {
                matched_terms.push(*term);
                match_count = match_count.saturating_add(count);
            }
        }

        let required = (terms.len() * 3).div_ceil(5);
        if matched_terms.len() >= required {
            let snippet = snippet_for_candidates(text_lc, &matched_terms);
            let score = 700_000 + matched_terms.len() * 1_000 + match_count.min(999);
            return Some((match_count.min(MAX_MATCH_COUNT), score, snippet));
        }
    }

    let (matched, total, matched_bigrams) = ordered_bigram_match(&compact_text, &compact_query)?;
    let matched_refs: Vec<&str> = matched_bigrams.iter().map(String::as_str).collect();
    let snippet = snippet_for_candidates(text_lc, &matched_refs);
    let score = 400_000 + matched * 10_000 / total.max(1);
    Some((matched.min(MAX_MATCH_COUNT), score, snippet))
}

/// 在给定会话集合中检索正文。结果按相关性、命中次数排序。
pub fn search_contents(
    items: &[SessionRef],
    query: &str,
    limit: usize,
    mode: SessionSearchMode,
) -> Vec<SessionSearchHit> {
    let needle_lc = query.trim().to_lowercase();
    if needle_lc.is_empty() || items.is_empty() {
        return Vec::new();
    }

    let workers = MAX_WORKERS.min(items.len()).max(1);
    let chunk_size = items.len().div_ceil(workers);
    let mut hits: Vec<SessionSearchHit> = std::thread::scope(|scope| {
        let handles: Vec<_> = items
            .chunks(chunk_size)
            .map(|chunk| {
                let needle = needle_lc.clone();
                scope.spawn(move || {
                    let mut local = Vec::new();
                    for item in chunk {
                        let Some(text_lc) = fresh_text(item) else {
                            continue;
                        };
                        let matched = match mode {
                            SessionSearchMode::Exact => find_exact_matches(&text_lc, &needle)
                                .map(|(count, snippet)| (count, 1_000_000 + count, snippet)),
                            SessionSearchMode::Fuzzy => find_fuzzy_matches(&text_lc, &needle),
                        };
                        if let Some((match_count, score, snippet)) = matched {
                            local.push(SessionSearchHit {
                                provider_id: item.provider_id.clone(),
                                session_id: item.session_id.clone(),
                                source_path: item.source_path.clone(),
                                match_count,
                                score,
                                snippet,
                            });
                        }
                    }
                    local
                })
            })
            .collect();
        handles
            .into_iter()
            .filter_map(|handle| handle.join().ok())
            .flatten()
            .collect()
    });

    hits.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| b.match_count.cmp(&a.match_count))
            .then_with(|| a.session_id.cmp(&b.session_id))
    });
    if limit > 0 && hits.len() > limit {
        hits.truncate(limit);
    }
    hits
}

/// 清掉某个来源的缓存（删除会话时调用，避免命中已删除文件）。
pub fn evict(source_path: &str) {
    if let Ok(mut map) = cache().lock() {
        map.remove(source_path);
    }
}

#[allow(dead_code)]
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_match_finds_chinese_substring_and_counts() {
        let text = "今天我们把星骸解压上线了。\n星骸解压的首页很好看。";
        let (count, snippet) = find_exact_matches(text, "星骸解压").expect("hit");
        assert_eq!(count, 2);
        assert!(snippet.contains("星骸解压"));
        assert!(!snippet.contains('\n'));
    }

    #[test]
    fn snippet_is_trimmed_with_ellipsis() {
        let long = format!("{}关键字{}", "a".repeat(200), "b".repeat(200));
        let (count, snippet) = find_exact_matches(&long, "关键字").expect("hit");
        assert_eq!(count, 1);
        assert!(snippet.starts_with('…'));
        assert!(snippet.ends_with('…'));
        assert!(snippet.chars().count() < 200);
    }

    #[test]
    fn exact_mode_rejects_a_non_contiguous_phrase() {
        assert!(find_exact_matches("修复 会话 搜索", "修复会话").is_none());
    }

    #[test]
    fn fuzzy_mode_ignores_spacing_and_punctuation() {
        let hit = find_fuzzy_matches("修复 会话-搜索失败", "修复会话搜索");
        assert!(hit.is_some());
        assert!(hit.unwrap().1 >= 900_000);
    }

    #[test]
    fn fuzzy_mode_matches_separated_keywords() {
        let hit = find_fuzzy_matches(
            "我们需要修复列表，随后重新实现会话的关键词搜索。",
            "修复 会话 搜索",
        );
        assert!(hit.is_some());
        assert!(hit.unwrap().1 >= 700_000);
    }

    #[test]
    fn fuzzy_mode_tolerates_one_transposed_chinese_pair() {
        let hit = find_fuzzy_matches("会话搜索失败，需要重新建立索引。", "会话搜素失败");
        assert!(hit.is_some());
        assert!(hit.unwrap().1 >= 400_000);
    }

    #[test]
    fn search_contents_reads_codex_file_in_both_modes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("rollout-test.jsonl");
        std::fs::write(
            &path,
            "{\"timestamp\":\"2026-03-06T21:50:12Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"s1\",\"cwd\":\"/tmp\"}}\n\
             {\"timestamp\":\"2026-03-06T21:50:13Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":\"请帮我修复登录页的 Bug\"}}\n",
        )
        .unwrap();
        let items = vec![SessionRef {
            provider_id: "codex".into(),
            session_id: "s1".into(),
            source_path: path.to_string_lossy().to_string(),
        }];

        let exact = search_contents(&items, "登录页", 10, SessionSearchMode::Exact);
        assert_eq!(exact.len(), 1);
        assert_eq!(exact[0].match_count, 1);
        assert!(exact[0].snippet.contains("登录页"));
        assert_eq!(
            search_contents(&items, "BUG", 10, SessionSearchMode::Exact).len(),
            1
        );
        assert!(search_contents(&items, "不存在的词", 10, SessionSearchMode::Fuzzy).is_empty());
    }
}
