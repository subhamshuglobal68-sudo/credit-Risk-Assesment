"""Auto-commit and auto-push service for Git repository.

Monitors working tree for modifications, untracked files, or deletions.
Debounces edits by waiting for changes to settle, stages changes, commits with
descriptive metadata, and pushes to remote.
"""

import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Working directory is the project root (parent of scripts/)
REPO_ROOT = Path(__file__).resolve().parent.parent
POLL_INTERVAL_SECONDS = 3
DEBOUNCE_WAIT_SECONDS = 3


def run_cmd(cmd, cwd=REPO_ROOT):
    try:
        res = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def get_git_status():
    code, out, _ = run_cmd("git status --porcelain")
    if code != 0:
        return []
    lines = [line.strip() for line in out.splitlines() if line.strip()]
    return lines


def commit_and_push(changed_lines):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    files_summary = []
    for line in changed_lines[:5]:
        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            files_summary.append(parts[1])
        else:
            files_summary.append(line)
    
    extra = f" and {len(changed_lines) - 5} more" if len(changed_lines) > 5 else ""
    summary_str = ", ".join(files_summary) + extra

    print(f"[{timestamp}] Changes detected in {len(changed_lines)} file(s). Staging...")
    
    # Stage all changes respecting .gitignore
    code, _, err = run_cmd("git add .")
    if code != 0:
        print(f"[{timestamp}] Error staging files: {err}")
        return

    # Check if there is anything actually staged
    code, out, _ = run_cmd("git status --porcelain")
    if not out:
        print(f"[{timestamp}] Nothing to commit after staging.")
        return

    commit_msg = f"Auto-commit: update {summary_str} [{timestamp}]"
    print(f"[{timestamp}] Committing: {commit_msg}")
    code, out, err = run_cmd(f'git commit -m "{commit_msg}"')
    if code != 0:
        print(f"[{timestamp}] Commit failed: {err} {out}")
        return

    print(f"[{timestamp}] Pushing to origin main...")
    code, out, err = run_cmd("git push origin main")
    if code == 0:
        print(f"[{timestamp}] Successfully pushed changes to GitHub.")
    else:
        print(f"[{timestamp}] Push warning (will retry on next change): {err or out}")


def main():
    print(f"==================================================")
    print(f"Git Auto-Commit Watcher Started")
    print(f"Monitoring: {REPO_ROOT}")
    print(f"Remote: https://github.com/subhamshuglobal68-sudo/credit-Risk-Assesment")
    print(f"Poll interval: {POLL_INTERVAL_SECONDS}s, Debounce: {DEBOUNCE_WAIT_SECONDS}s")
    print(f"Press Ctrl+C to stop.")
    print(f"==================================================")

    while True:
        try:
            status_lines = get_git_status()
            if status_lines:
                # Changes detected, wait debounce interval to ensure saving is complete
                time.sleep(DEBOUNCE_WAIT_SECONDS)
                # Re-check status after debounce
                latest_status = get_git_status()
                if latest_status:
                    commit_and_push(latest_status)
            time.sleep(POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            print("\nAuto-commit watcher stopped by user.")
            break
        except Exception as ex:
            print(f"Unexpected error in watcher loop: {ex}")
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
