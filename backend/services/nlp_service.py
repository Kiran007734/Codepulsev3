import logging
import string
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# Try to load sentence transformers as an optional improvement
try:
    from sentence_transformers import SentenceTransformer
    import torch
    torch.set_num_threads(1)
    _model = SentenceTransformer("all-MiniLM-L6-v2")
    USE_EMBEDDINGS = True
    logger.info("SentenceTransformer loaded successfully for NLP matching.")
except Exception as e:
    logger.warning(f"SentenceTransformer not available, falling back to TF-IDF. Error: {e}")
    _model = None
    USE_EMBEDDINGS = False

def preprocess(text: str) -> str:
    """
    2. Preprocess Text (CRITICAL)
    Steps: lowercase, remove punctuation
    (stopwords handled by TF-IDF vectorizer)
    """
    if not text:
        return ""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return text.strip()

def map_requirements_to_commits(
    requirements: list[str],
    commits: list[dict],
    threshold: float = 0.1,  # 5. Adjust Threshold: Set threshold = 0.1 (NOT high)
    top_k: int = 5,
) -> list[dict]:
    """
    Map business requirements to commits using TF-IDF / NLP embeddings and Cosine Similarity.
    """
    # 1. Ensure Commit Data Exists
    if not requirements or not commits:
        return []

    # Validate and extract: commit.message, author, timestamp
    valid_commits = [c for c in commits if c.get("message") and c.get("author") and c.get("date")]
    if not valid_commits:
        return []

    req_texts = [r.strip() for r in requirements if r.strip()]
    if not req_texts:
        return []

    results = []

    for req_text in req_texts:
        processed_req = preprocess(req_text)
        processed_commits = [preprocess(c.get("message", "")) for c in valid_commits]

        # 9. Debug Logging (MANDATORY)
        logger.info(f"[NLP Traceability] Processed requirement: '{processed_req}'")
        logger.info(f"[NLP Traceability] Processed commit messages: {processed_commits[:3]}...")

        scored_commits = []

        if USE_EMBEDDINGS and _model is not None:
            # 8. Optional Improvement: Use sentence embeddings (MiniLM)
            req_emb = _model.encode([processed_req], show_progress_bar=False).astype('float32')
            com_emb = _model.encode(processed_commits, show_progress_bar=False).astype('float32')
            
            # 4. Compute Cosine Similarity
            similarities = cosine_similarity(req_emb, com_emb).flatten()
            logger.info(f"[NLP Traceability] Sentence Embedding similarity scores: {similarities[:5]}...")

            for idx, score in enumerate(similarities):
                scored_commits.append({
                    "commit": valid_commits[idx],
                    "score": float(score)
                })
        else:
            # 3. Use TF-IDF Properly
            # Fit vectorizer on: [requirement + all commit messages] NOT separately
            corpus = [processed_req] + processed_commits
            
            vectorizer = TfidfVectorizer(stop_words='english')
            try:
                tfidf_matrix = vectorizer.fit_transform(corpus)
                req_vector = tfidf_matrix[0:1]
                commit_vectors = tfidf_matrix[1:]

                # 4. Compute Cosine Similarity
                similarities = cosine_similarity(req_vector, commit_vectors).flatten()
                logger.info(f"[NLP Traceability] TF-IDF similarity scores: {similarities[:5]}...")

                # Store similarity score per commit
                for idx, score in enumerate(similarities):
                    scored_commits.append({
                        "commit": valid_commits[idx],
                        "score": float(score)
                    })
            except ValueError:
                # E.g. empty vocabulary
                pass

        # 6. Return Top Matches: Sort by similarity descending
        scored_commits.sort(key=lambda x: x["score"], reverse=True)

        matched_commits = []
        for item in scored_commits:
            if len(matched_commits) >= top_k:
                break
            # 5. Adjust Threshold: If similarity > threshold -> consider match
            if item["score"] > threshold:
                commit = item["commit"]
                matched_commits.append({
                    "sha": commit.get("sha", ""),
                    "message": commit.get("message", ""),
                    "author": commit.get("author", ""),
                    "date": commit.get("date", ""),
                    "match_score": round(item["score"] * 100, 1),
                })

        # 7. Fallback Logic: If no matches, still show top 1-2 closest commits
        if not matched_commits and scored_commits:
            for item in scored_commits[:2]:
                commit = item["commit"]
                matched_commits.append({
                    "sha": commit.get("sha", ""),
                    "message": commit.get("message", ""),
                    "author": commit.get("author", ""),
                    "date": commit.get("date", ""),
                    "match_score": round(item["score"] * 100, 1), # low confidence
                })

        # Display low confidence if fallback used
        confidence = matched_commits[0]["match_score"] if matched_commits else 0.0

        results.append({
            "requirement": req_text,
            "confidence": confidence,
            "matched_commits": len(matched_commits),
            "commits": matched_commits,
        })

    return results
