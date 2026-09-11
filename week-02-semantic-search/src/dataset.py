"""Dataset generation and loading module for Week 2 Semantic Search.

Generates 10,000+ realistic, high-quality technical documents, resume chunks,
and job profiles across diverse domains (AI/ML, DevOps, Backend, Cybersecurity, etc.).
"""

import argparse
import json
import os
import random
from typing import Any, Dict, List, Optional


DOMAINS = [
    {
        "category": "AI & Machine Learning",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "architecture_spec"],
        "roles": [
            "Senior Machine Learning Engineer",
            "Staff AI Infrastructure Architect",
            "Research Scientist - NLP & LLMs",
            "Computer Vision Engineer",
            "MLOps Platform Specialist",
            "Applied Deep Learning Specialist",
        ],
        "focus_areas": [
            "fine-tuning large language models using LoRA and QLoRA on distributed GPU clusters",
            "architecting high-throughput low-latency inference services using vLLM and Triton Inference Server",
            "implementing retrieval-augmented generation (RAG) pipelines with hybrid dense-sparse vector search",
            "training transformer architectures from scratch with PyTorch FSDP and DeepSpeed ZeRO-3",
            "quantizing neural network weights to INT4 and FP8 precision for edge deployment with ONNX Runtime",
            "designing automated feature stores and drift detection pipelines for real-time recommendation models",
            "optimizing attention mechanisms with FlashAttention-2 to extend context window sizes to 128k tokens",
        ],
        "technologies": [
            ["PyTorch", "Hugging Face", "Transformers", "vLLM", "Triton", "CUDA"],
            ["DeepSpeed", "FSDP", "Ray Train", "Weights & Biases", "MLflow"],
            ["LangChain", "LlamaIndex", "Sentence-Transformers", "ChromaDB", "FAISS"],
            ["TensorRT", "ONNX", "PyTorch Mobile", "CoreML", "BitsAndBytes"],
            ["JAX", "Flax", "TPU v4", "Optuna", "Kubeflow"],
        ],
        "outcomes": [
            "reducing p99 inference latency from 140ms to 24ms while serving 12,000 requests per second",
            "scaling distributed pre-training across 256 NVIDIA H100 GPUs with 94% linear scaling efficiency",
            "improving document retrieval NDCG@10 score by 38% compared to traditional keyword search",
            "lowering cloud GPU infrastructure spend by $340,000 annually via continuous batching and dynamic kv-cache paging",
            "achieving zero-downtime canary deployments for over 45 production neural network models",
        ],
    },
    {
        "category": "Cloud & DevOps Infrastructure",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "runbook"],
        "roles": [
            "Principal Site Reliability Engineer",
            "Cloud Platform Architect",
            "DevOps Automation Specialist",
            "Kubernetes Infrastructure Engineer",
            "Cloud Security & Platform Lead",
        ],
        "focus_areas": [
            "managing multi-tenant Kubernetes clusters running on AWS EKS and Google Kubernetes Engine",
            "authoring modular infrastructure-as-code using Terraform and Terragrunt across multi-region VPC topologies",
            "implementing service mesh communication, mTLS encryption, and traffic splitting using Istio and Envoy",
            "building continuous delivery pipelines using ArgoCD GitOps and GitHub Actions with automated rollbacks",
            "deploying observability stacks with Prometheus, Grafana, OpenTelemetry, and Thanos for long-term metric storage",
            "configuring auto-scaling compute pools using Karpenter and AWS Spot instances for resilient batch processing",
            "hardening container runtime security using Falco, Cosign image signing, and OPA Gatekeeper policies",
        ],
        "technologies": [
            ["Kubernetes", "Docker", "Helm", "Istio", "Envoy", "Terraform"],
            ["AWS EKS", "GCP GKE", "ArgoCD", "GitHub Actions", "FluxCD"],
            ["Prometheus", "Thanos", "Grafana", "OpenTelemetry", "Datadog"],
            ["Karpenter", "AWS Lambda", "CloudFront", "Route53", "Vault"],
            ["Linux", "Bash", "Ansible", "Cilium", "eBPF", "Trivy"],
        ],
        "outcomes": [
            "maintaining four-nines (99.99%) service availability across 18 regional availability zones",
            "reducing continuous integration pipeline build times from 28 minutes to 4.5 minutes",
            "cutting cloud compute operational costs by 42% through automated spot instance provisioning",
            "automating disaster recovery failover achieving an RPO of under 10 seconds and RTO under 3 minutes",
            "securing SOC 2 Type II compliance by eliminating 100% of critical container vulnerabilities before production deployment",
        ],
    },
    {
        "category": "Backend & Distributed Systems",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "architecture_spec"],
        "roles": [
            "Staff Distributed Systems Engineer",
            "Senior Backend Architect",
            "Core Services Engineer",
            "High-Throughput API Specialist",
            "Database & Concurrency Engineer",
        ],
        "focus_areas": [
            "designing event-driven microservices architectures processing billions of telemetry events via Apache Kafka",
            "building resilient asynchronous REST and gRPC microservices in Go and Rust with sub-5ms response budgets",
            "implementing distributed caching layers and write-through caches with Redis Cluster and Memcached",
            "engineering fault-tolerant distributed transaction workflows using the Saga pattern and event sourcing",
            "optimizing relational database query execution plans, indexing strategies, and connection pooling in PostgreSQL",
            "implementing distributed consensus mechanisms and leader election algorithms using Raft and etcd",
            "scaling horizontally partitioned NoSQL databases with Apache Cassandra and ScyllaDB for high write throughput",
        ],
        "technologies": [
            ["Go", "Rust", "Python", "FastAPI", "gRPC", "Protocol Buffers"],
            ["Apache Kafka", "RabbitMQ", "Apache Flink", "NATS", "Debezium"],
            ["PostgreSQL", "Redis", "Cassandra", "ScyllaDB", "ClickHouse"],
            ["Docker", "etcd", "Consul", "Envoy", "SQLAlchemy", "AsyncIO"],
            ["Elasticsearch", "Temporal.io", "CockroachDB", "GraphQL", "OAuth2"],
        ],
        "outcomes": [
            "handling peak traffic loads exceeding 85,000 transactions per second during Black Friday flash sales",
            "reducing database connection saturation by 65% through connection pooling with PgBouncer",
            "eliminating distributed deadlock conditions across high-contention financial settlement pipelines",
            "slashing cold-start API response times by 70% by transitioning CPU-bound services from Python to compiled Go",
            "guaranteeing strict exactly-once processing semantics for automated transaction billing queues",
        ],
    },
    {
        "category": "Cybersecurity & Identity",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "security_audit"],
        "roles": [
            "Lead Security Operations Engineer",
            "Application Security Specialist",
            "Zero Trust Architect",
            "Cloud Security Engineer",
            "Cryptographic Systems Engineer",
        ],
        "focus_areas": [
            "architecting Zero Trust perimeter security with identity-aware proxies and device posture attestation",
            "implementing robust identity and access management (IAM) protocols utilizing OAuth 2.0, OpenID Connect, and SAML",
            "managing enterprise secret rotation, envelope encryption, and HSM cryptographic keys with HashiCorp Vault",
            "conducting proactive penetration testing, dynamic application security testing (DAST), and threat modeling",
            "building centralized Security Information and Event Management (SIEM) detection rules using Splunk and Wazuh",
            "defending microservices against OWASP Top 10 vulnerabilities, server-side request forgery (SSRF), and injection attacks",
            "enforcing mutual TLS (mTLS) authentication with dynamic x509 certificate issuance via SPIFFE/SPIRE",
        ],
        "technologies": [
            ["HashiCorp Vault", "SPIFFE/SPIRE", "OAuth 2.0", "OIDC", "mTLS"],
            ["Splunk", "Wazuh", "Snort", "Suricata", "Wireshark"],
            ["OWASP ZAP", "Burp Suite", "Semgrep", "Snyk", "SonarQube"],
            ["AWS KMS", "GCP Cloud KMS", "Keycloak", "Okta", "CrowdStrike"],
            ["Cryptography", "AES-256-GCM", "RSA-4096", "Elliptic Curve", "TLS 1.3"],
        ],
        "outcomes": [
            "preventing 100% of attempted unauthorized lateral movement during third-party red team security assessments",
            "automating credential rotation across 4,000 microservice credentials with zero application downtime",
            "reducing Mean Time to Detect (MTTD) security anomalies from 4 hours to under 90 seconds",
            "achieving full compliance certification for ISO/IEC 27001, HIPAA, and SOC 2 Type II audits",
            "mitigating large-scale volumetric distributed denial-of-service (DDoS) attacks up to 450 Gbps",
        ],
    },
    {
        "category": "Data Engineering & Analytics",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "pipeline_spec"],
        "roles": [
            "Staff Data Platform Engineer",
            "Lead Analytics Architect",
            "Data Pipeline Engineer",
            "Big Data Infrastructure Lead",
            "Streaming Data Engineer",
        ],
        "focus_areas": [
            "building petabyte-scale lakehouse architectures using Apache Iceberg, Delta Lake, and Apache Parquet formats",
            "orchestrating complex dependency-graph DAGs with Apache Airflow and Dagster with automatic retry policies",
            "developing low-latency streaming analytics pipelines using Apache Spark Structured Streaming and Apache Flink",
            "building modular transformation models and automated data quality validation suites using dbt Core and Great Expectations",
            "optimizing columnar data warehousing performance and partition clustering strategies on Snowflake and Google BigQuery",
            "implementing change data capture (CDC) pipelines from transactional databases using Debezium and Kafka Connect",
            "establishing enterprise data cataloging, lineage tracking, and governance with Apache Atlas and Amundsen",
        ],
        "technologies": [
            ["Apache Spark", "Apache Flink", "Delta Lake", "Apache Iceberg", "Parquet"],
            ["Snowflake", "Google BigQuery", "Amazon Redshift", "ClickHouse", "DuckDB"],
            ["Apache Airflow", "Dagster", "Prefect", "dbt", "Great Expectations"],
            ["Kafka Connect", "Debezium", "Apache Arrow", "Polars", "PySpark"],
            ["AWS Glue", "Databricks", "Athena", "Trino", "MinIO"],
        ],
        "outcomes": [
            "processing over 14 billion daily records with sub-minute data freshness in downstream executive dashboards",
            "reducing cloud analytical warehouse query expenditures by 52% through optimized clustering keys and materialized views",
            "catching and alerting on schema drift anomalies before bad data could corrupt production machine learning feature tables",
            "accelerating daily financial reconciliation batch processing windows from 6 hours down to 35 minutes",
            "unifying 18 siloed data warehouses into a single centralized governed data mesh repository",
        ],
    },
    {
        "category": "Frontend & Mobile Engineering",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "ui_spec"],
        "roles": [
            "Principal Frontend Architect",
            "Lead UI/UX Systems Engineer",
            "Mobile Platform Specialist",
            "Senior React & TypeScript Developer",
            "Cross-Platform Flutter Lead",
        ],
        "focus_areas": [
            "architecting high-performance Single Page and Server-Driven web applications using React 19, Next.js, and TypeScript",
            "engineering scalable design systems and accessible UI component libraries adhering to WCAG 2.1 AA guidelines",
            "optimizing Core Web Vitals, Largest Contentful Paint (LCP), and Interaction to Next Paint (INP) across mobile devices",
            "building offline-first mobile client architectures in Flutter and Swift with SQLite local synchronization",
            "implementing state management architectures with Zustand, Redux Toolkit, and TanStack Query for server state caching",
            "developing bidirectional real-time collaborative editors using WebSockets, WebRTC, and Conflict-free Replicated Data Types (CRDTs)",
            "configuring micro-frontend module federation architecture for independent multi-team deployment pipelines",
        ],
        "technologies": [
            ["React", "Next.js", "TypeScript", "TailwindCSS", "Node.js"],
            ["Flutter", "Dart", "Swift", "Kotlin", "React Native"],
            ["Zustand", "TanStack Query", "Redux Toolkit", "RxJS", "Zod"],
            ["Vite", "Webpack", "Playwright", "Cypress", "Storybook"],
            ["WebSockets", "WebRTC", "Yjs", "IndexedDB", "PWA"],
        ],
        "outcomes": [
            "improving Core Web Vitals across e-commerce product pages, raising Lighthouse performance score from 58 to 98",
            "reducing mobile app crash-free user sessions rate to an industry-leading 99.98% across 4 million active devices",
            "lowering initial JavaScript bundle payload size by 62% via dynamic code splitting and tree shaking",
            "enabling instantaneous sub-20ms real-time multi-user cursor tracking and synchronous document editing",
            "shortening frontend feature deployment cycles from two weeks to multiple daily deployments via atomic design tokens",
        ],
    },
    {
        "category": "Systems Architecture & Database Internals",
        "doc_types": ["resume_chunk", "job_profile", "technical_doc", "kernel_spec"],
        "roles": [
            "Staff Systems Software Engineer",
            "Database Engine Architect",
            "Operating Systems & Kernel Developer",
            "High-Performance Networking Specialist",
            "Storage Engine Internals Engineer",
        ],
        "focus_areas": [
            "engineering log-structured merge-tree (LSM-tree) storage engines with tiered compaction strategies for high write workloads",
            "implementing lock-free concurrent data structures and memory allocators in C++20 and Rust for multi-core CPUs",
            "optimizing Linux kernel networking pathways using eBPF, XDP (eXpress Data Path), and DPDK for kernel bypass packet processing",
            "building distributed consensus algorithms and quorum replication using Raft and Multi-Paxos with deterministic simulation testing",
            "designing Multi-Version Concurrency Control (MVCC) transactional engines with serializable snapshot isolation (SSI)",
            "implementing Write-Ahead Logging (WAL), group commit synchronization, and crash recovery using ARIES algorithms",
            "benchmarking NVMe SSD I/O queue depths using io_uring for ultra-low latency direct disk access",
        ],
        "technologies": [
            ["C++20", "Rust", "C", "Linux Kernel", "eBPF", "XDP"],
            ["RocksDB", "LevelDB", "SQLite Internals", "LMDB", "io_uring"],
            ["Raft", "Paxos", "etcd", "Zookeeper", "DPDK"],
            ["Valgrind", "Perf", "GDB", "AddressSanitizer", "BPFTrace"],
            ["SIMD", "AVX-512", "Memory Fences", "Cache Lines", "NUMA"],
        ],
        "outcomes": [
            "achieving sustained disk write throughput of 2.8 GB/s with p99 write latency under 450 microseconds",
            "bypassing kernel network stack to drop 100GbE packet processing jitter down to under 3 microseconds",
            "discovering and resolving subtle memory reordering race conditions on ARM64 weakly-ordered multi-core systems",
            "reducing database storage footprint by 4.2x using dictionary-encoded bit-packing and Zstandard compression",
            "proving zero state divergence across 10 million simulated network partition and node crash scenarios",
        ],
    },
]

PROJECT_VERBS = [
    "Spearheaded the development of",
    "Engineered and deployed",
    "Architected and delivered",
    "Led technical execution for",
    "Designed and benchmarked",
    "Optimized and hardened",
    "Implemented production-grade",
    "Refactored legacy systems into",
]

CHALLENGES = [
    "overcoming strict hardware compute constraints and tight latency deadlines",
    "eliminating cascading distributed failure modes across cross-region dependencies",
    "resolving extreme data skew in high-velocity streaming aggregation pipelines",
    "safeguarding mission-critical customer records during high-concurrency peak load",
    "mitigating cold-start degradation in distributed serverless computing topologies",
    "unifying disjointed telemetry data into a cohesive real-time actionable feedback loop",
]

EXPERIENCE_LEVELS = ["Mid-Level", "Senior", "Staff", "Principal", "Lead"]


def generate_document_record(doc_id: int, rng: random.Random) -> Dict[str, Any]:
    """Generates a single rich, realistic document record."""
    domain = rng.choice(DOMAINS)
    category = domain["category"]
    role = rng.choice(domain["roles"])
    doc_type = rng.choice(domain["doc_types"])
    focus = rng.choice(domain["focus_areas"])
    tech_stack = rng.choice(domain["technologies"])
    outcome = rng.choice(domain["outcomes"])
    verb = rng.choice(PROJECT_VERBS)
    challenge = rng.choice(CHALLENGES)
    exp_level = rng.choice(EXPERIENCE_LEVELS)

    # Varying text structures based on document type
    if doc_type == "resume_chunk":
        title = f"{exp_level} {role} Experience"
        text = (
            f"Role: {exp_level} {role} | Domain: {category}. "
            f"{verb} enterprise systems focused on {focus}. "
            f"Successfully tackled {challenge} by utilizing {', '.join(tech_stack[:4])}. "
            f"Demonstrated measurable business impact by {outcome}. "
            f"Key technical proficiencies include {', '.join(tech_stack)}."
        )
    elif doc_type == "job_profile":
        title = f"Hiring: {exp_level} {role}"
        text = (
            f"Job Opening: {exp_level} {role} ({category}). "
            f"We are seeking an engineer to lead efforts in {focus}. "
            f"The ideal candidate has hands-on experience {challenge}, and is adept at {outcome}. "
            f"Required stack: {', '.join(tech_stack)}. "
            f"Experience with distributed architectures, high-performance systems, and clean software craftsmanship required."
        )
    elif doc_type == "technical_doc":
        title = f"Technical Design: {focus.split()[0].capitalize()} in {category}"
        text = (
            f"Architecture Document: Implementation guidelines for {focus}. "
            f"System overview: This service resolves operational bottlenecks by {challenge}. "
            f"Core architectural stack comprises {', '.join(tech_stack)}. "
            f"Verification and benchmark results confirmed {outcome}. "
            f"Adheres to zero-trust security and horizontal scalability best practices."
        )
    else:  # architecture_spec / runbook / security_audit
        title = f"System Specification: {role} Standard"
        text = (
            f"Specification & Operational Standard ({category}). "
            f"Primary directive involves {focus}, while {challenge}. "
            f"Utilizes technologies: {', '.join(tech_stack)}. "
            f"Production verification achieved target metrics: {outcome}. "
            f"Maintained and reviewed by the {role} team."
        )

    return {
        "id": f"doc_{doc_id:05d}",
        "text": text,
        "metadata": {
            "title": title,
            "category": category,
            "doc_type": doc_type,
            "role": role,
            "experience_level": exp_level,
            "tags": tech_stack,
            "char_count": len(text),
            "word_count": len(text.split()),
        },
    }


def generate_documents(
    num_docs: int = 10000,
    output_path: Optional[str] = None,
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """Generates `num_docs` synthetic records and optionally writes them to `output_path`.

    Args:
        num_docs: Number of records to generate (default: 10,000).
        output_path: Optional file path to write the JSON array.
        seed: Random seed for deterministic generation.

    Returns:
        List of generated document dictionaries.
    """
    rng = random.Random(seed)
    documents = []

    print(f"[*] Generating {num_docs:,} synthetic documents with seed {seed}...")
    for i in range(1, num_docs + 1):
        doc = generate_document_record(i, rng)
        documents.append(doc)

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        print(f"[*] Saving {len(documents):,} documents to: {output_path}")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(documents, f, indent=2, ensure_ascii=False)
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"[OK] Saved successfully ({file_size_mb:.2f} MB).")

    return documents


def load_documents(file_path: str) -> List[Dict[str, Any]]:
    """Loads document records from a JSON file.

    Args:
        file_path: Path to the JSON dataset file.

    Returns:
        List of document dictionaries.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Document file not found at: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    return docs


def get_or_create_dataset(
    file_path: str = "data/documents_10k.json",
    min_count: int = 10000,
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """Retrieves existing dataset if present and has >= min_count records; otherwise generates it.

    Args:
        file_path: Path to documents JSON file.
        min_count: Minimum required record count.
        seed: Random seed.

    Returns:
        List of document dictionaries.
    """
    if os.path.exists(file_path):
        try:
            docs = load_documents(file_path)
            if len(docs) >= min_count:
                print(f"[OK] Loaded {len(docs):,} existing documents from {file_path}")
                return docs
            print(f"[!] Existing dataset has {len(docs)} records (< {min_count}). Regenerating...")
        except Exception as e:
            print(f"[!] Error reading existing dataset ({e}). Regenerating...")

    return generate_documents(num_docs=min_count, output_path=file_path, seed=seed)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic dataset for semantic search.")
    parser.add_argument("--count", type=int, default=10000, help="Number of documents to generate")
    parser.add_argument(
        "--output",
        type=str,
        default="data/documents_10k.json",
        help="Target output JSON path",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    generate_documents(num_docs=args.count, output_path=args.output, seed=args.seed)
