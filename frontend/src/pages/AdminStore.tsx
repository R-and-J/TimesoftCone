import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PALETTES, FONT, fmt, type Palette } from "@/lib/tokens";
import { Btn, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { DataGrid } from "@/components/DataGrid";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  createAdminStoreItem,
  listAdminStoreItemAudits,
  listAdminStoreItems,
  setAdminStoreItemActive,
  updateAdminStoreItem,
  type AdminStoreItem,
  type StoreItemAudit,
  type StoreItemInput,
} from "@/lib/queries";

const ACTION_LABEL: Record<StoreItemAudit["action"], string> = {
  CREATE: "추가",
  UPDATE: "수정",
  ACTIVATE: "활성화",
  DEACTIVATE: "비활성화",
  DELETE: "삭제",
};

type FormState = {
  id: number | null; // null = 신규
  sku: string;
  name: string;
  brand: string;
  description: string;
  priceP: string;
  stock: string; // 빈 문자열 = 무제한
  category: string;
  displayOrder: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  sku: "",
  name: "",
  brand: "",
  description: "",
  priceP: "",
  stock: "",
  category: "",
  displayOrder: "0",
};

/** 카테고리 안에서 새 항목의 표시순서 — 해당 카테고리 최대값 + 10. 비면 0(맨 앞). */
function nextDisplayOrder(category: string, items: AdminStoreItem[]): number {
  const c = category.trim();
  if (!c) return 0;
  const inCat = items.filter((i) => (i.category ?? "") === c);
  if (inCat.length === 0) return 0;
  const max = inCat.reduce((m, i) => (i.displayOrder > m ? i.displayOrder : m), 0);
  return max + 10;
}

function toForm(it: AdminStoreItem): FormState {
  return {
    id: it.id,
    sku: it.sku,
    name: it.name,
    brand: it.brand ?? "",
    description: it.description ?? "",
    priceP: it.priceP,
    stock: it.stock === null ? "" : String(it.stock),
    category: it.category ?? "",
    displayOrder: String(it.displayOrder),
  };
}

export default function AdminStorePage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const itemsQ = useQuery(() => listAdminStoreItems(), []);
  const items = itemsQ.data ?? [];

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("__ALL__");

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.category) s.add(it.category);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (activeFilter === "ACTIVE" && !it.active) return false;
      if (activeFilter === "INACTIVE" && it.active) return false;
      if (categoryFilter !== "__ALL__" && (it.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.brand ?? "").toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, activeFilter, categoryFilter]);

  const summary = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const it of items) (it.active ? active++ : inactive++);
    return { total: items.length, active, inactive, categories: categories.length };
  }, [items, categories.length]);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (it: AdminStoreItem) => setForm(toForm(it));

  const doSave = async () => {
    if (!form) return;
    const isNew = form.id === null;
    if (isNew && !form.sku.trim()) {
      toast.push("error", "SKU는 필수입니다");
      return;
    }
    if (!form.name.trim()) {
      toast.push("error", "상품 이름은 필수입니다");
      return;
    }
    const priceNum = Number(form.priceP);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.push("error", "가격은 0보다 큰 정수여야 합니다");
      return;
    }
    const stockNum = form.stock.trim() === "" ? null : Number(form.stock);
    if (stockNum !== null && (!Number.isInteger(stockNum) || stockNum < 0)) {
      toast.push("error", "재고는 비우면 무제한, 그 외엔 0 이상 정수");
      return;
    }
    // 표시순서 — 비우면 0(맨 앞), 그 외는 정수 검증.
    const orderRaw = form.displayOrder.trim();
    const order = orderRaw === "" ? 0 : Number(orderRaw);
    if (!Number.isInteger(order)) {
      toast.push("error", "표시순서는 정수 또는 빈 값(0)이어야 합니다");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const body: StoreItemInput = {
          sku: form.sku.trim(),
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          description: form.description.trim() || null,
          priceP: String(Math.floor(priceNum)),
          stock: stockNum,
          category: form.category.trim() || null,
          displayOrder: order,
        };
        await createAdminStoreItem(body);
        toast.push("success", `${body.name} 추가됨`);
      } else {
        await updateAdminStoreItem(form.id!, {
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          description: form.description.trim() || null,
          priceP: String(Math.floor(priceNum)),
          stock: stockNum,
          category: form.category.trim() || null,
          displayOrder: order,
        });
        toast.push("success", `${form.name} 수정됨`);
      }
      setForm(null);
      await itemsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (it: AdminStoreItem) => {
    try {
      await setAdminStoreItemActive(it.id, !it.active);
      toast.push("success", `${it.name} ${it.active ? "비활성화" : "활성화"}`);
      await itemsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    }
  };

  const [auditFor, setAuditFor] = useState<AdminStoreItem | null>(null);
  const [audits, setAudits] = useState<StoreItemAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const openAudits = async (it: AdminStoreItem) => {
    setAuditFor(it);
    setAuditLoading(true);
    try {
      const r = await listAdminStoreItemAudits(it.id, 50);
      setAudits(r);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <ScreenFrame>
      <div
        style={{
          width: "100%",
          minHeight: 900,
          background: p.bg,
          fontFamily: FONT.sans,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="store" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.bolt size={14} /> 스쿱 마켓 · 자기 회사 카탈로그
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                상품 {summary.total} · 활성 {summary.active} · 비활성 {summary.inactive}
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                카테고리 {summary.categories}개. 변경은 모두 이력으로 남습니다(누가·언제·무엇을).
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => itemsQ.refetch()}>새로고침</Btn>
              <Btn p={p} variant="dark" size="md" onClick={openCreate}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} /> 상품 추가
                </span>
              </Btn>
            </div>
          </div>

          {/* 필터 바 — 검색 + 활성 칩 (한 줄) */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름·제휴사·코드·카테고리·설명 검색"
              style={{ flex: "1 1 280px", minWidth: 240, padding: "9px 12px", borderRadius: 9, border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.surface, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map((f) => {
                const on = activeFilter === f;
                const label = f === "ALL" ? "전체" : f === "ACTIVE" ? "활성" : "비활성";
                return (
                  <div
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      padding: "8px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                      color: on ? p.surface : p.inkMuted, background: on ? p.ink : p.surface,
                      border: `1px solid ${on ? p.ink : p.line}`, cursor: on ? "default" : "pointer",
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
          {/* 카테고리 칩 — 가로 스크롤 가능, 동적 목록 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: p.inkMuted, marginRight: 2 }}>카테고리</span>
            <CategoryChip label="전체" on={categoryFilter === "__ALL__"} onClick={() => setCategoryFilter("__ALL__")} p={p} />
            {categories.map((c) => (
              <CategoryChip key={c} label={c} on={categoryFilter === c} onClick={() => setCategoryFilter(c)} p={p} />
            ))}
            {items.some((it) => !it.category) && (
              <CategoryChip label="(미분류)" on={categoryFilter === ""} onClick={() => setCategoryFilter("")} p={p} />
            )}
          </div>

          <DataGrid<AdminStoreItem>
            p={p}
            rows={filtered}
            rowKey={(it) => it.id}
            loading={itemsQ.loading}
            error={itemsQ.error}
            emptyText={items.length === 0 ? "등록된 상품이 없습니다. 「상품 추가」로 시작하세요." : "조건에 맞는 상품이 없습니다."}
            rowStyle={(it) => ({ opacity: it.active ? 1 : 0.55 })}
            maxHeight={620}
            columns={[
              {
                key: "displayOrder",
                header: "순서",
                width: "60px",
                align: "left",
                render: (it) => <span className="mono" style={{ color: p.inkMuted }}>{it.displayOrder}</span>,
              },
              {
                key: "sku",
                header: "상품 코드",
                width: "160px",
                align: "left",
                render: (it) => (
                  <span className="mono" style={{ color: p.inkMuted, fontWeight: 600, fontSize: 11 }} title="상품 고유 코드(SKU). 중복 불가">
                    {it.sku}
                  </span>
                ),
              },
              {
                key: "name",
                header: "상품 / 제휴사",
                width: "1.4fr",
                align: "left",
                render: (it) => (
                  <div>
                    <div style={{ color: p.ink, fontWeight: 700 }}>
                      {it.name}
                      {!it.active && (
                        <Pill p={p} size="sm" tone="neutral" style={{ fontSize: 9, marginLeft: 6 }}>비활성</Pill>
                      )}
                    </div>
                    {it.brand && <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>{it.brand}</div>}
                  </div>
                ),
              },
              {
                key: "category",
                header: "카테고리",
                width: "140px",
                align: "left",
                render: (it) => <span style={{ color: p.inkSoft }}>{it.category ?? "—"}</span>,
              },
              {
                key: "priceP",
                header: "가격",
                width: "120px",
                align: "left",
                render: (it) => (
                  <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>{fmt.point(Number(it.priceP))} 콘</span>
                ),
              },
              {
                key: "stock",
                header: "재고",
                width: "90px",
                align: "left",
                render: (it) => (
                  <span className="mono" style={{ color: it.stock === null ? p.inkMuted : p.ink }}>
                    {it.stock === null ? "무제한" : it.stock}
                  </span>
                ),
              },
              {
                key: "updatedAt",
                header: "갱신",
                width: "140px",
                align: "left",
                render: (it) => (
                  <span style={{ color: p.inkMuted, fontSize: 11 }}>
                    {new Date(it.updatedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "작업",
                width: "220px",
                align: "left",
                render: (it) => (
                  <span style={{ display: "inline-flex", gap: 6, marginLeft: -14 }}>
                    <Btn p={p} variant="ghost" size="sm" onClick={() => openEdit(it)}>수정</Btn>
                    <Btn p={p} variant="ghost" size="sm" onClick={() => toggleActive(it)}>
                      {it.active ? "비활성" : "활성"}
                    </Btn>
                    <Btn p={p} variant="ghost" size="sm" onClick={() => openAudits(it)}>이력</Btn>
                  </span>
                ),
              },
            ]}
            footer={
              <span>
                {filtered.length} / 전체 {items.length}건
              </span>
            }
          />
        </div>
      </div>

      {form && (
        <div
          onClick={() => !saving && setForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 520, maxWidth: "92vw", maxHeight: "86vh", background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)", overflow: "auto" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 18 }}>
              {form.id === null ? "상품 추가" : "상품 수정"}
            </div>

            {/* 카테고리 — 가장 먼저 선택. 칩 클릭 시 표시순서가 해당 카테고리 맨 뒤로 자동. */}
            <Field label={form.id === null ? "카테고리 (먼저 골라주세요 · 표시순서 자동 채움)" : "카테고리"}>
              <input
                style={inp(p)}
                value={form.category}
                placeholder="예: 카페 상품권"
                onChange={(e) => {
                  const c = e.target.value;
                  setForm({
                    ...form,
                    category: c,
                    // 신규일 때만 자동 — 수정 시엔 기존 displayOrder 유지(사용자가 직접 편집 가능).
                    displayOrder: form.id === null ? String(nextDisplayOrder(c, items)) : form.displayOrder,
                  });
                }}
              />
              {categories.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: p.inkMuted, fontWeight: 700, alignSelf: "center", marginRight: 2 }}>
                    기존
                  </span>
                  {categories.map((c) => {
                    const on = form.category.trim() === c;
                    return (
                      <CategoryChip
                        key={c}
                        label={c}
                        on={on}
                        onClick={() =>
                          setForm({
                            ...form,
                            category: c,
                            displayOrder: form.id === null ? String(nextDisplayOrder(c, items)) : form.displayOrder,
                          })
                        }
                        p={p}
                      />
                    );
                  })}
                </div>
              )}
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="상품 코드 (영문/숫자, 중복 불가 · 등록 후 변경 X)">
                <input
                  style={inp(p, form.id !== null)}
                  value={form.sku}
                  disabled={form.id !== null}
                  placeholder="예: STARBUCKS-ICED-AME"
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </Field>
              <Field label="표시순서 (작을수록 앞 · 비우면 0)">
                <input
                  style={inp(p)}
                  type="number" step={1}
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label="상품 이름">
              <input style={inp(p)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="제휴사 / 브랜드">
              <input style={inp(p)} value={form.brand} placeholder="예: 스타벅스" onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="설명 (선택)">
              <textarea
                style={{ ...inp(p), minHeight: 60, resize: "vertical" } as CSSProperties}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="가격 (P)">
                <input style={inp(p)} type="number" min={1} step={100} value={form.priceP} onChange={(e) => setForm({ ...form, priceP: e.target.value })} />
              </Field>
              <Field label="재고 (비우면 무제한)">
                <input style={inp(p)} type="number" min={0} step={1} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <Btn p={p} variant="ghost" size="md" disabled={saving} onClick={() => setForm(null)}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={saving} onClick={doSave}>
                {saving ? "저장 중…" : "저장"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {auditFor && (
        <div
          onClick={() => setAuditFor(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 640, maxWidth: "94vw", maxHeight: "86vh", background: p.surface, borderRadius: 16, boxShadow: "0 20px 60px rgba(11,25,41,0.25)", display: "flex", flexDirection: "column" }}
          >
            <div style={{ padding: "18px 22px 12px", borderBottom: `1px solid ${p.line}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: p.ink }}>{auditFor.name} · 변경 이력</div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>SKU <span className="mono">{auditFor.sku}</span></div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
              {auditLoading && <div style={{ padding: 16, fontSize: 12, color: p.inkMuted }}>불러오는 중…</div>}
              {!auditLoading && audits.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: p.inkMuted }}>이력 없음.</div>
              )}
              {!auditLoading && audits.map((a) => (
                <AuditRow key={a.id} a={a} p={p} />
              ))}
            </div>
            <div style={{ padding: "12px 22px 18px", borderTop: `1px solid ${p.line}`, display: "flex", justifyContent: "flex-end" }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => setAuditFor(null)}>닫기</Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}

function AuditRow({ a, p }: { a: StoreItemAudit; p: Palette }) {
  // before/after 핵심 필드 diff 추출.
  const diffKeys = ["name", "brand", "priceP", "stock", "category", "displayOrder", "active", "description"];
  const changes = (a.before && a.after)
    ? diffKeys
        .filter((k) => JSON.stringify(a.before![k]) !== JSON.stringify(a.after![k]))
        .map((k) => ({ key: k, before: a.before![k], after: a.after![k] }))
    : [];
  return (
    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${p.line}`, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Pill p={p} size="sm" tone={a.action === "CREATE" ? "accent" : a.action === "DEACTIVATE" || a.action === "DELETE" ? "danger" : a.action === "ACTIVATE" ? "success" : "neutral"} style={{ fontSize: 10 }}>
            {ACTION_LABEL[a.action]}
          </Pill>
          <span style={{ fontSize: 11, color: p.inkMuted }}>
            {a.actorUserId ? `user#${a.actorUserId}` : "system"}
          </span>
        </span>
        <span style={{ fontSize: 11, color: p.inkMuted }}>
          {new Date(a.createdAt).toLocaleString("ko-KR")}
        </span>
      </div>
      {a.action === "CREATE" && a.after && (
        <div style={{ fontSize: 11, color: p.inkSoft }}>
          최초 등록 — 가격 {String(a.after.priceP ?? "—")} 콘, 카테고리 {String(a.after.category ?? "—")}
        </div>
      )}
      {changes.length > 0 && (
        <div style={{ fontSize: 11, color: p.inkSoft, lineHeight: 1.5 }}>
          {changes.map((c) => (
            <div key={c.key}>
              <b>{c.key}</b>: {String(c.before ?? "—")} → <span style={{ color: p.ink, fontWeight: 700 }}>{String(c.after ?? "—")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, on, onClick, p }: { label: string; on: boolean; onClick: () => void; p: Palette }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: on ? p.surface : p.inkSoft,
        background: on ? p.ink : p.surface,
        border: `1px solid ${on ? p.ink : p.line}`,
        cursor: on ? "default" : "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
        transition: "background .12s, color .12s",
      }}
    >
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const p = PALETTES.cobalt;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function inp(p: Palette, readonly = false): CSSProperties {
  return {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 9,
    border: `1px solid ${p.line}`,
    fontSize: 13,
    color: p.ink,
    background: readonly ? p.bgDeep : p.bg,
    boxSizing: "border-box",
    cursor: readonly ? "not-allowed" : "auto",
  };
}
