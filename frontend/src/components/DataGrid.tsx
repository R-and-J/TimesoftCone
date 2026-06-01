// 공통 데이터 그리드 — 모든 표(원장/회원/교환신청/내 활동)가 공유하는 헤더 밴드·
// 스크롤·zebra·상태(로딩/에러/빈) 처리를 한 곳에 모은다. 셀 렌더링은 columns로 주입.
// 헤더 스타일(bgDeep 밴드 + 외곽 테두리)을 바꿀 땐 이 파일만 고치면 전 화면에 반영된다.

import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "@/lib/tokens";
import { Card } from "@/components/atoms";

export type GridColumn<T> = {
  key: string;
  header: ReactNode;
  /** CSS grid track. 미지정 시 "1fr". 예: "70px" | "1.2fr" */
  width?: string;
  /** 헤더·셀 공통 정렬. */
  align?: "left" | "right" | "center";
  /** 셀 내용. 미지정 시 row[key]를 그대로 출력. */
  render?: (row: T, index: number) => ReactNode;
};

type DataGridProps<T> = {
  p: Palette;
  columns: GridColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  error?: Error | null;
  /** 행이 없을 때 보여줄 안내. */
  emptyText?: ReactNode;
  /** 짝수 행 음영(기본 true). rowBackground가 있으면 무시된다. */
  zebra?: boolean;
  /** 행 배경을 직접 결정(예: 낙찰 행 강조). zebra보다 우선. */
  rowBackground?: (row: T, index: number) => string | undefined;
  /** 행 왼쪽 색 테두리(예: 원장 액션 색). */
  rowAccent?: (row: T, index: number) => string | undefined;
  /** 행에 덧입힐 스타일(예: 비활성 회원 흐리게). */
  rowStyle?: (row: T, index: number) => CSSProperties | undefined;
  onRowClick?: (row: T, index: number) => void;
  /** 본문 스크롤 최대 높이. 미지정 시 카드 높이를 꽉 채운다(fill). */
  maxHeight?: number | string;
  /** 행 패딩(기본 "13px 20px"). */
  rowPadding?: string;
  /** 행 글자 크기(기본 12). */
  rowFontSize?: number;
  /** 하단 푸터(예: "총 N건" + 더보기). */
  footer?: ReactNode;
  /** 카드가 부모 높이를 채우도록(flex:1). */
  fill?: boolean;
  /** 카드 스타일 덮어쓰기. */
  style?: CSSProperties;
};

export function DataGrid<T>({
  p,
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyText = "표시할 항목이 없습니다.",
  zebra = true,
  rowBackground,
  rowAccent,
  rowStyle,
  onRowClick,
  maxHeight,
  rowPadding = "13px 20px",
  rowFontSize = 12,
  footer,
  fill,
  style,
}: DataGridProps<T>) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <Card
      p={p}
      padding={0}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        border: `1px solid ${p.bgDeep}`,
        overflow: "hidden",
        ...(fill ? { flex: 1 } : null),
        ...style,
      }}
    >
      {/* 헤더 밴드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: template,
          padding: "13px 20px",
          fontSize: 11,
          color: p.inkSoft,
          fontWeight: 700,
          letterSpacing: 0.4,
          borderBottom: `1px solid ${p.line}`,
          background: p.bgDeep,
        }}
      >
        {columns.map((c) => (
          <div key={c.key} style={{ textAlign: c.align, minWidth: 0 }}>
            {c.header}
          </div>
        ))}
      </div>

      {/* 본문 */}
      <div style={maxHeight != null ? { overflow: "auto", maxHeight } : { overflow: "auto", flex: 1 }}>
        {error && (
          <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>
            {error.message}
          </div>
        )}
        {!error && rows.length === 0 && !loading && (
          <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
            {emptyText}
          </div>
        )}
        {rows.map((row, i) => {
          const accent = rowAccent?.(row, i);
          const bg = rowBackground?.(row, i) ?? (zebra && i % 2 === 1 ? p.bg : p.surface);
          return (
            <div
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: template,
                padding: rowPadding,
                fontSize: rowFontSize,
                alignItems: "center",
                background: bg,
                borderBottom: `1px solid ${p.line}`,
                ...(accent ? { borderLeft: `3px solid ${accent}` } : null),
                ...(onRowClick ? { cursor: "pointer" } : null),
                ...rowStyle?.(row, i),
              }}
            >
              {columns.map((c) => (
                <div key={c.key} style={{ textAlign: c.align, minWidth: 0 }}>
                  {c.render ? c.render(row, i) : ((row as Record<string, unknown>)[c.key] as ReactNode)}
                </div>
              ))}
            </div>
          );
        })}
        {loading && (
          <div style={{ padding: 16, textAlign: "center", color: p.inkMuted, fontSize: 12 }}>
            불러오는 중…
          </div>
        )}
      </div>

      {footer != null && (
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${p.line}`,
            background: p.bg,
            fontSize: 11,
            color: p.inkMuted,
          }}
        >
          {footer}
        </div>
      )}
    </Card>
  );
}
