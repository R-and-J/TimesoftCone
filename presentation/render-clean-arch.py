#!/usr/bin/env python3
"""동심원(클린/헥사고날) 아키텍처 그림 → presentation/img/clean-arch.png
matplotlib로 로컬 렌더(외부 전송 없음). 한글은 Malgun Gothic."""
import os
import matplotlib
matplotlib.use("Agg")
from matplotlib import font_manager, rcParams
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle, FancyArrowPatch

FONT = r"C:\Windows\Fonts\malgun.ttf"
font_manager.fontManager.addfont(FONT)
rcParams["font.family"] = font_manager.FontProperties(fname=FONT).get_name()
rcParams["axes.unicode_minus"] = False

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "img", "clean-arch.png")

# 색 (참조 클린 아키텍처 팔레트)
C_YELLOW = "#FBF8C8"
C_PINK = "#F6B7B7"
C_GREEN = "#BDE7BD"
C_BLUE = "#AED6F1"

fig, ax = plt.subplots(figsize=(13, 7.2), dpi=160)
ax.set_aspect("equal")
ax.set_xlim(-5.3, 13.8)
ax.set_ylim(-5.0, 5.2)
ax.axis("off")

# --- 동심원 (바깥→안, zorder 증가) ---
rings = [(4.15, C_BLUE), (3.15, C_GREEN), (2.10, C_PINK), (1.05, C_YELLOW)]
for i, (r, c) in enumerate(rings):
    ax.add_patch(Circle((0, 0), r, facecolor=c, edgecolor="black", lw=2.2, zorder=2 + i))

# --- 링 라벨 (각 띠 상단) ---
lab = dict(ha="center", va="center", weight="bold", zorder=30, color="#222")
ax.text(0, 0.0, "도메인 코어\n(핵심 규칙)", fontsize=15, **lab)
ax.text(0, 1.55, "유스케이스", fontsize=15, **lab)
ax.text(0, 2.60, "어댑터 · 포트", fontsize=15, **lab)
ax.text(0, 3.62, "프레임워크 · 외부", fontsize=15, **lab)

# --- 안쪽으로 향하는 의존 화살표 (왼쪽) ---
for (x0, x1) in [(-4.7, -3.7), (-3.5, -2.5), (-2.3, -1.3)]:
    ax.add_patch(FancyArrowPatch((x0, -0.15), (x1, -0.15),
                 arrowstyle="-|>", mutation_scale=22, lw=2.4, color="#333", zorder=31))
ax.text(-4.75, 0.65, "의존 방향", fontsize=12.5, weight="bold", color="#333", ha="left", zorder=31)

# --- 범례 (오른쪽) ---
def legend_row(y, color, title, detail):
    ax.add_patch(Rectangle((4.95, y - 0.28), 0.55, 0.55, facecolor=color,
                 edgecolor="black", lw=1.4, zorder=20))
    ax.text(5.75, y + 0.10, title, fontsize=13, weight="bold", va="center", zorder=20, color="#111")
    ax.text(5.75, y - 0.42, detail, fontsize=10.3, va="center", zorder=20, color="#444")

legend_row(3.55, C_YELLOW, "도메인 코어  (domain/)", "Auction · Wallet · 수익적립금 '규칙' · 외부 의존 0")
legend_row(2.15, C_PINK, "유스케이스  (application/)", "PlaceBid · SettleAuction · DistributeDividend")
legend_row(0.75, C_GREEN, "어댑터 · 포트  (ports/ · adapters/)", "REST · WebSocket · SQLite · ezpass · WelfarePointProvider")
legend_row(-0.65, C_BLUE, "프레임워크 · 외부  (interfaces/ · 인프라)", "NestJS · Prisma · SQLite · HR · 그룹웨어")

# --- 핵심 메시지 박스 ---
ax.add_patch(Rectangle((4.95, -3.55), 8.4, 1.55, facecolor="#fff8e6",
             edgecolor="#cc9900", lw=1.6, zorder=19))
ax.text(5.2, -2.35, "의존은 항상 안쪽으로 (Dependency Rule)", fontsize=12.5,
        weight="bold", color="#7a5c00", va="center", zorder=21)
ax.text(5.2, -3.05, "→ 바깥(파랑)이 바뀌어도 코어(노랑) 규칙은 그대로.\n   화폐·DB·외부연동은 어댑터만 교체.",
        fontsize=10.6, color="#5a4500", va="center", zorder=21)

fig.suptitle("헥사고날 / 클린 아키텍처 — 의존은 항상 안쪽으로", fontsize=18, weight="bold", y=0.97)
fig.savefig(OUT, bbox_inches="tight", pad_inches=0.25, facecolor="white")
print("saved:", OUT, os.path.getsize(OUT), "bytes")
