<#
  Marp → PPTX / PDF 빌드 (버전 자동 증가 + 이전 버전 olds/ 보관)
  사용법 : 저장소 어디서든  ->  .\presentation\build.ps1
           실행정책 막히면  ->  powershell -ExecutionPolicy Bypass -File .\presentation\build.ps1
  동작   : 다음 번호로 slides_v{N+1}.pptx/.pdf 생성 → 이전 버전 전부 olds\ 로 이동(최신만 남김).
  사전   : Node.js(백엔드에 설치됨), Chrome 권장. 그림 PNG는 미리 렌더(아래 점검).
#>
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $here) { $here = (Get-Location).Path }
$slides = Join-Path $here 'slides-final.md'
$pkg    = '@marp-team/marp-cli@latest'
$olds   = Join-Path $here 'olds'

# next version: scan here + olds
$scan = @($here)
if ($olds -and (Test-Path $olds)) { $scan += $olds }
$nums = Get-ChildItem -Path $scan -Filter 'slides_v*.pptx' -ErrorAction SilentlyContinue |
        ForEach-Object { if ($_.BaseName -match '^slides_v(\d+)$') { [int]$Matches[1] } }
$next = 1
if ($nums) { $next = (($nums | Measure-Object -Maximum).Maximum) + 1 }
$outPptx = Join-Path $here "slides_v$next.pptx"
$outPdf  = Join-Path $here "slides_v$next.pdf"

Write-Host "== Marp 빌드: v$next ==" -ForegroundColor Cyan

# --- 그림 PNG 존재 점검 ---
$umlDir = Join-Path $here '..\docs\03_design\uml'
$imgDir = Join-Path $here 'img'
$need = @()
'usecase','class','sequence','state','activity-year-end','component-hexagonal','object-integrity','activity-deduction' |
  ForEach-Object { if (-not (Test-Path (Join-Path $umlDir "$_.png"))) { $need += "uml/$_.png" } }
'subsystems','architecture-block','clean-arch','usecase-core','class-core','sequence-core','state-core' |
  ForEach-Object { if (-not (Test-Path (Join-Path $imgDir "$_.png"))) { $need += "img/$_.png" } }
if ($need) { Write-Warning ("그림 PNG 누락: {0}  → render-img.py / render-clean-arch.py 먼저 실행" -f ($need -join ', ')) }

# --- 변환 (--allow-local-files: PNG 임베드 / --no-stdin: 멈춤 방지 / --html: 2단 등 HTML) ---
Write-Host "PPTX 생성..." -ForegroundColor Green
npx --yes $pkg $slides --pptx --allow-local-files --no-stdin --html -o $outPptx
if ($LASTEXITCODE -ne 0) { Write-Error 'PPTX 실패 (파일 잠김/Chrome: $env:CHROME_PATH 확인)'; exit 1 }
Write-Host "PDF 생성..." -ForegroundColor Green
npx --yes $pkg $slides --pdf --allow-local-files --no-stdin --html -o $outPdf
if ($LASTEXITCODE -ne 0) { Write-Error 'PDF 실패'; exit 1 }

# --- olds\ 준비 + 이 버전의 소스 md 스냅샷 (slides_vN.md / script_vN.md) ---
# slides-final.md(데모용) 빌드는 demo-scenario.md를 짝으로, slides.md(설계용)는 script.md를 짝으로.
New-Item -ItemType Directory -Force -Path $olds | Out-Null
Copy-Item -LiteralPath $slides -Destination (Join-Path $olds "slides_v$next.md") -Force
$pairCandidates = @()
if ([System.IO.Path]::GetFileName($slides) -eq 'slides-final.md') {
  $pairCandidates += (Join-Path $here 'demo-scenario.md')
}
$pairCandidates += (Join-Path $here 'script.md')
foreach ($scriptMd in $pairCandidates) {
  if (Test-Path $scriptMd) {
    Copy-Item -LiteralPath $scriptMd -Destination (Join-Path $olds "script_v$next.md") -Force
    break
  }
}

# --- 이전 버전 출력물(+레거시 slides.*)을 olds\ 로 이동 (방금 만든 vN은 유지) ---
$moved = 0
Get-ChildItem -Path $here -Filter 'slides*.pptx' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "slides_v$next.pptx" } | ForEach-Object {
    $f = $_
    try { Move-Item $f.FullName -Destination $olds -Force; $moved++ }
    catch { Write-Warning "olds 이동 실패(열려있음?): $($f.Name)" } }
Get-ChildItem -Path $here -Filter 'slides*.pdf' -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "slides_v$next.pdf" } | ForEach-Object {
    $f = $_
    try { Move-Item $f.FullName -Destination $olds -Force; $moved++ }
    catch { Write-Warning "olds 이동 실패(열려있음?): $($f.Name)" } }

Write-Host ("OK  최신: slides_v{0}.pptx / .pdf   (소스 slides_v{0}.md·script_v{0}.md + 이전 출력물 {1}개 → olds\)" -f $next, $moved) -ForegroundColor Cyan
