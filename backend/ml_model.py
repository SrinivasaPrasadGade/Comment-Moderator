# ml_model.py
from detoxify import Detoxify
import time

# Load model ONCE at startup — this takes 2-5 seconds.
# If you load it on every request, you'll be too slow.
model = Detoxify('multilingual')

def score_comment(text: str) -> dict:
    # Record the start time to calculate latency
    start = time.time()
    
    # Run the model prediction. Detoxify returns a dictionary with scores for various toxicity categories
    raw_results = model.predict(text)
    # Convert numpy.float32 to native float to prevent SQLite and JSON serialization errors
    results = {k: float(v) for k, v in raw_results.items()}
    # results = {'toxicity': 0.92, 'severe_toxicity': 0.1,
    #            'obscene': 0.8, 'threat': 0.05,
    #            'insult': 0.85, 'identity_attack': 0.1}
    
    # Calculate the elapsed time in milliseconds
    latency_ms = (time.time() - start) * 1000
    
    # Determine primary flag reason based on a threshold
    threshold = 0.8
    # Create a list of all labels that cross the threshold
    flags = [k for k, v in results.items() if v > threshold]
    
    # Determine specific flag reasons (exclude generic 'toxicity' if others exist)
    specific_results = {k: v for k, v in results.items() if k != 'toxicity' and v > threshold}
    
    if specific_results:
        reason_str = max(specific_results.items(), key=lambda x: x[1])[0]
    elif results['toxicity'] > threshold:
        reason_str = "toxicity"
    else:
        reason_str = "clean"
        
    return {
        "scores": results,                     # Raw dictionary of all scores
        "flagged": len(flags) > 0,             # True if ANY score is above 0.8
        "primary_label": reason_str,           # Comma-separated list of specific labels or "clean"
        "toxicity_score": results["toxicity"], # Keep the general toxicity score handy
        "latency_ms": round(latency_ms, 2)     # Include the latency rounded to 2 decimals
    }
