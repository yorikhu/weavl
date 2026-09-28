import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dockerInfoTimeoutMs = 3_000;
const dockerStartupTimeoutMs = 90_000;

const localEnvironmentFiles = [
  ["apps/api/.env", "apps/api/.env.example"],
  ["apps/web/.env", "apps/web/.env.example"],
];

/** 等待指定时间，不阻塞 Node.js 事件循环。 */
function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/** 首次启动时从安全的开发默认值创建本地环境文件，不覆盖已有配置。 */
function ensureLocalEnvironment() {
  for (const [target, example] of localEnvironmentFiles) {
    const targetPath = resolve(workspaceRoot, target);
    if (existsSync(targetPath)) continue;
    copyFileSync(resolve(workspaceRoot, example), targetPath);
    console.log(`[weavl/dev] 已创建 ${target}`);
  }
}

/** 检查 Docker CLI 是否存在。 */
function hasDockerCli() {
  const result = spawnSync("docker", ["--version"], { stdio: "ignore", timeout: dockerInfoTimeoutMs });
  return !result.error && result.status === 0;
}

/** 检查 Docker daemon 是否已经可以接受请求。 */
function isDockerReady() {
  const result = spawnSync("docker", ["info"], { stdio: "ignore", timeout: dockerInfoTimeoutMs });
  return !result.error && result.status === 0;
}

/** 在 macOS 上后台启动 Docker Desktop。 */
function launchDockerDesktop() {
  const result = spawnSync("open", ["-gja", "Docker"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error("无法自动启动 Docker Desktop，请确认已经安装并手动启动后重试。");
  }
}

/** 等待 Docker Desktop 完成初始化。 */
async function waitForDocker() {
  const startedAt = Date.now();
  process.stdout.write("[weavl/dev] 正在等待 Docker Desktop 启动");
  while (Date.now() - startedAt < dockerStartupTimeoutMs) {
    if (isDockerReady()) {
      process.stdout.write(" 已就绪。\n");
      return;
    }
    process.stdout.write(".");
    await wait(2_000);
  }
  process.stdout.write("\n");
  throw new Error("Docker Desktop 在 90 秒内未就绪，请检查 Docker Desktop 状态后重试。");
}

/** 确保 Docker daemon 可用；macOS 会尝试自动启动 Docker Desktop。 */
async function ensureDockerReady() {
  if (!hasDockerCli()) throw new Error("未找到 Docker CLI，请先安装 Docker Desktop。");
  if (isDockerReady()) return;
  if (process.platform !== "darwin") {
    throw new Error("Docker daemon 未运行，请启动 Docker 服务后重试。");
  }
  console.log("[weavl/dev] Docker Desktop 尚未运行，正在自动启动。");
  launchDockerDesktop();
  await waitForDocker();
}

/** 启动并等待本地 PostgreSQL、Redis 和 MinIO 健康。 */
function startInfrastructure() {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      "deploy/dev.env",
      "-f",
      "compose.yaml",
      "-f",
      "compose.dev.yaml",
      "up",
      "-d",
      "--build",
      "--wait",
      "postgres",
      "redis",
      "minio",
    ],
    { cwd: workspaceRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`启动本地基础设施失败，退出码 ${result.status}`);
}

/** 基础设施健康后应用所有已提交的数据库迁移。 */
function deployDatabaseMigrations() {
  const result = spawnSync("pnpm", ["--filter", "@weavl/api", "db:deploy"], {
    cwd: workspaceRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`应用数据库迁移失败，退出码 ${result.status}`);
}

ensureLocalEnvironment();
await ensureDockerReady();
startInfrastructure();
deployDatabaseMigrations();
console.log("[weavl/dev] PostgreSQL、Redis、MinIO 和数据库迁移已就绪。");
