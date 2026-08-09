use chrono::{Datelike, Local, Timelike};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
enum Token {
    Atom(String),
    Str(String),
    Eq,
    Ne,
    Gt,
    Ge,
    Lt,
    Le,
    LParen,
    RParen,
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = input.chars().collect();
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
            continue;
        }
        if c == '(' {
            tokens.push(Token::LParen);
            i += 1;
            continue;
        }
        if c == ')' {
            tokens.push(Token::RParen);
            i += 1;
            continue;
        }
        let two: String = chars[i..].iter().take(2).collect();
        let op = match two.as_str() {
            "==" => Some(Token::Eq),
            "!=" => Some(Token::Ne),
            ">=" => Some(Token::Ge),
            "<=" => Some(Token::Le),
            _ => None,
        };
        if let Some(op) = op {
            tokens.push(op);
            i += 2;
            continue;
        }
        match c {
            '>' => {
                tokens.push(Token::Gt);
                i += 1;
                continue;
            }
            '<' => {
                tokens.push(Token::Lt);
                i += 1;
                continue;
            }
            '"' | '\'' => {
                let quote = c;
                let mut value = String::new();
                let mut j = i + 1;
                let mut closed = false;
                while j < chars.len() {
                    let ch = chars[j];
                    if ch == '\\' && j + 1 < chars.len() {
                        value.push(chars[j + 1]);
                        j += 2;
                        continue;
                    }
                    if ch == quote {
                        closed = true;
                        break;
                    }
                    value.push(ch);
                    j += 1;
                }
                if !closed {
                    return Err("Unterminated string literal".to_string());
                }
                tokens.push(Token::Str(value));
                i = j + 1;
                continue;
            }
            _ => {}
        }
        let start = i;
        while i < chars.len() {
            let ch = chars[i];
            if ch.is_whitespace()
                || ch == '('
                || ch == ')'
                || ch == '"'
                || ch == '\''
                || "=!<>".contains(ch)
            {
                break;
            }
            i += 1;
        }
        if i == start {
            return Err(format!("Unexpected character '{}'", c));
        }
        tokens.push(Token::Atom(chars[start..i].iter().collect()));
    }
    Ok(tokens)
}

#[derive(Clone, Debug)]
enum Expr {
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Not(Box<Expr>),
    Compare {
        path: String,
        op: CompareOp,
        value: Value,
    },
    EventShorthand(String),
    Cron(String),
    Bool(bool),
}

#[derive(Clone, Copy, Debug)]
enum CompareOp {
    Eq,
    Ne,
    Gt,
    Ge,
    Lt,
    Le,
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn next(&mut self) -> Option<Token> {
        let token = self.tokens.get(self.pos).cloned();
        if token.is_some() {
            self.pos += 1;
        }
        token
    }

    fn parse_condition(&mut self) -> Result<Expr, String> {
        let expr = self.parse_or()?;
        if self.pos != self.tokens.len() {
            return Err("Unexpected token at end of condition".to_string());
        }
        Ok(expr)
    }

    fn parse_or(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_and()?;
        while self.is_keyword("or") {
            self.next();
            let right = self.parse_and()?;
            left = Expr::Or(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_not()?;
        while self.is_keyword("and") {
            self.next();
            let right = self.parse_not()?;
            left = Expr::And(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_not(&mut self) -> Result<Expr, String> {
        if self.is_keyword("not") {
            self.next();
            let inner = self.parse_not()?;
            return Ok(Expr::Not(Box::new(inner)));
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Result<Expr, String> {
        match self.next() {
            Some(Token::LParen) => {
                let inner = self.parse_or()?;
                match self.next() {
                    Some(Token::RParen) => Ok(inner),
                    _ => Err("Expected ')'".to_string()),
                }
            }
            Some(Token::Atom(keyword)) if keyword == "true" => Ok(Expr::Bool(true)),
            Some(Token::Atom(keyword)) if keyword == "false" => Ok(Expr::Bool(false)),
            Some(Token::Atom(keyword)) if keyword == "cron" => {
                if !matches!(self.next(), Some(Token::LParen)) {
                    return Err("Expected '(' after cron".to_string());
                }
                let mut fields = Vec::new();
                loop {
                    match self.next() {
                        Some(Token::Atom(field)) => fields.push(field),
                        Some(Token::RParen) => break,
                        _ => return Err("Expected cron fields or ')'".to_string()),
                    }
                }
                let expr = fields.join(" ");
                if expr.trim().is_empty() || !cron_is_valid(&expr) {
                    return Err(format!("Invalid cron expression '{}'", expr));
                }
                Ok(Expr::Cron(expr))
            }
            Some(Token::Atom(path)) => self.parse_atom_expr(path),
            Some(Token::Str(value)) => Err(format!(
                "Unexpected string literal '{}'; expected a comparison like event == \"...\"",
                value
            )),
            _ => Err("Expected condition".to_string()),
        }
    }

    fn parse_atom_expr(&mut self, path: String) -> Result<Expr, String> {
        let op = match self.peek() {
            Some(Token::Eq) => CompareOp::Eq,
            Some(Token::Ne) => CompareOp::Ne,
            Some(Token::Gt) => CompareOp::Gt,
            Some(Token::Ge) => CompareOp::Ge,
            Some(Token::Lt) => CompareOp::Lt,
            Some(Token::Le) => CompareOp::Le,
            _ => {
                return Ok(Expr::EventShorthand(path));
            }
        };
        self.next();
        let value = match self.next() {
            Some(Token::Atom(atom)) => parse_literal(&atom),
            Some(Token::Str(text)) => Value::String(text),
            _ => return Err(format!("Expected comparison value after '{}'", path)),
        };
        Ok(Expr::Compare { path, op, value })
    }

    fn is_keyword(&self, keyword: &str) -> bool {
        matches!(self.peek(), Some(Token::Atom(atom)) if atom == keyword)
    }
}

fn parse_literal(atom: &str) -> Value {
    if atom == "true" {
        return Value::Bool(true);
    }
    if atom == "false" {
        return Value::Bool(false);
    }
    if atom == "null" {
        return Value::Null;
    }
    if let Ok(number) = atom.parse::<f64>() {
        return Value::from(number);
    }
    Value::String(atom.to_string())
}

fn resolve_path(path: &str, event: &str, context: Option<&Value>) -> Value {
    if path == "event" {
        return Value::String(event.to_string());
    }
    if path == "context" {
        return context.cloned().unwrap_or(Value::Null);
    }
    let Some(rest) = path.strip_prefix("context.") else {
        return Value::Null;
    };
    let mut current = context.cloned().unwrap_or(Value::Null);
    for part in rest.split('.') {
        current = match current {
            Value::Object(map) => map.get(part).cloned().unwrap_or(Value::Null),
            Value::Array(items) => items
                .get(part.parse::<usize>().unwrap_or(usize::MAX))
                .cloned()
                .unwrap_or(Value::Null),
            _ => Value::Null,
        };
    }
    current
}

fn values_equal(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Bool(a), Value::Bool(b)) => a == b,
        (Value::Null, Value::Null) => true,
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::String(a), Value::String(b)) => a == b,
        _ => false,
    }
}

fn numeric_value(value: &Value) -> Option<f64> {
    value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|text| text.trim().parse::<f64>().ok())
    })
}

fn compare_values(left: &Value, op: CompareOp, right: &Value) -> bool {
    match op {
        CompareOp::Eq => values_equal(left, right),
        CompareOp::Ne => !values_equal(left, right),
        CompareOp::Gt | CompareOp::Ge | CompareOp::Lt | CompareOp::Le => {
            let (Some(a), Some(b)) = (numeric_value(left), numeric_value(right)) else {
                return false;
            };
            match op {
                CompareOp::Gt => a > b,
                CompareOp::Ge => a >= b,
                CompareOp::Lt => a < b,
                CompareOp::Le => a <= b,
                _ => false,
            }
        }
    }
}

fn eval_expr(
    expr: &Expr,
    event: &str,
    context: Option<&Value>,
    now: &chrono::DateTime<Local>,
) -> bool {
    match expr {
        Expr::And(left, right) => {
            eval_expr(left, event, context, now) && eval_expr(right, event, context, now)
        }
        Expr::Or(left, right) => {
            eval_expr(left, event, context, now) || eval_expr(right, event, context, now)
        }
        Expr::Not(inner) => !eval_expr(inner, event, context, now),
        Expr::Bool(value) => *value,
        Expr::Cron(expr) => matches_cron(expr, now),
        Expr::EventShorthand(name) => event == name,
        Expr::Compare { path, op, value } => {
            let left = resolve_path(path, event, context);
            compare_values(&left, *op, value)
        }
    }
}

pub fn validate_condition(condition: &str) -> Result<(), String> {
    let trimmed = condition.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let tokens = tokenize(trimmed)?;
    if tokens.is_empty() {
        return Err("Empty condition".to_string());
    }
    let mut parser = Parser { tokens, pos: 0 };
    parser.parse_condition()?;
    Ok(())
}

pub fn matches_condition(
    condition: &str,
    event: &str,
    context: Option<&Value>,
    now: &chrono::DateTime<Local>,
) -> bool {
    let trimmed = condition.trim();
    if trimmed.is_empty() {
        return true;
    }
    let Ok(tokens) = tokenize(trimmed) else {
        return false;
    };
    let mut parser = Parser { tokens, pos: 0 };
    let Ok(expr) = parser.parse_condition() else {
        return false;
    };
    eval_expr(&expr, event, context, now)
}

fn cron_field_matches(spec: &str, value: i32, min: i32, max: i32) -> bool {
    for part in spec.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let (range, step) = match part.split_once('/') {
            Some((range, step)) => (range, step.parse::<i32>().unwrap_or(1).max(1)),
            None => (part, 1),
        };
        let (start, end) = match range.split_once('-') {
            Some((start, end)) => {
                let Ok(start) = start.parse::<i32>() else {
                    continue;
                };
                let Ok(end) = end.parse::<i32>() else {
                    continue;
                };
                (start, end)
            }
            None => {
                if range == "*" {
                    (min, max)
                } else {
                    let Ok(value) = range.parse::<i32>() else {
                        continue;
                    };
                    if step > 1 {
                        (value, max)
                    } else {
                        (value, value)
                    }
                }
            }
        };
        let start = start.max(min);
        let end = end.min(max).max(start);
        if (start..=end).contains(&value) && (value - start) % step == 0 {
            return true;
        }
    }
    false
}

fn cron_is_valid(expr: &str) -> bool {
    let fields: Vec<&str> = expr.split_whitespace().collect();
    if fields.len() != 5 {
        return false;
    }
    let checks = [
        (fields[0], 0, 59),
        (fields[1], 0, 23),
        (fields[2], 1, 31),
        (fields[3], 1, 12),
        (fields[4], 0, 7),
    ];
    checks.iter().all(|(field, min, max)| {
        field.split(',').all(|part| {
            let part = part.trim();
            let (range, step) = match part.split_once('/') {
                Some((range, step)) => (range, step.parse::<i32>().is_ok()),
                None => (part, true),
            };
            if !step {
                return false;
            }
            if range == "*" {
                return true;
            }
            range.split_once('-').map_or_else(
                || {
                    range
                        .parse::<i32>()
                        .is_ok_and(|v| (*min..=*max).contains(&v))
                },
                |(start, end)| {
                    start
                        .parse::<i32>()
                        .ok()
                        .zip(end.parse::<i32>().ok())
                        .is_some_and(|(a, b)| {
                            (*min..=*max).contains(&a) && (*min..=*max).contains(&b) && a <= b
                        })
                },
            )
        })
    })
}

pub fn matches_cron(expr: &str, now: &chrono::DateTime<Local>) -> bool {
    let fields: Vec<&str> = expr.split_whitespace().collect();
    if fields.len() != 5 || !cron_is_valid(expr) {
        return false;
    }
    let minute = now.minute() as i32;
    let hour = now.hour() as i32;
    let day = now.day() as i32;
    let month = now.month() as i32;
    let mut dow = now.weekday().num_days_from_sunday() as i32;
    if dow == 7 {
        dow = 0;
    }
    let dow_spec = if fields[4] == "7" { "0" } else { fields[4] };
    let dom_matches = cron_field_matches(fields[2], day, 1, 31);
    let dow_matches = cron_field_matches(dow_spec, dow, 0, 7);
    let day_ok = if fields[2] != "*" && fields[4] != "*" {
        dom_matches || dow_matches
    } else {
        dom_matches && dow_matches
    };
    cron_field_matches(fields[0], minute, 0, 59)
        && cron_field_matches(fields[1], hour, 0, 23)
        && day_ok
        && cron_field_matches(fields[3], month, 1, 12)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn dt(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> chrono::DateTime<Local> {
        Local
            .with_ymd_and_hms(year, month, day, hour, minute, 0)
            .single()
            .expect("valid local time")
    }

    #[test]
    fn cron_matches_minute_hour_weekday() {
        let now = dt(2026, 8, 3, 9, 0); // Monday
        assert!(matches_cron("0 9 * * 1-5", &now));
        assert!(!matches_cron("0 10 * * 1-5", &now));
        assert!(!matches_cron("30 9 * * 1-5", &now));
        assert!(!matches_cron("0 9 * * 0,6", &now));
    }

    #[test]
    fn cron_supports_steps_and_lists() {
        let now = dt(2026, 8, 3, 10, 15);
        assert!(matches_cron("*/15 10 * * 1", &now));
        assert!(matches_cron("5,15,25 10 * * 1", &now));
        assert!(!matches_cron("*/30 10 * * 1", &now));
    }

    #[test]
    fn cron_day_and_weekday_both_restricted_use_or() {
        let wednesday_15th = dt(2026, 7, 15, 8, 0); // 2026-07-15 is a Wednesday
        assert!(matches_cron("0 8 15 * 1", &wednesday_15th));
        assert!(matches_cron("0 8 20 * 3", &wednesday_15th));
        assert!(!matches_cron("0 8 20 * 4", &wednesday_15th));
    }

    #[test]
    fn condition_event_and_context_matching() {
        let now = Local::now();
        let context = serde_json::json!({ "status": "ok", "files": 3 });
        assert!(matches_condition(
            r#"event == "sync.completed" and context.status == "ok""#,
            "sync.completed",
            Some(&context),
            &now,
        ));
        assert!(matches_condition(
            "context.files >= 3",
            "sync.completed",
            Some(&context),
            &now,
        ));
        assert!(!matches_condition(
            r#"event == "sync.failed" or context.status == "error""#,
            "sync.completed",
            Some(&context),
            &now,
        ));
    }

    #[test]
    fn condition_not_and_shorthand() {
        let now = Local::now();
        let context = serde_json::json!({ "mode": "night" });
        assert!(matches_condition(
            "not context.mode == \"day\"",
            "clipboard.captured",
            Some(&context),
            &now,
        ));
        assert!(matches_condition(
            "sync.completed",
            "sync.completed",
            Some(&context),
            &now,
        ));
        assert!(!matches_condition(
            "sync.failed",
            "sync.completed",
            Some(&context),
            &now,
        ));
    }

    #[test]
    fn invalid_condition_is_rejected_and_safe() {
        assert!(validate_condition("event == \"a\" and").is_err());
        assert!(validate_condition("cron(bad)").is_err());
        assert!(validate_condition("").is_ok());
        assert!(!matches_condition(
            "event == \"a\" and",
            "a",
            None,
            &Local::now(),
        ));
    }
}
