// 정산 데이터 핸드오프 export — 도입사 HR/급여로 넘길 CSV·MD·JSON·xlsx (ADR-021).
// RBAC는 아직 없음(scope-cuts CUT-8) — 후속 PR에서 ADMIN 가드.
//
// 사람이 보는 포맷(csv/md/xlsx)은 한글 헤더 + 한글 파일명(프로젝트명 포함)으로 내보낸다.
// json은 시스템 연동용이라 원본 영문 키를 유지.

import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Workbook } from "exceljs";
import { ExportSettlementUseCase } from "@/application/admin/export-settlement.use-case";
import { Roles, ADMIN_ROLES } from "./auth/auth.decorators";

const PROJECT = "타임소프트콘";

type Row = Record<string, unknown>;
type Labels = Record<string, string>;

/** 행의 키 순서 + 그에 대응하는 한글 헤더(라벨 없으면 키 그대로). */
function columnsOf(rows: Row[], labels: Labels): { keys: string[]; heads: string[] } {
  const keys = rows.length ? Object.keys(rows[0]) : Object.keys(labels);
  return { keys, heads: keys.map((k) => labels[k] ?? k) };
}

function toCsv(rows: Row[], labels: Labels): string {
  const { keys, heads } = columnsOf(rows, labels);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [heads.join(",")];
  for (const r of rows) lines.push(keys.map((k) => esc(r[k])).join(","));
  return "﻿" + lines.join("\r\n"); // BOM → Excel이 한글 UTF-8 인식
}

function toMarkdown(rows: Row[], labels: Labels): string {
  if (rows.length === 0) return "_(데이터 없음)_\n";
  const { keys, heads } = columnsOf(rows, labels);
  const esc = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const head = `| ${heads.join(" | ")} |`;
  const sep = `| ${heads.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${keys.map((k) => esc(r[k])).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

/**
 * 합산 가능한 열(totalKeys)을 더한 "합계" 행을 만들어 rows 뒤에 붙인다(사람용 포맷 전용).
 * 첫 컬럼에 "합계" 라벨, 합산 대상 외 텍스트열은 공백. rows가 비면 그대로 반환.
 */
function withTotal(rows: Row[], totalKeys: string[]): Row[] {
  if (rows.length === 0 || totalKeys.length === 0) return rows;
  const cols = Object.keys(rows[0]);
  const total: Row = {};
  for (const c of cols) {
    total[c] = totalKeys.includes(c)
      ? rows.reduce((s, r) => s + (Number(r[c]) || 0), 0)
      : "";
  }
  total[cols[0]] = "합계";
  return [...rows, total];
}

/** YYYYMMDD (파일명용, 서버 로컬=KST). */
function ymd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * 한글 파일명 다운로드 헤더. 한글은 RFC 5987 filename*=UTF-8''<percent> 로 보내고,
 * 구형 클라이언트용 ASCII fallback도 함께 둔다.
 */
function download(res: Response, mime: string, ext: string, koLabel: string): void {
  const fname = `${PROJECT}_${koLabel}_${ymd()}.${ext}`;
  res.setHeader("Content-Type", mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="export.${ext}"; filename*=UTF-8''${encodeURIComponent(fname)}`,
  );
}

const MIME = {
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

@Roles(...ADMIN_ROLES)
@Controller("api/admin/export")
export class AdminExportController {
  constructor(private readonly exporter: ExportSettlementUseCase) {}

  /** 항목별 메타: 한글 헤더 라벨 + 파일/시트 한글명 + json 키 + 데이터 소스. */
  private datasets() {
    return {
      "leave-grants": {
        sheet: "낙찰 연차 부여 내역",
        file: "낙찰연차부여내역",
        jsonKey: "leaveGrants",
        totalKeys: ["days", "amountPoint"],
        labels: {
          empId: "사번",
          name: "이름",
          email: "이메일",
          year: "연도",
          leaveType: "휴가유형",
          days: "부여일수",
          auctionId: "경매번호",
          amountPoint: "낙찰콘",
          grantedAt: "부여일시",
        } as Labels,
        fetch: () => this.exporter.leaveGrants() as Promise<Row[]>,
      },
      dividends: {
        sheet: "연말 배당 내역",
        file: "연말배당내역",
        jsonKey: "dividends",
        totalKeys: ["contributedDays", "dividendPoint"],
        labels: {
          empId: "사번",
          name: "이름",
          contributedDays: "기여일수",
          stakePct: "지분율(%)",
          dividendPoint: "배당콘",
        } as Labels,
        fetch: () => this.exporter.dividends() as Promise<Row[]>,
      },
      spending: {
        sheet: "지출 내역",
        file: "지출내역",
        jsonKey: "spending",
        totalKeys: ["spentPoint", "wins"],
        labels: {
          empId: "사번",
          name: "이름",
          spentPoint: "지출콘",
          wins: "낙찰건수",
        } as Labels,
        fetch: () => this.exporter.spending() as Promise<Row[]>,
      },
    };
  }

  /** 단일 항목 응답을 format에 맞게 직렬화. */
  private sendOne(
    res: Response,
    format: string,
    rows: Row[],
    meta: { file: string; labels: Labels; totalKeys: string[] },
  ): void {
    if (format === "csv") {
      download(res, MIME.csv, "csv", meta.file);
      res.send(toCsv(withTotal(rows, meta.totalKeys), meta.labels));
    } else if (format === "md") {
      download(res, MIME.md, "md", meta.file);
      res.send(toMarkdown(withTotal(rows, meta.totalKeys), meta.labels));
    } else {
      res.json(rows); // json은 영문 키 유지(시스템 연동용) — 합계 행 없음
    }
  }

  /**
   * 결합 export — 선택한 항목들을 한 파일로 (다중 다운로드 회피).
   *   ?sets=leave-grants,dividends,spending  (생략 시 전체)
   *   &format=xlsx|md|json                   (기본 xlsx 멀티시트)
   * xlsx: 항목당 시트 1개 / md: 항목당 ## 섹션 / json: { jsonKey: rows }.
   */
  @Get()
  async combined(
    @Query("sets") setsRaw = "",
    @Query("format") format = "xlsx",
    @Res() res: Response,
  ) {
    const DS = this.datasets();
    let keys = setsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((k): k is keyof typeof DS => k in DS);
    if (keys.length === 0) keys = Object.keys(DS) as (keyof typeof DS)[];

    const data = await Promise.all(
      keys.map(async (k) => ({ ...DS[k], rows: await DS[k].fetch() })),
    );

    if (format === "md") {
      const parts = [`# ${PROJECT} 정산 데이터`, ""];
      for (const d of data)
        parts.push(`## ${d.sheet}`, "", toMarkdown(withTotal(d.rows, d.totalKeys), d.labels), "");
      download(res, MIME.md, "md", "정산데이터");
      res.send(parts.join("\n"));
      return;
    }
    if (format === "json") {
      const obj: Record<string, unknown> = {};
      for (const d of data) obj[d.jsonKey] = d.rows;
      res.json(obj);
      return;
    }

    // xlsx (멀티시트): 항목당 시트 1개, 한글 헤더 + 콘열 천단위 서식
    const wb = new Workbook();
    for (const d of data) {
      const ws = wb.addWorksheet(d.sheet.slice(0, 31)); // 엑셀 시트명 31자 제한
      const rowsT = withTotal(d.rows, d.totalKeys);
      const hasTotal = rowsT.length > d.rows.length;
      const { keys: cols, heads } = columnsOf(rowsT, d.labels);
      ws.addRow(heads.length ? heads : ["(데이터 없음)"]);
      ws.getRow(1).font = { bold: true };
      for (const r of rowsT) ws.addRow(cols.map((c) => r[c] ?? ""));
      if (hasTotal) ws.getRow(ws.rowCount).font = { bold: true }; // 합계 행 강조
      cols.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = 20;
        if (c.endsWith("Cone")) col.numFmt = "#,##0"; // 콘열은 천단위 콤마
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    download(res, MIME.xlsx, "xlsx", "정산데이터");
    res.end(Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer));
  }

  /** 낙찰 AUCTION 연차 부여 내역. ?format=csv|json|md (기본 json) */
  @Get("leave-grants")
  async leaveGrants(@Query("format") format = "json", @Res() res: Response) {
    const ds = this.datasets()["leave-grants"];
    this.sendOne(res, format, await ds.fetch(), ds);
  }

  /** 연말 배당 내역. ?format=csv|json|md */
  @Get("dividends")
  async dividends(@Query("format") format = "json", @Res() res: Response) {
    const ds = this.datasets().dividends;
    this.sendOne(res, format, await ds.fetch(), ds);
  }

  /** 지출 내역 — 누가 얼마나 썼나(낙찰 escrow 기여). ?format=csv|json|md */
  @Get("spending")
  async spending(@Query("format") format = "json", @Res() res: Response) {
    const ds = this.datasets().spending;
    this.sendOne(res, format, await ds.fetch(), ds);
  }
}
