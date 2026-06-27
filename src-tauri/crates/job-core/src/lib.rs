use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub id: JobId,
    pub title: String,
    pub status: JobStatus,
    pub progress: JobProgress,
    pub cancellable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobId(String);

impl JobId {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub current: u64,
    pub total: Option<u64>,
    pub message: String,
}

impl JobProgress {
    pub fn queued() -> Self {
        Self {
            current: 0,
            total: None,
            message: "Queued".to_owned(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Job {
    snapshot: JobSnapshot,
    cancel_token: CancellationToken,
}

impl Job {
    pub fn new(id: JobId, title: impl Into<String>, cancellable: bool) -> Self {
        Self {
            snapshot: JobSnapshot {
                id,
                title: title.into(),
                status: JobStatus::Queued,
                progress: JobProgress::queued(),
                cancellable,
            },
            cancel_token: CancellationToken::default(),
        }
    }

    pub fn snapshot(&self) -> JobSnapshot {
        self.snapshot.clone()
    }

    pub fn start(&mut self) {
        self.snapshot.status = JobStatus::Running;
    }

    pub fn update_progress(
        &mut self,
        current: u64,
        total: Option<u64>,
        message: impl Into<String>,
    ) {
        self.snapshot.progress = JobProgress {
            current,
            total,
            message: message.into(),
        };
    }

    pub fn complete(&mut self) {
        self.snapshot.status = JobStatus::Completed;
    }

    pub fn fail(&mut self, message: impl Into<String>) {
        self.snapshot.status = JobStatus::Failed;
        self.snapshot.progress.message = message.into();
    }

    pub fn cancel(&mut self) {
        if !self.snapshot.cancellable {
            return;
        }

        self.cancel_token.cancel();
        self.snapshot.status = JobStatus::Cancelled;
    }

    pub fn cancel_token(&self) -> CancellationToken {
        self.cancel_token.clone()
    }
}

#[derive(Debug, Clone, Default)]
pub struct CancellationToken {
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl CancellationToken {
    pub fn cancel(&self) {
        self.cancelled
            .store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(std::sync::atomic::Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_tracks_status_progress_and_cancellation() {
        let mut job = Job::new(JobId::new("scan-1"), "Scan folder", true);
        let token = job.cancel_token();

        assert_eq!(job.snapshot().status, JobStatus::Queued);

        job.start();
        job.update_progress(4, Some(10), "Scanning");

        assert_eq!(job.snapshot().status, JobStatus::Running);
        assert_eq!(job.snapshot().progress.current, 4);
        assert_eq!(job.snapshot().progress.total, Some(10));

        job.cancel();

        assert_eq!(job.snapshot().status, JobStatus::Cancelled);
        assert!(token.is_cancelled());
    }

    #[test]
    fn non_cancellable_job_ignores_cancel_requests() {
        let mut job = Job::new(JobId::new("report-1"), "Generate report", false);
        let token = job.cancel_token();

        job.start();
        job.cancel();

        assert_eq!(job.snapshot().status, JobStatus::Running);
        assert!(!token.is_cancelled());
    }
}
