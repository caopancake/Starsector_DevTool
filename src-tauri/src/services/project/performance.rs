use std::time::Instant;

#[derive(Debug, Clone)]
pub(crate) struct PerformanceTrace {
    name: &'static str,
    started_at: Instant,
    stages: Vec<PerformanceStage>,
}

/// One structured performance record: the trace total or a single stage.
#[derive(Debug, Clone)]
pub(crate) struct PerformanceLogEntry {
    pub(crate) stage: String,
    pub(crate) ms: u128,
    pub(crate) fields: Vec<(String, String)>,
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

    pub(crate) fn name(&self) -> &'static str {
        self.name
    }

    pub(crate) fn log_entries(&self, root_fields: &[(&str, String)]) -> Vec<PerformanceLogEntry> {
        let mut entries = vec![PerformanceLogEntry {
            stage: "total".to_string(),
            ms: self.started_at.elapsed().as_millis(),
            fields: root_fields
                .iter()
                .map(|(key, value)| (key.to_string(), sanitize_value(value)))
                .collect(),
        }];
        for stage in &self.stages {
            entries.push(PerformanceLogEntry {
                stage: stage.name.clone(),
                ms: stage.ms,
                fields: stage.fields.clone(),
            });
        }
        entries
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

        let entries = trace.log_entries(&[("modRoot", "D:/Mod".to_string())]);

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].stage, "total");
        assert_eq!(
            entries[0].fields,
            vec![("modRoot".to_string(), "D:/Mod".to_string())]
        );
        assert_eq!(entries[1].stage, "csv_tables");
        assert_eq!(entries[1].fields.len(), 2);
        assert_eq!(trace.name(), "project.load");
    }
}
