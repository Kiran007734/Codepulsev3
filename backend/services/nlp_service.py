import faiss
from sentence_transformers import SentenceTransformer
import numpy as np


# Lazy-loaded model singleton
_model = None


def _get_model():
    """Load the sentence transformer model (singleton)."""
    global _model
    if _model is None:
        import torch
        # Limit PyTorch threads to reduce memory usage on small instances (like Render 512MB)
        torch.set_num_threads(1)
        import gc
        gc.collect()
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def map_requirements_to_commits(
    requirements: list[str],
    commits: list[dict],
    threshold: float = 0.45,
    top_k: int = 5,
) -> list[dict]:
    """
    Map business requirements to commits using FAISS vector search.
    """
    if not requirements or not commits:
        return []

    model = _get_model()

    # Encode all texts
    req_texts = [r.strip() for r in requirements if r.strip()]
    commit_messages = [c.get("message", "") for c in commits]

    if not req_texts or not commit_messages:
        return []

    # FAISS requires float32
    commit_embeddings = model.encode(commit_messages, show_progress_bar=False).astype('float32')
    req_embeddings = model.encode(req_texts, show_progress_bar=False).astype('float32')

    # Normalize for cosine similarity via FAISS inner product
    faiss.normalize_L2(commit_embeddings)
    faiss.normalize_L2(req_embeddings)

    # Initialize index
    dimension = commit_embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner Product on normalized vectors = Cosine Similarity
    index.add(commit_embeddings)

    # Search
    scores, indices = index.search(req_embeddings, top_k)

    results = []
    for i, req_text in enumerate(req_texts):
        matched_commits = []
        for rank in range(top_k):
            score = float(scores[i][rank])
            idx = indices[i][rank]

            if score >= threshold and idx != -1:
                commit = commits[idx]
                matched_commits.append({
                    "sha": commit.get("sha", ""),
                    "message": commit.get("message", ""),
                    "author": commit.get("author", ""),
                    "date": commit.get("date", ""),
                    "match_score": round(score * 100, 1),
                })

        # Overall confidence is the highest match score
        confidence = matched_commits[0]["match_score"] if matched_commits else 0.0

        results.append({
            "requirement": req_text,
            "confidence": confidence,
            "matched_commits": len(matched_commits),
            "commits": matched_commits,
        })

    return results
