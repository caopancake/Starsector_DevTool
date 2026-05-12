@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "EXE_NAME=starsector-devtool.exe"
set "RELEASE_DIR=%PROJECT_DIR%\release"
set "SOURCE_EXE=%PROJECT_DIR%\src-tauri\target\release\%EXE_NAME%"
set "TARGET_EXE=%RELEASE_DIR%\Starsector_DevTool.exe"

echo ============================================
echo   Starsector DevTool Build Script
echo ============================================
echo.

if not exist "%PROJECT_DIR%\package.json" (
    echo [ERROR] package.json not found. Run from project root.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\src-tauri\Cargo.toml" (
    echo [ERROR] src-tauri\Cargo.toml not found.
    pause
    exit /b 1
)

echo [1/5] Stopping running Starsector DevTool processes...
taskkill /f /im starsector-devtool.exe >nul 2>&1
taskkill /f /im Starsector_DevTool.exe >nul 2>&1
echo   [OK] Cleared.

echo.
if exist "%PROJECT_DIR%\dist" (
    echo [2/5] Cleaning frontend output...
    rmdir /s /q "%PROJECT_DIR%\dist"
)

echo [3/5] Building Tauri executable without installer bundle...
call npm --prefix "%PROJECT_DIR%" run tauri -- build --no-bundle
if errorlevel 1 (
    echo [ERROR] Tauri build failed.
    pause
    exit /b 1
)

echo.
echo [4/5] Preparing single-file release...
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
copy /y "%SOURCE_EXE%" "%TARGET_EXE%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy release executable.
    pause
    exit /b 1
)
echo   [OK] %TARGET_EXE%

echo.
echo [5/5] Done. No installer package was generated.

echo.
echo ============================================
echo   Build complete!
echo ============================================
echo.
