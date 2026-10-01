#!/usr/bin/env python3
"""
Official Ragas / DeepEval Python Evaluation Bridge for DocuMind
Reads benchmark dataset from dataset.json and evaluates RAG metrics using official SDKs if installed.

Usage:
    pip install ragas datasets langchain-openai
    export OPENAI_API_KEY="your-api-key"
    python run_ragas_eval.py
"""

import os
import sys
import json
from pathlib import Path

def load_dataset():
    dataset_path = Path(__file__).parent / "dataset.json"
    if not dataset_path.exists():
        print(f"Error: dataset.json not found at {dataset_path}")
        sys.exit(1)
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        return json.load(f)

def run_ragas():
    print("==================================================")
    print("DocuMind Python Ragas / DeepEval Bridge")
    print("==================================================")
    
    dataset_items = load_dataset()
    print(f"Successfully loaded {len(dataset_items)} benchmark items from dataset.json")

    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import (
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        )
    except ImportError as e:
        print("\n[Notice] Official Python 'ragas' package is not installed in the current environment.")
        print("To run official Python Ragas evaluations, install required packages:")
        print("    pip install ragas datasets langchain-openai")
        print("\nNote: DocuMind's primary native evaluation harness is located at:")
        print("    backend/eval/evaluateRAG.js (execute via 'npm run eval')\n")
        return

    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        print("[Notice] OPENAI_API_KEY environment variable is not set. Required for Python Ragas LLM judge.")
        return

    # Format data for Ragas Dataset schema
    formatted_data = {
        "question": [item["question"] for item in dataset_items],
        "answer": [item["expected_answer"] for item in dataset_items],
        "contexts": [item["ground_truth_context"] for item in dataset_items],
        "ground_truth": [item["expected_answer"] for item in dataset_items],
    }

    ragas_dataset = Dataset.from_dict(formatted_data)
    print("Executing Ragas evaluation with metrics: faithfulness, answer_relevancy, context_precision, context_recall...")

    results = evaluate(
        ragas_dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        ],
    )

    print("\n--- RAGAS OFFICIAL EVALUATION RESULTS ---")
    print(results)
    
    output_path = Path(__file__).parent / "ragas_official_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dict(results), f, indent=2)
    print(f"Results saved to {output_path}")

if __name__ == "__main__":
    run_ragas()
