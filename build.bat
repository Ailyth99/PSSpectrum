@echo off
chcp 65001 >nul
wails build
if %errorlevel% equ 0 (
    echo.
    echo   - ffmpeg.exe
    echo   - bin\ps2str.exe
    echo   - bin\vgmstream-cli.exe
)
pause
