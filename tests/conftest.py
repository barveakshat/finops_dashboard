import os
import sys
import pytest

# Add all lambda src directories to sys.path for test imports
_lambda_src = os.path.join(
    os.path.dirname(__file__), os.pardir,
    "terraform", "modules", "lambda", "src"
)
for subdir in ("ingestor", "aggregator", "anomaly_detector", "slack_notifier", "api_handler"):
    path = os.path.abspath(os.path.join(_lambda_src, subdir))
    if path not in sys.path:
        sys.path.insert(0, path)
