import torch
import torch.nn as nn
import torch.nn.functional as F

EMBEDDING_DIM = 1024  # BAAI/bge-large-en-v1.5 output size, matching SRSD_content_scoring.ipynb


class RubricScorer(nn.Module):
    """
    Ported verbatim from SRSD_content_scoring.ipynb's active RubricScorer class
    (the attention-fused, 4-branch architecture -- not the commented-out
    11-criterion-head alternative). Architecture is unchanged from the notebook;
    only the surrounding training/serving code around it is new.
    """

    def __init__(self, input_dim: int = EMBEDDING_DIM):
        super().__init__()

        self.srsd_branch = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.Sigmoid(),
        )

        self.hochman_branch = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.Sigmoid(),
        )

        self.org_branch = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.Sigmoid(),
        )

        self.coh_branch = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.Sigmoid(),
        )

        self.attention = nn.Linear(input_dim, 4)

        self.shared = nn.Sequential(
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
        )

        self.output = nn.Linear(128, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        r1 = self.srsd_branch(x)
        r2 = self.hochman_branch(x)
        r3 = self.org_branch(x)
        r4 = self.coh_branch(x)

        alpha = F.softmax(self.attention(x), dim=1)

        fused = (
            alpha[:, 0:1] * r1
            + alpha[:, 1:2] * r2
            + alpha[:, 2:3] * r3
            + alpha[:, 3:4] * r4
        )

        h = self.shared(fused)
        return self.output(h)
