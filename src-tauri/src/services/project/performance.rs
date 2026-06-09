use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub(crate) struct PerformanceTrace {
    name: &'static str,
    started_at: Instant,
    stages: Vec<PerformanceStage>,
}

#[derive(Debug, Clone)]
struct PerformanceStage {
    fields: Vec<(String, String)>,
    ms: u128,
    name: String,
}

#[derive(Debug, Clone)]
pub(crate) struct PerformanceTimer {
    started_at: Instant,
}

impl PerformanceTrace {
    pub(crate) fn new(name: &'static str) -> Self {
        Self {
            name,
            started_at: Instant::now(),
            stages: Vec::new(),
        }
    }

    pub(crate) fn timer(&self) -> PerformanceTimer {
        PerformanceTimer::start()
    }

    pub(crate) fn record_stage(
        &mut self,
        name: &'static str,
        timer: PerformanceTimer,
        fields: impl IntoIterator<Item = (&'static str, String)>,
    ) {
        self.stages.push(PerformanceStage {
            fields: fields
                .into_iter()
                .map(|(key, value)| (key.to_string(), sanitize_value(value)))
                .collect(),
            ms: timer.elapsed_ms(),
            name: name.to_string(),
        });
    }

    pub(crate) fn log_messages(&self, root_fields: &[(&str, String)]) -> Vec<String> {
        let mut messages = vec![render_message(
            self.name,
            self.started_at.elapsed(),
            "total",
            root_fields,
        )];
        for stage in &self.stages {
            let fields = stage
                .fields
                .iter()
                .map(|(key, value)| (key.as_str(), value.clone()))
                .collect::<Vec<_>>();
            messages.push(render_stage_message(
                self.name,
                &stage.name,
                stage.ms,
                &fields,
            ));
        }
        messages
    }
}

impl PerformanceTimer {
    pub(crate) fn start() -> Self {
        Self {
            started_at: Instant::now(),
        }
    }

    pub(crate) fn elapsed_ms(&self) -> u128 {
        self.started_at.elapsed().as_millis()
    }
}

fn render_message(
    trace_name: &str,
    elapsed: Duration,
    stage_name: &str,
    fields: &[(&str, String)],
) -> String {
    let mut message = format!(
        "PERF {trace_name} stage={stage_name} ms={}",
        elapsed.as_millis()
    );
    append_fields(&mut message, fields);
    message
}

fn render_stage_message(
    trace_name: &str,
    stage_name: &str,
    ms: u128,
    fields: &[(&str, String)],
) -> String {
    let mut message = format!("PERF {trace_name}.stage name={stage_name} ms={ms}");
    append_fields(&mut message, fields);
    message
}

fn append_fields(message: &mut String, fields: &[(&str, String)]) {
    for (key, value) in fields {
        message.push(' ');
        message.push_str(key);
        message.push('=');
        message.push_str(&sanitize_value(value));
    }
}

fn sanitize_value(value: impl AsRef<str>) -> String {
    value
        .as_ref()
        .replace(['\r', '\n', '\t'], " ")
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn performance_trace_renders_total_and_stages() {
        let mut trace = PerformanceTrace::new("project.load");
        let timer = trace.timer();
        trace.record_stage(
            "csv_tables",
            timer,
            [
                ("rows", "12".to_string()),
                ("modRoot", "D:/Mod".to_string()),
            ],
        );

        let messages = trace.log_messages(&[("modRoot", "D:/Mod".to_string())]);

        assert_eq!(messages.len(), 2);
        assert!(messages[0].starts_with("PERF project.load stage=total ms="));
        assert!(messages[0].contains("modRoot=D:/Mod"));
        assert!(messages[1].starts_with("PERF project.load.stage name=csv_tables ms="));
        assert!(messages[1].contains("rows=12"));
    }
}
