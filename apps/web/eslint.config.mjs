import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "next-env.d.ts"],
  },
  {
    files: ["src/app/canvas/page.tsx"],
    rules: {
      // Canvas previews use runtime data/blob URLs that should not go through next/image.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
