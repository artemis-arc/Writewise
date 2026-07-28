"""
Trains the RubricScorer checkpoint served by app/services/_215131E/srsd_scoring.py.

Training logic (embeddings, split, hyperparameters, loss, optimizer) is ported
verbatim from SRSD_content_scoring.ipynb -- this script exists so the model is
trained once, offline, and the trained weights are checked into
app/data/215131E/srsd_model.pt, rather than the FastAPI service retraining a fresh
model on every startup.

Run from backend/: .venv\\Scripts\\python.exe scripts\\215131E\\train_srsd_model.py
"""
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset

from app.services._215131E.srsd_model import RubricScorer

DATASET_PATH = BACKEND_DIR / "app" / "data" / "215131E" / "srsd_dataset.json"
CHECKPOINT_PATH = BACKEND_DIR / "app" / "data" / "215131E" / "srsd_model.pt"
EMBEDDING_MODEL = "BAAI/bge-large-en-v1.5"
EPOCHS = 500
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class EssayDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32).unsqueeze(1)

    def __len__(self) -> int:
        return len(self.X)

    def __getitem__(self, idx: int):
        return self.X[idx], self.y[idx]


def main() -> None:
    with DATASET_PATH.open(encoding="utf-8") as f:
        dataset = json.load(f)

    texts = [item["content"] for item in dataset]
    labels = np.array([item["score"] for item in dataset], dtype=np.float32)

    print(f"Loading embedder: {EMBEDDING_MODEL}")
    embedder = SentenceTransformer(EMBEDDING_MODEL)
    feature_matrix = embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    print("Embeddings:", feature_matrix.shape)

    X_train, X_test, y_train, y_test = train_test_split(
        feature_matrix, labels, test_size=0.2, random_state=42
    )

    train_loader = DataLoader(EssayDataset(X_train, y_train), batch_size=32, shuffle=True)
    test_loader = DataLoader(EssayDataset(X_test, y_test), batch_size=32)

    model = RubricScorer(input_dim=feature_matrix.shape[1]).to(DEVICE)
    criterion = nn.MSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

    print(f"Training for {EPOCHS} epochs on {DEVICE}...")
    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
            optimizer.zero_grad()
            preds = model(X_batch)
            loss = criterion(preds, y_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 100 == 0 or epoch == 0:
            print(f"Epoch {epoch + 1}/{EPOCHS} Loss: {total_loss:.4f}")

    model.eval()
    all_preds, all_true = [], []
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            X_batch = X_batch.to(DEVICE)
            preds = model(X_batch)
            all_preds.append(preds.cpu().numpy())
            all_true.append(y_batch.numpy())

    all_preds = np.concatenate(all_preds).flatten()
    all_true = np.concatenate(all_true).flatten()
    print()
    print("Held-out MAE:", mean_absolute_error(all_true, all_preds))
    print("Held-out R2 :", r2_score(all_true, all_preds))

    torch.save(model.state_dict(), CHECKPOINT_PATH)
    print(f"\nSaved checkpoint to {CHECKPOINT_PATH}")


if __name__ == "__main__":
    main()
