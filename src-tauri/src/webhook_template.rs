use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateValidation {
    pub ok: bool,
    pub errors: Vec<String>,
    pub variables: Vec<String>,
    pub blocks: Vec<String>,
    pub rendered: String,
    pub rendered_json_ok: bool,
}

struct Env<'a> {
    event: &'a str,
    context: Option<&'a Value>,
    now_ms: i64,
    current: Option<&'a Value>,
    index: i64,
    count: i64,
}

fn tag_at(rest: &str) -> Option<(usize, usize, &str)> {
    let start = rest.find("{{")?;
    let after = &rest[start + 2..];
    let rel_end = after.find("}}")?;
    let end_exclusive = start + 2 + rel_end;
    Some((
        start,
        end_exclusive + 2,
        rest[start + 2..end_exclusive].trim(),
    ))
}

fn find_matching_close(
    segment: &str,
    open_prefix: &str,
    close_tag: &str,
) -> Option<(usize, usize)> {
    let mut depth = 0i32;
    let mut cursor = 0usize;
    while let Some((start, end, inner)) = tag_at(&segment[cursor..]) {
        let abs_start = cursor + start;
        let abs_end = cursor + end;
        if inner.starts_with(open_prefix) {
            if depth == 0 {
                depth = 1;
            } else {
                depth += 1;
            }
        } else if inner == close_tag {
            if depth == 1 {
                return Some((abs_start, abs_end));
            }
            depth -= 1;
        }
        cursor = abs_end;
    }
    None
}

fn find_top_level_else(segment: &str, close_start: usize) -> Option<usize> {
    let mut depth = 0i32;
    let mut cursor = 0usize;
    while let Some((start, end, inner)) = tag_at(&segment[cursor..]) {
        let abs_start = cursor + start;
        let abs_end = cursor + end;
        if abs_start >= close_start {
            break;
        }
        if inner.starts_with("#if") || inner.starts_with("#each") {
            depth += 1;
        } else if inner == "/if" || inner == "/each" {
            depth -= 1;
        } else if inner == "#else" && depth == 0 {
            return Some(abs_start);
        }
        cursor = abs_end;
    }
    None
}

fn resolve_value(path: &str, env: &Env) -> Value {
    let trimmed = path.trim();
    if trimmed == "this" {
        return env.current.cloned().unwrap_or(Value::Null);
    }
    if trimmed == "@index" {
        return Value::Number(env.index.into());
    }
    if trimmed == "@first" {
        return Value::Bool(env.index == 0);
    }
    if trimmed == "@last" {
        return Value::Bool(env.index + 1 == env.count);
    }
    if let Some(rest) = trimmed.strip_prefix("this.") {
        return env
            .current
            .and_then(|value| get_path(value, rest))
            .unwrap_or(Value::Null);
    }
    if trimmed == "event" {
        return Value::String(env.event.to_string());
    }
    if trimmed == "ts" {
        return Value::String(env.now_ms.to_string());
    }
    if let Some(rest) = trimmed.strip_prefix("context.") {
        return env
            .context
            .and_then(|value| get_path(value, rest))
            .unwrap_or(Value::Null);
    }
    Value::Null
}

fn get_path(value: &Value, path: &str) -> Option<Value> {
    let mut current = value;
    for segment in path.split('.') {
        current = current.get(segment)?;
    }
    Some(current.clone())
}

fn parse_literal(raw: &str) -> Value {
    let raw = raw.trim();
    if let Some(inner) = raw.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
        return Value::String(inner.to_string());
    }
    if let Some(inner) = raw.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')) {
        return Value::String(inner.to_string());
    }
    match raw {
        "true" => return Value::Bool(true),
        "false" => return Value::Bool(false),
        "null" => return Value::Null,
        _ => {}
    }
    if let Ok(number) = raw.parse::<i64>() {
        return Value::Number(number.into());
    }
    if let Ok(number) = raw.parse::<f64>() {
        return Value::Number(
            serde_json::Number::from_f64(number).unwrap_or_else(|| serde_json::Number::from(0)),
        );
    }
    Value::String(raw.to_string())
}

fn find_operator(expr: &str, op: &str) -> Option<usize> {
    let bytes = expr.as_bytes();
    let mut i = 0;
    while i + op.len() <= bytes.len() {
        if &expr[i..i + op.len()] == op {
            return Some(i);
        }
        i += 1;
    }
    None
}

fn compare_values(left: &Value, right: &Value, op: &str) -> bool {
    match op {
        "==" => left == right,
        "!=" => left != right,
        ">" => numeric_cmp(left, right) > 0,
        ">=" => numeric_cmp(left, right) >= 0,
        "<" => numeric_cmp(left, right) < 0,
        "<=" => numeric_cmp(left, right) <= 0,
        _ => false,
    }
}

fn numeric_cmp(left: &Value, right: &Value) -> i64 {
    let left = left.as_f64().unwrap_or(0.0);
    let right = right.as_f64().unwrap_or(0.0);
    if left < right {
        -1
    } else if left > right {
        1
    } else {
        0
    }
}

fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(true) => true,
        Value::Bool(false) => false,
        Value::Number(number) => number.as_f64().map(|n| n != 0.0).unwrap_or(false),
        Value::String(text) => !text.is_empty(),
        Value::Array(items) => !items.is_empty(),
        Value::Object(fields) => !fields.is_empty(),
    }
}

fn eval_if(expr: &str, env: &Env) -> Result<bool, String> {
    let expr = expr.trim();
    for op in ["==", "!=", ">=", "<=", ">", "<"] {
        if let Some(pos) = find_operator(expr, op) {
            let left = expr[..pos].trim();
            let right = expr[pos + op.len()..].trim();
            if left.is_empty() || right.is_empty() {
                return Err(format!("Invalid if expression: {expr}"));
            }
            let left_value = resolve_value(left, env);
            let right_value = parse_literal(right);
            return Ok(compare_values(&left_value, &right_value, op));
        }
    }
    Ok(is_truthy(&resolve_value(expr, env)))
}

fn render_variable(inner: &str, env: &Env, raw: &str) -> String {
    let value = resolve_value(inner, env);
    let known_key = inner == "event"
        || inner == "ts"
        || inner.starts_with("context")
        || inner.starts_with("this");
    if value.is_null() && !known_key {
        raw.to_string()
    } else {
        value.to_string()
    }
}

fn expand(segment: &str, env: &Env, out: &mut String, errors: &mut Vec<String>) {
    let mut rest = segment;
    while let Some((start, end, inner)) = tag_at(rest) {
        out.push_str(&rest[..start]);
        if let Some(expr) = inner.strip_prefix("#if") {
            let close = find_matching_close(rest, "#if", "/if");
            let Some((close_start, close_end)) = close else {
                errors.push(format!("Unclosed #if block at {inner}"));
                out.push_str(&rest[start..]);
                break;
            };
            let body = &rest[end..close_start];
            let else_at = find_top_level_else(body, body.len());
            let (true_body, false_body) = match else_at {
                Some(else_start) => (&body[..else_start], &body[else_start + 9..]),
                None => (body, ""),
            };
            match eval_if(expr, env) {
                Ok(true) => expand(true_body, env, out, errors),
                Ok(false) => expand(false_body, env, out, errors),
                Err(message) => errors.push(message),
            }
            rest = &rest[close_end..];
            continue;
        }
        if let Some(path) = inner.strip_prefix("#each") {
            let close = find_matching_close(rest, "#each", "/each");
            let Some((close_start, close_end)) = close else {
                errors.push(format!("Unclosed #each block at {inner}"));
                out.push_str(&rest[start..]);
                break;
            };
            let body = &rest[end..close_start];
            let items = resolve_value(path, env);
            if let Value::Array(values) = items {
                let count = values.len() as i64;
                for (index, item) in values.iter().enumerate() {
                    let item_env = Env {
                        event: env.event,
                        context: env.context,
                        now_ms: env.now_ms,
                        current: Some(item),
                        index: index as i64,
                        count,
                    };
                    expand(body, &item_env, out, errors);
                }
            }
            rest = &rest[close_end..];
            continue;
        }
        if inner == "#else" || inner == "/if" || inner == "/each" {
            errors.push(format!("Unexpected template tag: {inner}"));
        } else {
            out.push_str(&render_variable(inner, env, &rest[start..end]));
        }
        rest = &rest[end..];
    }
    out.push_str(rest);
}

pub fn render_template(
    template: &str,
    event: &str,
    context: Option<&Value>,
    now_ms: i64,
) -> Result<String, String> {
    let env = Env {
        event,
        context,
        now_ms,
        current: None,
        index: 0,
        count: 1,
    };
    let mut out = String::with_capacity(template.len() + 64);
    let mut errors = Vec::new();
    expand(template, &env, &mut out, &mut errors);
    if errors.is_empty() {
        Ok(out)
    } else {
        Err(errors.join("; "))
    }
}

fn validate_segment(
    segment: &str,
    variables: &mut Vec<String>,
    blocks: &mut Vec<String>,
    errors: &mut Vec<String>,
) {
    let mut rest = segment;
    while let Some((_start, end, inner)) = tag_at(rest) {
        if let Some(expr) = inner.strip_prefix("#if") {
            let close = find_matching_close(rest, "#if", "/if");
            let Some((close_start, close_end)) = close else {
                errors.push(format!("Unclosed #if block at {inner}"));
                return;
            };
            blocks.push(format!("#if {expr}"));
            let body = &rest[end..close_start];
            let else_at = find_top_level_else(body, body.len());
            match else_at {
                Some(else_start) => {
                    validate_segment(&body[..else_start], variables, blocks, errors);
                    validate_segment(&body[else_start + 9..], variables, blocks, errors);
                }
                None => validate_segment(body, variables, blocks, errors),
            }
            rest = &rest[close_end..];
            continue;
        }
        if let Some(path) = inner.strip_prefix("#each") {
            let close = find_matching_close(rest, "#each", "/each");
            let Some((close_start, close_end)) = close else {
                errors.push(format!("Unclosed #each block at {inner}"));
                return;
            };
            blocks.push(format!("#each {path}"));
            validate_segment(&rest[end..close_start], variables, blocks, errors);
            rest = &rest[close_end..];
            continue;
        }
        if inner == "#else" || inner == "/if" || inner == "/each" {
            errors.push(format!("Unexpected template tag: {inner}"));
        } else if !inner.starts_with('#') {
            let variable = inner.to_string();
            if !variables.contains(&variable) {
                variables.push(variable);
            }
        }
        rest = &rest[end..];
    }
}

pub fn validate_template(
    template: &str,
    event: &str,
    context: Option<&Value>,
    now_ms: i64,
) -> TemplateValidation {
    let mut variables = Vec::new();
    let mut blocks = Vec::new();
    let mut errors = Vec::new();
    validate_segment(template, &mut variables, &mut blocks, &mut errors);
    let rendered = match render_template(template, event, context, now_ms) {
        Ok(value) => value,
        Err(message) => {
            errors.push(message);
            template.to_string()
        }
    };
    let rendered_json_ok = if rendered.trim().is_empty() {
        true
    } else {
        serde_json::from_str::<Value>(&rendered).is_ok()
    };
    TemplateValidation {
        ok: errors.is_empty(),
        errors,
        variables,
        blocks,
        rendered,
        rendered_json_ok,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(value: &str) -> Value {
        serde_json::from_str(value).unwrap()
    }

    #[test]
    fn renders_condition_true_branch() {
        let template = r#"{"ok":{{#if context.status == "ready"}}"yes"{{#else}}"no"{{/if}}}"#;
        let value = context(r#"{"status":"ready","items":[1,2]}"#);
        let rendered = render_template(template, "sync.completed", Some(&value), 123).unwrap();
        assert_eq!(rendered, r#"{"ok":"yes"}"#);
    }

    #[test]
    fn renders_condition_false_branch() {
        let template = r#"{"ok":{{#if context.status == "ready"}}"yes"{{#else}}"no"{{/if}}}"#;
        let value = context(r#"{"status":"busy","items":[1,2]}"#);
        let rendered = render_template(template, "sync.completed", Some(&value), 123).unwrap();
        assert_eq!(rendered, r#"{"ok":"no"}"#);
    }

    #[test]
    fn renders_each_loop_with_this_fields() {
        let template = r#"{"items":[{{#each context.items}}{"v":{{this.value}}}{{#if @last}}{{#else}},{{/if}}{{/each}}]}"#;
        let value = context(r#"{"items":[{"value":1},{"value":2}]}"#);
        let rendered = render_template(template, "sync.completed", Some(&value), 123).unwrap();
        assert_eq!(rendered, r#"{"items":[{"v":1},{"v":2}]}"#);
    }

    #[test]
    fn unclosed_block_reports_error() {
        let value = context(r#"{"items":[]}"#);
        let result = render_template("{{#if context.ok}}x", "sync.completed", Some(&value), 1);
        assert!(result.is_err());
    }

    #[test]
    fn validation_collects_variables_and_blocks() {
        let template = r#"{{event}} {{context.note}} {{#if context.ok}}a{{/if}}"#;
        let result = validate_template(template, "sync.completed", None, 1);
        assert!(result.ok);
        assert!(result.variables.contains(&"event".to_string()));
        assert!(result.variables.contains(&"context.note".to_string()));
        assert_eq!(result.blocks.len(), 1);
    }

    #[test]
    fn unknown_variable_stays_untouched() {
        let rendered = render_template("{{unknown.x}}", "sync.completed", None, 1).unwrap();
        assert_eq!(rendered, "{{unknown.x}}");
    }
}
