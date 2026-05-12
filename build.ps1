$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExeName = "starsector-devtool.exe"
$ReleaseDir = Join-Path $ProjectDir "release"
$SourceExe = Join-Path $ProjectDir "src-tauri\target\release\$ExeName"
$TargetExe = Join-Path $ReleaseDir "Starsector_DevTool.exe"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Starsector DevTool Build Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $ProjectDir "package.json"))) {
    Write-Host "[ERROR] package.json not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $ProjectDir "src-tauri\Cargo.toml"))) {
    Write-Host "[ERROR] src-tauri\Cargo.toml not found." -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Stopping running Starsector DevTool processes..." -ForegroundColor Yellow
Get-Process -Name "starsector-devtool" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "Starsector_DevTool" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Cleared." -ForegroundColor Green

Write-Host ""
$DistDir = Join-Path $ProjectDir "dist"
if (Test-Path $DistDir) {
    Write-Host "[2/5] Cleaning frontend output..." -ForegroundColor Yellow
    Remove-Item -LiteralPath $DistDir -Recurse -Force
}

Write-Host "[3/5] Building Tauri executable without installer bundle..." -ForegroundColor Yellow
npm --prefix $ProjectDir run tauri -- build --no-bundle
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Tauri build failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[4/5] Preparing single-file release..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
Copy-Item -Force $SourceExe $TargetExe
Write-Host "  [OK] $TargetExe" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Done. No installer package was generated." -ForegroundColor Yellow

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
