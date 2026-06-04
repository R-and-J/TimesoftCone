// 공통 데이터 그리드 — 모든 표(원장/회원/교환신청/내 활동)가 공유하는 헤더 밴드·
// 스크롤·zebra·상태(로딩/에러/빈) 처리를 한 곳에 모은다. 셀 렌더링은 columns로 주입.
// 헤더 스타일(bgDeep 밴드 + 외곽 테두리)을 바꿀 땐 이 파일만 고치면 전 화면에 반영된다.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Palette } from "@/lib/tokens";
import { Card } from "@/components/atoms";

/** rowPadding("13px 20px", "16px", "13px 20px 13px 20px" 등)에서 우측 padding 값만 추출. */
function parseRowPaddingRight(rp: string): string {
  const parts = rp.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[1];
  if (parts.length === 3) return parts[1];
  return parts[1]; // 4값: top right bottom left
}

/** 시스템 스크롤바 폭을 한 번 측정해 캐싱. 본문 scrollbar-gutter:stable 가 예약하는
 *  실제 폭과 동일하게, 헤더 우측에 동일 보정을 주어 컬럼 트랙이 어긋나지 않게 한다. */
let cachedScrollbarWidth: number | null = null;
function measureScrollbarWidth(): number {
  if (cachedScrollbarWidth !== null) return cachedScrollbarWidth;
  if (typeof document === "undefined") return 0;
  const div = document.createElement("div");
  div.style.cssText = "overflow:scroll;width:50px;height:50px;visibility:hidden;position:absolute;top:-1000px;";
  document.body.appendChild(div);
  cachedScrollbarWidth = div.offsetWidth - div.clientWidth;
  document.body.removeChild(div);
  return cachedScrollbarWidth;
}

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
  /** 컬럼 사이 가로 간격(기본 16). */
  columnGap?: number;
  /** 행 안에서 셀의 세로 정렬. 멀티라인 셀이 많으면 "start"가 자연스럽다(기본 "center"). */
  rowAlign?: "start" | "center" | "end";
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
  columnGap = 16,
  rowAlign = "center",
  footer,
  fill,
  style,
}: DataGridProps<T>) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");
  // 본문이 scrollable(maxHeight 있음)일 때만 헤더에 우측 보정. fill/no-maxHeight 경우는 본문도
  // 스크롤 영역 없으니 보정 불필요. 클라이언트에서만 측정 — SSR-safe.
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  useEffect(() => {
    if (maxHeight != null) setScrollbarWidth(measureScrollbarWidth());
  }, [maxHeight]);

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
      {/* 헤더 밴드 — globals.css의 .dg-header 가 invisible scrollbar 공간을 차지해
          본문 grid와 가용 폭을 일치시킴(컬럼 어긋남 방지).
          padding은 rowPadding을 그대로 따른다 — 본문이 다른 padding 쓰면 헤더도 같이 움직여
          좌우 트랙 시작·끝이 정확히 일치. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: template,
          columnGap,
          padding: rowPadding,
          // 본문 scrollbar-gutter:stable 가 우측에 폭만큼 빠지는 만큼, 헤더 우측에도
          // 동일 보정을 padding으로 추가해 grid 가용 폭을 정확히 일치시킨다.
          // paddingRight 단독으로 override — 배경이 보정 영역까지 덮어 흰 공간 노출 X.
          paddingRight: `calc(${parseRowPaddingRight(rowPadding)} + ${scrollbarWidth}px)`,
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

      {/* 본문 — scrollbar-gutter: stable 로 세로 스크롤 유무와 무관하게
          가용 폭을 고정 → 헤더 grid와 본문 grid의 컬럼 트랙이 항상 일치. */}
      <div style={maxHeight != null
        ? { overflow: "auto", maxHeight, scrollbarGutter: "stable" }
        : { overflow: "auto", flex: 1, scrollbarGutter: "stable" }}>
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
                columnGap,
                padding: rowPadding,
                fontSize: rowFontSize,
                alignItems: rowAlign,
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
