// 정산 데이터 핸드오프 export — 도입사 HR/급여로 넘길 CSV·JSON (ADR-021).
// RBAC는 아직 없음(scope-cuts CUT-8) — 후속 PR에서 ADMIN 가드.

import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { Workbook } from "exceljs";
import { ExportSettlementUseCase } from "@/application/admin/export-settlement.use-case";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "﻿";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return "﻿" + lines.join("\r\n"); // BOM → Excel이 한글 UTF-8 인식
}

function toMarkdown(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "_(데이터 없음)_\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${headers.map((h) => esc(r[h])).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

function send(res: Response, format: string, rows: Record<string, unknown>[], filename: string) {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(toCsv(rows));
  } else if (format === "md") {
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.md"`);
    res.send(toMarkdown(rows));
  } else {
    res.json(rows);
  }
}

@Controller("api/admin/export")
export class AdminExportController {
  constructor(private readonly exporter: ExportSettlementUseCase) {}

  /**
   * 결합 export — 선택한 항목들을 한 파일로 (다중 다운로드 회피).
   *   ?sets=leave-grants,dividends,spending  (생략 시 전체)
   *   &format=xlsx|md|json                   (기본 xlsx 멀티시트)
   * xlsx: 항목당 시트 1개 / md: 항목당 ## 섹션 / json: { key: rows }.
   */
  @Get()
  async combined(
    @Query("sets") setsRaw = "",
    @Query("format") format = "xlsx",
    @Res() res: Response,
  ) {
    const SETS: Record<string, { label: string; key: string; fetch: () => Promise<any[]> }> = {
      "leave-grants": { label: "낙찰 연차 부여 내역", key: "leaveGrants", fetch: () => this.exporter.leaveGrants() },
      dividends: { label: "연말 배당 내역", key: "dividends", fetch: () => this.exporter.dividends() },
      spending: { label: "지출 내역", key: "spending", fetch: () => this.exporter.spending() },
    };
    let keys = setsRaw.split(",").map((s) => s.trim()).filter((k) => k in SETS);
    if (keys.length === 0) keys = Object.keys(SETS);
    const datasets = await Promise.all(keys.map(async (k) => ({ ...SETS[k], rows: await SETS[k].fetch() })));

    if (format === "md") {
      const parts = ["# 정산 데이터 export", ""];
      for (const ds of datasets) parts.push(`## ${ds.label}`, "", toMarkdown(ds.rows), "");
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="settlement.md"`);
      res.send(parts.join("\n"));
      return;
    }
    if (format === "json") {
      const obj: Record<string, unknown> = {};
      for (const ds of datasets) obj[ds.key] = ds.rows;
      res.json(obj);
      return;
    }
    // xlsx (멀티시트): 항목당 시트 1개
    const wb = new Workbook();
    for (const ds of datasets) {
      const ws = wb.addWorksheet(ds.label.slice(0, 31)); // 엑셀 시트명 31자 제한
      const headers = ds.rows.length ? Object.keys(ds.rows[0]) : ["(데이터 없음)"];
      ws.addRow(headers);
      ws.getRow(1).font = { bold: true };
      for (const r of ds.rows) ws.addRow(headers.map((h) => r[h] ?? ""));
      ws.columns.forEach((c) => (c.width = 20));
    }
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="settlement.xlsx"`);
    res.end(Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer));
  }

  /** 낙찰 AUCTION 연차 부여 내역. ?format=csv|json|md (기본 json) */
  @Get("leave-grants")
  async leaveGrants(@Query("format") format = "json", @Res() res: Response) {
    send(res, format, await this.exporter.leaveGrants(), "leave-grants");
  }

  /** 연말 배당 내역. ?format=csv|json|md */
  @Get("dividends")
  async dividends(@Query("format") format = "json", @Res() res: Response) {
    send(res, format, await this.exporter.dividends(), "dividends");
  }

  /** 지출 내역 — 누가 얼마나 썼나(낙찰 escrow 기여). ?format=csv|json|md */
  @Get("spending")
  async spending(@Query("format") format = "json", @Res() res: Response) {
    send(res, format, await this.exporter.spending(), "spending");
  }
}
