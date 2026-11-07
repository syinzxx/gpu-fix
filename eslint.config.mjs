import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent / tooling scratch dirs — not project source.
    ".claude/**",
    ".superpowers/**",
    // Private research, kept out of Git.
    "replica/**",
    "reports/**",
    "research_notes/**",
  ]),
  // The Electron desktop app is standalone CommonJS (Node main/preload), not
  // part of the Next bundle — require() and Node globals are correct there.
  {
    files: ["desktop/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
