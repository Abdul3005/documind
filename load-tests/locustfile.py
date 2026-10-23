"""
DocuMind V2 - Load & Performance Benchmark Suite (Week 7)
Uses Locust to test API throughput, latency distribution (p50, p95, p99),
error rates, and concurrency scaling against an isolated test environment.
"""

import json
import os
from locust import HttpUser, task, between, events

CRED_FILE = os.path.join(os.path.dirname(__file__), "test-credentials.json")

class DocuMindUser(HttpUser):
    # Think time between user requests (0.5s to 2.0s)
    wait_time = between(0.5, 2.0)

    def on_start(self):
        """Load pre-seeded test authentication credentials and document IDs."""
        self.token = None
        self.doc_id = None

        if os.path.exists(CRED_FILE):
            try:
                with open(CRED_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.token = data.get("token")
                    self.doc_id = data.get("documentId")
            except Exception as e:
                print(f"[Locust] Error loading credentials: {e}")

        # Set default headers
        self.headers = {
            "Accept": "application/json",
            "X-DocuMind-Client": "locust-load-agent",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    @task(3)
    def test_health_check(self):
        """Scenario 1: Health check endpoint (lightweight unauthenticated)."""
        with self.client.get("/api/health", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed with status {response.status_code}")

    @task(2)
    def test_metrics_endpoint(self):
        """Scenario 1b: Telemetry and metrics endpoint."""
        with self.client.get("/api/metrics", headers=self.headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Metrics check failed with status {response.status_code}")

    @task(4)
    def test_list_documents(self):
        """Scenario 2: Authenticated document listing with projected fields."""
        if not self.token:
            return
        with self.client.get("/api/documents", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Document listing failed with status {response.status_code}")

    @task(3)
    def test_get_document_metadata(self):
        """Scenario 3: Single document metadata retrieval."""
        if not self.token or not self.doc_id:
            return
        with self.client.get(f"/api/documents/{self.doc_id}", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Document get failed with status {response.status_code}")

    @task(5)
    def test_rag_chat_query(self):
        """Scenario 4: End-to-end RAG chat message with vector retrieval and answer generation."""
        if not self.token or not self.doc_id:
            return
        payload = {
            "content": "What is the monthly query volume and target workload?"
        }
        with self.client.post(
            f"/api/documents/{self.doc_id}/messages",
            json=payload,
            headers=self.headers,
            catch_response=True,
            name="/api/documents/:id/messages"
        ) as response:
            if response.status_code == 201:
                response.success()
            elif response.status_code == 429:
                response.failure("Rate limit reached (429)")
            else:
                response.failure(f"RAG chat failed with status {response.status_code}: {response.text[:100]}")
