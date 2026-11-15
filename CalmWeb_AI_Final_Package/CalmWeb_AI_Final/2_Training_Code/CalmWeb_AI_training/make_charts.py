"""Charts for the CalmWeb AI slides (reads results/ written by the training scripts)."""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).parent
OUT = ROOT / "charts"
OUT.mkdir(exist_ok=True)

SURFACE = "#fcfcfb"
INK = "#1f2b24"
MUTED = "#6b756f"
GRID = "#e6e8e4"
BLUE = "#2a78d6"   # learning content
ORANGE = "#eb6834"  # promotional / pop-up

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 12, "axes.edgecolor": GRID, "axes.labelcolor": MUTED,
    "xtick.color": MUTED, "ytick.color": MUTED, "axes.titlecolor": INK, "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE, "axes.spines.top": False, "axes.spines.right": False,
})

pop = json.loads((ROOT / "results/popup_metrics.json").read_text())
summ = json.loads((ROOT / "results/summary_metrics.json").read_text())

# 1. Dimensionality reduction: score vs number of SVD dimensions
dims = sorted(int(k) for k in pop["cv_f1_by_dimensions"])
f1 = [pop["cv_f1_by_dimensions"][str(k)] if str(k) in pop["cv_f1_by_dimensions"] else pop["cv_f1_by_dimensions"][k] for k in dims]
fig, ax = plt.subplots(figsize=(9, 5.2))
ax.plot(dims, f1, color=BLUE, lw=2, marker="o", ms=8, markeredgecolor=SURFACE, markeredgewidth=2, zorder=3)
ax.axhline(pop["cv_f1_without_reduction"], color=MUTED, lw=1.5, ls=(0, (4, 3)))
ax.text(2.1, pop["cv_f1_without_reduction"] + 0.012, f"All 3,000 word features (no reduction): {pop['cv_f1_without_reduction']:.2f}", color=MUTED, fontsize=11)
chosen = pop["svd_dimensions"]
ax.annotate(f"Chosen: {chosen} dimensions\nF1 {pop['cv_f1_by_dimensions'][str(chosen)] if str(chosen) in pop['cv_f1_by_dimensions'] else pop['cv_f1_by_dimensions'][chosen]:.2f}",
            xy=(chosen, f1[-1]), xytext=(60, 0.62), color=INK, fontsize=11,
            arrowprops=dict(arrowstyle="-", color=MUTED, lw=1))
ax.set_xscale("log")
ax.set_xticks(dims)
ax.set_xticklabels([str(d) for d in dims])
ax.set_ylim(0, 1)
ax.set_xlabel("Number of SVD dimensions the 3,000 word features are reduced to")
ax.set_ylabel("F1 score (cross-validated)")
ax.grid(axis="y", color=GRID, lw=1)
ax.set_title("Dimensionality reduction: how many dimensions does the\npop-up detector need?", loc="left", fontsize=15, fontweight="bold", pad=14)
fig.tight_layout()
fig.savefig(OUT / "1_dimensionality_reduction.png", dpi=160)
plt.close(fig)

# 2. The reduced space: test examples on the first two SVD dimensions
Z = np.load(ROOT / "results/svd_2d.npy")
y = np.load(ROOT / "results/svd_2d_labels.npy")
fig, ax = plt.subplots(figsize=(9, 6))
ax.scatter(Z[y == 0, 0], Z[y == 0, 1], s=14, color=BLUE, alpha=0.55, edgecolors="none", label="Normal / learning text")
ax.scatter(Z[y == 1, 0], Z[y == 1, 1], s=22, color=ORANGE, alpha=0.85, edgecolors=SURFACE, linewidths=0.6, label="Promotional (spam) text")
ax.set_xlabel("SVD dimension 1")
ax.set_ylabel("SVD dimension 2")
ax.grid(color=GRID, lw=1)
leg = ax.legend(frameon=False, loc="upper right", fontsize=11)
for t in leg.get_texts():
    t.set_color(INK)
ax.set_title(f"3,000 word features squeezed into 2 dimensions\n{len(y):,} test examples the model never saw", loc="left", fontsize=15, fontweight="bold", pad=14)
fig.tight_layout()
fig.savefig(OUT / "2_svd_map.png", dpi=160)
plt.close(fig)

# 3. Summarizer comparison on BBC News
names = {"random": "Random sentences", "first3": "First 3 sentences", "lsa": "SVD topics (LSA) only",
         "calmweb_ai": "CalmWeb + SVD + news weights", "calmweb_v3": "CalmWeb summarizer (used)"}
order = ["random", "first3", "lsa", "calmweb_ai", "calmweb_v3"]
vals = [summ["results"][k]["rouge1_recall"] * 100 for k in order]
fig, ax = plt.subplots(figsize=(9, 4.8))
colors = [BLUE if k == "calmweb_v3" else "#9ec5f4" for k in order]
bars = ax.barh([names[k] for k in order], vals, color=colors, height=0.6)
for b, v in zip(bars, vals):
    ax.text(v + 0.4, b.get_y() + b.get_height() / 2, f"{v:.1f}%", va="center", color=INK, fontsize=11)
ax.set_xlim(0, 45)
ax.set_xlabel("Words of the journalist's summary recovered (ROUGE-1 recall)")
ax.set_axisbelow(True)
ax.grid(axis="x", color=GRID, lw=1)
ax.tick_params(axis="y", colors=INK)
ax.set_title(f"Summarizer test on {summ['test_articles']} BBC News articles", loc="left", fontsize=15, fontweight="bold", pad=14)
fig.tight_layout()
fig.savefig(OUT / "3_summarizer_test.png", dpi=160)
plt.close(fig)
print("charts:", sorted(p.name for p in OUT.glob("*.png")))
