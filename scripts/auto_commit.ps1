# PowerShell Auto-Commit Watcher for Git
# Continuously monitors repository for file changes, stages, commits, and pushes to remote.

param(
    [int]$PollInterval = 3,
    [int]$DebounceSeconds = 3
)

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Git Auto-Commit Watcher Started" -ForegroundColor Green
Write-Host "Monitoring: $RepoRoot"
Write-Host "Remote: https://github.com/subhamshuglobal68-sudo/credit-Risk-Assesment"
Write-Host "Poll Interval: ${PollInterval}s | Debounce: ${DebounceSeconds}s"
Write-Host "Press Ctrl+C to stop."
Write-Host "=================================================="

while ($true) {
    try {
        $status = git status --porcelain
        if ($status) {
            Start-Sleep -Seconds $DebounceSeconds
            $latestStatus = git status --porcelain
            if ($latestStatus) {
                $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                Write-Host "[$timestamp] Changes detected. Staging files..." -ForegroundColor Yellow
                git add .
                
                $staged = git status --porcelain
                if ($staged) {
                    $commitMsg = "Auto-commit: changes saved [$timestamp]"
                    Write-Host "[$timestamp] Committing: $commitMsg" -ForegroundColor Cyan
                    git commit -m "$commitMsg"
                    
                    Write-Host "[$timestamp] Pushing to origin main..." -ForegroundColor Magenta
                    git push origin main
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "[$timestamp] Successfully pushed to GitHub!" -ForegroundColor Green
                    } else {
                        Write-Warning "[$timestamp] Push failed or network issue. Will retry on next commit."
                    }
                }
            }
        }
        Start-Sleep -Seconds $PollInterval
    }
    catch {
        Write-Error "Watcher error: $_"
        Start-Sleep -Seconds $PollInterval
    }
}
