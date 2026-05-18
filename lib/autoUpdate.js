import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import log from "./logger.js";

const execAsync = promisify(exec);

const REPO_DIR = process.cwd();

/**
 * Get current local git HEAD commit hash
 */
async function getLocalHead() {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", { cwd: REPO_DIR });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get remote git HEAD commit hash (fetch first)
 */
async function getRemoteHead() {
  try {
    await execAsync("git fetch origin master", { cwd: REPO_DIR });
    const { stdout } = await execAsync("git rev-parse origin/master", { cwd: REPO_DIR });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get list of changed files between local and remote
 */
async function getChangedFiles() {
  try {
    const { stdout } = await execAsync("git diff --name-only HEAD origin/master", { cwd: REPO_DIR });
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get commit log between local and remote
 */
async function getCommitLog() {
  try {
    const { stdout } = await execAsync(
      'git log --oneline HEAD..origin/master --no-merges',
      { cwd: REPO_DIR }
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Run npm install (only if package.json or package-lock.json changed)
 */
async function npmInstallIfNeeded(changedFiles) {
  const needsInstall = changedFiles.some(f =>
    f === "package.json" || f === "package-lock.json" || f.startsWith("lib/")
  );
  if (!needsInstall) {
    log.info("Auto-update: No npm install needed");
    return false;
  }
  log.info("Auto-update: Running npm install (deps changed)...");
  try {
    await execAsync("npm install --no-audit --no-fund 2>&1", {
      cwd: REPO_DIR,
      env: { ...process.env, GYP_DEFINES: "android_ndk_path=''" },
    });
    log.info("Auto-update: npm install completed");
    return true;
  } catch (err) {
    log.error(`Auto-update: npm install failed — ${err.message}`);
    return false;
  }
}

/**
 * Pull latest changes from remote
 */
async function gitPull() {
  try {
    const { stdout } = await execAsync("git pull origin master --no-rebase 2>&1", { cwd: REPO_DIR });
    return { success: true, output: stdout.trim() };
  } catch (err) {
    return { success: false, output: err.message };
  }
}

/**
 * Restart PM2 process
 */
async function restartPM2() {
  try {
    await execAsync("pm2 restart basewa 2>&1");
    return true;
  } catch (err) {
    log.error(`Auto-update: PM2 restart failed — ${err.message}`);
    return false;
  }
}

/**
 * Check for updates (no action, just info)
 * Returns { hasUpdate, localHead, remoteHead, commits, changedFiles }
 */
export async function checkUpdate() {
  const localHead = await getLocalHead();
  const remoteHead = await getRemoteHead();

  if (!localHead || !remoteHead) {
    return { hasUpdate: false, error: "Gagal cek git HEAD", localHead, remoteHead, commits: [], changedFiles: [] };
  }

  if (localHead === remoteHead) {
    return { hasUpdate: false, localHead, remoteHead, commits: [], changedFiles: [] };
  }

  const commits = await getCommitLog();
  const changedFiles = await getChangedFiles();

  return { hasUpdate: true, localHead, remoteHead, commits, changedFiles };
}

/**
 * Perform full update: pull → npm install → restart
 * Returns result object with status info
 */
export async function doUpdate() {
  // 1. Check if update available
  const check = await checkUpdate();
  if (!check.hasUpdate) {
    return { success: false, message: check.error || "Bot sudah versi terbaru, tidak ada update.", check };
  }

  log.info("Auto-update: Update detected, pulling changes...");

  // 2. Stash any local changes before pulling
  try {
    await execAsync("git stash 2>&1", { cwd: REPO_DIR });
  } catch {
    // might fail if nothing to stash, that's ok
  }

  // 3. Pull
  const pullResult = await gitPull();
  if (!pullResult.success) {
    return { success: false, message: `Git pull gagal: ${pullResult.output}`, check };
  }

  // 4. Restore stash if any
  try {
    await execAsync("git stash pop 2>&1", { cwd: REPO_DIR });
  } catch {
    // might fail if nothing was stashed, that's ok
  }

  // 5. npm install if needed
  const installed = await npmInstallIfNeeded(check.changedFiles);

  // 6. Restart PM2
  log.info("Auto-update: Restarting bot via PM2...");
  const restarted = await restartPM2();

  const commitList = check.commits.map(c => `  • ${c}`).join("\n");
  const fileList = check.changedFiles.slice(0, 10).join(", ") + (check.changedFiles.length > 10 ? "..." : "");

  return {
    success: true,
    message: `✅ *Update berhasil!*\n\n📝 *${check.commits.length} commit baru:*\n${commitList}\n\n📁 *File berubah:* ${fileList}${installed ? "\n\n📦 *npm install* dijalankan (deps berubah)" : "\n\n📦 Tidak perlu npm install"}${restarted ? "\n\n🔄 Bot di-restart via PM2" : "\n\n⚠️ PM2 restart gagal, restart manual: pm2 restart basewa"}`,
    check,
  };
}

export default { checkUpdate, doUpdate };
