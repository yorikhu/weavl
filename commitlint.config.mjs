export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 严格派：type 必须是合法枚举（feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert）
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    // 中文 subject 允许，但不允许句号结尾（与 config-conventional 默认一致，显式声明意图）
    "subject-full-stop": [2, "never", "。"],
    // header 上限放宽到 100（中文字符信息密度高）
    "header-max-length": [2, "always", 100],
  },
};
