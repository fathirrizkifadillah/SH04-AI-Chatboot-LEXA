"""
Pytest configuration & lightweight mocks for local testing.
Allows running backend tests without requiring heavy ML/CUDA packages on system Python.
"""
import sys
from types import ModuleType
from unittest.mock import MagicMock

# Mock chromadb if not installed in local environment
try:
    import chromadb  # noqa: F401
except ImportError:
    chroma_mod = ModuleType("chromadb")
    utils_mod = ModuleType("chromadb.utils")
    utils_mod.embedding_functions = MagicMock()
    chroma_mod.utils = utils_mod
    chroma_mod.PersistentClient = MagicMock()
    sys.modules["chromadb"] = chroma_mod
    sys.modules["chromadb.utils"] = utils_mod

# Mock sentence_transformers if not installed
try:
    import sentence_transformers  # noqa: F401
except ImportError:
    st_mod = ModuleType("sentence_transformers")
    st_mod.SentenceTransformer = MagicMock()
    sys.modules["sentence_transformers"] = st_mod
