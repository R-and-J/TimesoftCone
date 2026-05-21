// ESLint config — enforces the hexagonal boundary rule from ADR-012:
//   domain/ has zero external dependencies; depends on nothing
//   application/ → domain/ only
//   ports/      → domain/ only
//   adapters/   → ports/, domain/
//   interfaces/ → application/, ports/, domain/ (composition root: src/app.module.ts)
//
// If you see a boundary violation, the fix is almost always: move code into the right layer,
// not silence the rule.

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "boundaries"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:boundaries/recommended",
  ],
  settings: {
    "boundaries/elements": [
      { type: "domain", pattern: "src/domain/**" },
      { type: "ports", pattern: "src/ports/**" },
      { type: "application", pattern: "src/application/**" },
      { type: "adapters", pattern: "src/adapters/**" },
      { type: "interfaces", pattern: "src/interfaces/**" },
      { type: "app-root", pattern: "src/{main,app.module}.ts", mode: "file" },
    ],
    "boundaries/ignore": ["**/*.spec.ts", "**/*.test.ts"],
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "domain", allow: ["domain"] },
          { from: "ports", allow: ["domain", "ports"] },
          { from: "application", allow: ["domain", "ports", "application"] },
          { from: "adapters", allow: ["domain", "ports", "adapters"] },
          {
            from: "interfaces",
            allow: ["domain", "ports", "application", "interfaces"],
          },
          { from: "app-root", allow: ["application", "adapters", "interfaces", "ports", "domain"] },
        ],
      },
    ],
    "boundaries/external": [
      "error",
      {
        default: "allow",
        rules: [
          {
            from: "domain",
            disallow: [
              "@nestjs/*",
              "@prisma/*",
              "prisma",
              "ioredis",
              "express",
              "rxjs",
            ],
            message:
              "domain/ must not depend on framework/infrastructure libraries (ADR-012).",
          },
        ],
      },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
};
