import { spawn } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const configs = ["tsconfig.json", "tsconfig.cjs.json"];
const children = configs.map((config) =>
  spawn(pnpmCommand, ["exec", "tsc", "-p", config, "--watch", "--preserveWatchOutput"], {
    stdio: "inherit",
  }),
);

let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(`[weavl/shared] 无法启动 TypeScript watcher: ${error.message}`);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(`[weavl/shared] TypeScript watcher 异常退出（code=${code}, signal=${signal}）`);
    stop();
    process.exitCode = code || 1;
  });
}

await Promise.all(children.map((child) => new Promise((resolve) => child.on("close", resolve))));
