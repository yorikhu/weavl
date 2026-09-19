import { execFileSync, spawnSync } from "node:child_process";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const applicationPorts = [3000, 3001];

/** 执行只读系统命令；目标进程已退出时返回空字符串。 */
function capture(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** 查询监听指定 TCP 端口的进程。 */
function listenerPids(port) {
  return capture("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"])
    .split(/\s+/)
    .map(Number)
    .filter((pid) => Number.isInteger(pid) && pid > 1);
}

/** 查询进程的父进程、命令和工作目录。 */
function processInfo(pid) {
  const parentPid = Number(capture("ps", ["-o", "ppid=", "-p", String(pid)]));
  const command = capture("ps", ["-o", "command=", "-p", String(pid)]);
  const cwdLine = capture("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
    .split("\n")
    .find((line) => line.startsWith("n"));
  return { parentPid, command, cwd: cwdLine?.slice(1) };
}

/** 判断父进程是否属于当前工作区的 Node 开发进程链。 */
function isWorkspaceDevProcess(info) {
  if (!info.cwd || !info.command) return false;
  const relativePath = relative(workspaceRoot, info.cwd);
  const insideWorkspace = relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
  const executable = basename(info.command.trim().split(/\s+/, 1)[0]);
  return insideWorkspace && /^(?:node|pnpm|next|next-server|nest)$/i.test(executable);
}

/** 从端口监听进程向上收集 pnpm/Node 开发进程，避免 Watcher 再次拉起子进程。 */
function collectProcessTree(pid) {
  const processes = [pid];
  let parentPid = processInfo(pid).parentPid;
  while (Number.isInteger(parentPid) && parentPid > 1 && parentPid !== process.pid) {
    const info = processInfo(parentPid);
    if (!isWorkspaceDevProcess(info)) break;
    processes.push(parentPid);
    parentPid = info.parentPid;
  }
  return processes.reverse();
}

/** 向仍存在的进程发送信号。 */
function signal(pid, name) {
  try {
    process.kill(pid, name);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

/** 等待一小段时间，让开发服务器完成优雅退出。 */
function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function stopApplicationProcesses() {
  const initialListeners = applicationPorts.flatMap(listenerPids);
  const processTree = [...new Set(initialListeners.flatMap(collectProcessTree))];
  processTree.forEach((pid) => signal(pid, "SIGTERM"));
  await wait(900);

  // Watcher 若在退出间隙重新拉起监听进程，最终用 SIGKILL 清理端口。
  applicationPorts.flatMap(listenerPids).forEach((pid) => signal(pid, "SIGKILL"));
  const occupiedPorts = applicationPorts.filter((port) => listenerPids(port).length);
  if (occupiedPorts.length) throw new Error(`无法释放应用端口：${occupiedPorts.join(", ")}`);
  console.log(`[weavl/dev] 应用端口已释放：${applicationPorts.join(", ")}`);
}

function stopInfrastructure() {
  const dockerInfo = spawnSync("docker", ["info"], { stdio: "ignore", timeout: 3_000 });
  if (dockerInfo.error || dockerInfo.status !== 0) {
    console.log("[weavl/dev] Docker daemon 未运行，基础设施已经停止。");
    return;
  }
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
      "stop",
      "postgres",
      "redis",
      "minio",
    ],
    { cwd: workspaceRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`停止本地基础设施失败，退出码 ${result.status}`);
}

await stopApplicationProcesses();
stopInfrastructure();
console.log("[weavl/dev] 前端、后端、PostgreSQL、Redis 和 MinIO 已全部停止；数据卷已保留。");
