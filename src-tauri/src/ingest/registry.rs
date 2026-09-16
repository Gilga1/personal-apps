use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tokio::process::Child;

#[derive(Default)]
pub struct IngestJobRegistry {
    children: Mutex<HashMap<String, Arc<Mutex<Option<Child>>>>>,
    cancelled: Mutex<HashSet<String>>,
}

impl IngestJobRegistry {
    pub fn begin(&self, job_id: &str) -> Arc<Mutex<Option<Child>>> {
        let slot = Arc::new(Mutex::new(None));
        self.children
            .lock()
            .unwrap()
            .insert(job_id.to_string(), slot.clone());
        self.cancelled.lock().unwrap().remove(job_id);
        slot
    }

    pub fn store_child(&self, job_id: &str, mut child: Child) {
        if self.is_cancelled(job_id) {
            let _ = child.start_kill();
            return;
        }
        if let Some(slot) = self.children.lock().unwrap().get(job_id) {
            *slot.lock().unwrap() = Some(child);
        }
    }

    pub fn is_cancelled(&self, job_id: &str) -> bool {
        self.cancelled.lock().unwrap().contains(job_id)
    }

    pub fn cancel(&self, job_id: &str) -> bool {
        self.cancelled.lock().unwrap().insert(job_id.to_string());
        if let Some(slot) = self.children.lock().unwrap().get(job_id) {
            if let Some(mut child) = slot.lock().unwrap().take() {
                let _ = child.start_kill();
            }
        }
        true
    }

    pub async fn wait_child(
        &self,
        job_id: &str,
    ) -> Result<std::process::ExitStatus, String> {
        let slot = self
            .children
            .lock()
            .unwrap()
            .get(job_id)
            .cloned();
        if let Some(slot) = slot {
            let child = slot.lock().unwrap().take();
            if let Some(mut child) = child {
                return child.wait().await.map_err(|e| e.to_string());
            }
        }
        Err("No active download process".to_string())
    }

    pub fn finish(&self, job_id: &str) {
        self.children.lock().unwrap().remove(job_id);
        self.cancelled.lock().unwrap().remove(job_id);
    }
}
