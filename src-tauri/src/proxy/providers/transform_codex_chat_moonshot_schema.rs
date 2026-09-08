//! Moonshot / Kimi Chat Completions schema compatibility for the Codex bridge.
//!
//! Moonshot's Chat Completions endpoint (`api.moonshot.cn`, `api.moonshot.ai`
//! and the Kimi For Coding endpoint `api.kimi.com`) validates
//! `tools[].function.parameters` with a pre-2019-09 reading of JSON Schema: an
//! object that carries `$ref` together with any sibling keyword is rejected with
//! HTTP 400. The equivalent draft-07 form moves `$ref` into `allOf` while
//! preserving every sibling keyword.
//!
//! Scope is deliberately narrow: only Responses → Chat requests whose resolved
//! upstream host is Moonshot/Kimi are rewritten. Other providers keep
//! byte-identical tool schemas so their prompt-cache prefixes are unaffected.

use serde_json::{json, Map, Value};
use url::Url;

const MOONSHOT_HOST_SUFFIXES: &[&str] = &["moonshot.cn", "moonshot.ai", "kimi.com"];

const SINGLE_SCHEMA_KEYWORDS: &[&str] = &[
    "items",
    "additionalItems",
    "unevaluatedItems",
    "contains",
    "additionalProperties",
    "unevaluatedProperties",
    "propertyNames",
    "not",
    "if",
    "then",
    "else",
    "contentSchema",
];

const SCHEMA_ARRAY_KEYWORDS: &[&str] = &["allOf", "anyOf", "oneOf", "prefixItems"];

const SCHEMA_MAP_KEYWORDS: &[&str] = &[
    "properties",
    "patternProperties",
    "$defs",
    "definitions",
    "dependentSchemas",
    "dependencies",
];

/// Whether the resolved upstream points at a Moonshot or Kimi host.
pub fn upstream_requires_ref_sibling_all_of(base_url: &str) -> bool {
    let Ok(url) = Url::parse(base_url.trim()) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.to_ascii_lowercase();
    MOONSHOT_HOST_SUFFIXES.iter().any(|suffix| {
        host == *suffix
            || host
                .strip_suffix(suffix)
                .is_some_and(|prefix| prefix.ends_with('.'))
    })
}

/// Rewrite `$ref`-with-siblings nodes inside Chat function-tool parameters.
pub fn wrap_ref_siblings_in_chat_tools(chat_body: &mut Value) -> usize {
    let Some(tools) = chat_body.get_mut("tools").and_then(Value::as_array_mut) else {
        return 0;
    };
    let mut changed = 0;
    for tool in tools.iter_mut() {
        let Some(parameters) = tool
            .get_mut("function")
            .and_then(|function| function.get_mut("parameters"))
        else {
            continue;
        };
        if wrap_ref_siblings(parameters) > 0 {
            changed += 1;
        }
    }
    changed
}

/// Move every schema `$ref` with siblings into an equivalent `allOf` branch.
pub fn wrap_ref_siblings(schema: &mut Value) -> usize {
    let Value::Object(map) = schema else {
        return 0;
    };
    let mut rewritten = 0;
    if map.len() > 1 && map.get("$ref").is_some_and(Value::is_string) {
        move_ref_into_all_of(map);
        rewritten += 1;
    }
    for (key, child) in map.iter_mut() {
        let key = key.as_str();
        if SCHEMA_MAP_KEYWORDS.contains(&key) {
            if let Value::Object(entries) = child {
                rewritten += entries.values_mut().map(wrap_ref_siblings).sum::<usize>();
            }
        } else if SCHEMA_ARRAY_KEYWORDS.contains(&key) {
            if let Value::Array(entries) = child {
                rewritten += entries.iter_mut().map(wrap_ref_siblings).sum::<usize>();
            }
        } else if SINGLE_SCHEMA_KEYWORDS.contains(&key) {
            match child {
                Value::Array(entries) => {
                    rewritten += entries.iter_mut().map(wrap_ref_siblings).sum::<usize>();
                }
                other => rewritten += wrap_ref_siblings(other),
            }
        }
    }
    rewritten
}

fn move_ref_into_all_of(map: &mut Map<String, Value>) {
    let Some(reference) = map.remove("$ref") else {
        return;
    };
    let branch = json!({ "$ref": reference });
    match map.get_mut("allOf") {
        Some(Value::Array(branches)) => branches.push(branch),
        _ => {
            map.insert("allOf".to_string(), Value::Array(vec![branch]));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn desktop_like_schema() -> Value {
        json!({
            "type": "object",
            "properties": {
                "prompt": { "$ref": "#/$defs/__schema20", "description": "Prompt to run" },
                "mode": { "type": "string", "enum": ["fast", "slow"] }
            },
            "required": ["prompt"],
            "$defs": {
                "__schema20": { "$ref": "#/$defs/__schema2", "type": "string", "minLength": 1 },
                "__schema2": { "type": "string" }
            }
        })
    }

    fn has_ref_with_siblings(value: &Value) -> bool {
        match value {
            Value::Object(map) => {
                (map.len() > 1 && map.contains_key("$ref"))
                    || map.values().any(has_ref_with_siblings)
            }
            Value::Array(items) => items.iter().any(has_ref_with_siblings),
            _ => false,
        }
    }

    #[test]
    fn gate_matches_moonshot_and_kimi_hosts_only() {
        for url in [
            "https://api.moonshot.cn/v1",
            "https://api.moonshot.ai/v1/",
            "https://api.kimi.com/coding/v1",
            "https://API.KIMI.COM/coding/v1",
        ] {
            assert!(upstream_requires_ref_sibling_all_of(url), "{url}");
        }
        for url in [
            "https://api.openai.com/v1",
            "https://api.x.ai/v1",
            "https://kimi-relay.example.com/v1",
            "https://api.kimi.com.evil.net/v1",
            "api.moonshot.cn/v1",
        ] {
            assert!(!upstream_requires_ref_sibling_all_of(url), "{url}");
        }
    }

    #[test]
    fn wraps_ref_siblings_in_properties_and_defs() {
        let mut schema = desktop_like_schema();
        assert_eq!(wrap_ref_siblings(&mut schema), 2);
        assert_eq!(
            schema["properties"]["prompt"],
            json!({
                "description": "Prompt to run",
                "allOf": [{ "$ref": "#/$defs/__schema20" }]
            })
        );
        assert_eq!(
            schema["$defs"]["__schema20"],
            json!({
                "type": "string",
                "minLength": 1,
                "allOf": [{ "$ref": "#/$defs/__schema2" }]
            })
        );
        assert!(!has_ref_with_siblings(&schema));
        let once = schema.clone();
        assert_eq!(wrap_ref_siblings(&mut schema), 0);
        assert_eq!(schema, once);
    }

    #[test]
    fn preserves_data_values_and_unknown_keywords() {
        let original = json!({
            "type": "object",
            "properties": {
                "cfg": {
                    "type": "object",
                    "default": { "$ref": "literal", "note": "data" }
                }
            },
            "x-metadata": { "$ref": "literal", "note": "extension" }
        });
        let mut schema = original.clone();
        assert_eq!(wrap_ref_siblings(&mut schema), 0);
        assert_eq!(schema, original);
    }

    #[test]
    fn chat_helper_only_rewrites_function_tool_parameters() {
        let mut body = json!({
            "model": "k3",
            "tools": [
                { "type": "function", "function": { "name": "desktop", "parameters": desktop_like_schema() } },
                { "type": "web_search" }
            ]
        });
        assert_eq!(wrap_ref_siblings_in_chat_tools(&mut body), 1);
        assert!(!has_ref_with_siblings(
            &body["tools"][0]["function"]["parameters"]
        ));
        assert_eq!(body["tools"][1], json!({ "type": "web_search" }));
    }

    #[test]
    fn bare_refs_and_ref_free_schemas_are_untouched() {
        let original = json!({
            "type": "object",
            "properties": {
                "a": { "$ref": "#/$defs/A" },
                "b": { "type": "integer", "minimum": 0 }
            },
            "$defs": { "A": { "type": "string" } }
        });
        let mut schema = original.clone();
        assert_eq!(wrap_ref_siblings(&mut schema), 0);
        assert_eq!(schema, original);

        let original = json!({ "type": "object", "properties": { "a": { "type": "string" } } });
        let mut schema = original.clone();
        assert_eq!(wrap_ref_siblings(&mut schema), 0);
        assert_eq!(schema, original);
    }

    #[test]
    fn appends_ref_to_existing_all_of() {
        let mut schema = json!({
            "allOf": [{ "type": "string" }],
            "$ref": "#/$defs/A",
            "description": "d"
        });
        assert_eq!(wrap_ref_siblings(&mut schema), 1);
        assert_eq!(
            schema,
            json!({
                "allOf": [{ "type": "string" }, { "$ref": "#/$defs/A" }],
                "description": "d"
            })
        );
    }

    #[test]
    fn root_ref_keeps_type_and_defs() {
        let mut schema = json!({
            "type": "object",
            "$ref": "#/$defs/Root",
            "$defs": { "Root": { "properties": { "a": { "type": "string" } } } }
        });
        assert_eq!(wrap_ref_siblings(&mut schema), 1);
        assert_eq!(
            schema,
            json!({
                "type": "object",
                "$defs": { "Root": { "properties": { "a": { "type": "string" } } } },
                "allOf": [{ "$ref": "#/$defs/Root" }]
            })
        );
    }

    #[test]
    fn covers_every_schema_valued_keyword() {
        let node = || json!({ "$ref": "#/$defs/A", "description": "d" });
        let mut schema = json!({
            "type": "object",
            "properties": { "p": node() },
            "patternProperties": { "^x": node() },
            "additionalProperties": node(),
            "unevaluatedProperties": node(),
            "propertyNames": node(),
            "dependentSchemas": { "p": node() },
            "dependencies": { "p": node(), "q": ["p"] },
            "items": node(),
            "prefixItems": [node()],
            "contains": node(),
            "not": node(),
            "if": node(),
            "then": node(),
            "else": node(),
            "allOf": [node()],
            "anyOf": [node()],
            "oneOf": [node()],
            "$defs": { "A": { "type": "string" }, "B": node() },
            "definitions": { "C": node() }
        });
        assert_eq!(wrap_ref_siblings(&mut schema), 19);
        assert!(!has_ref_with_siblings(&schema));
        assert_eq!(schema["dependencies"]["q"], json!(["p"]));

        // Draft-07 tuple form of `items`.
        let mut tuple = json!({ "type": "array", "items": [node(), { "type": "string" }] });
        assert_eq!(wrap_ref_siblings(&mut tuple), 1);
        assert!(!has_ref_with_siblings(&tuple));
    }

    #[test]
    fn rewrite_is_idempotent() {
        let mut once = desktop_like_schema();
        wrap_ref_siblings(&mut once);
        let mut twice = once.clone();
        assert_eq!(wrap_ref_siblings(&mut twice), 0);
        assert_eq!(twice, once);
    }
}
