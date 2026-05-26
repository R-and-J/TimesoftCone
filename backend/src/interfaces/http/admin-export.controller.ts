// 정산 데이터 핸드오프 export — 도입사 HR/급여로 넘길 CSV·JSON (ADR-021).
// RBAC는 아직 없음(scope-cuts CUT-8) — 후속 PR에서 ADMIN 가드.

import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
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
