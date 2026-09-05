@echo off
title Git Auto-Commit Service - Credit Risk Assessment
echo Starting Git Auto-Commit Watcher...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto_commit.ps1"
pause
