import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist", "docs", "fixtures"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/transfer/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react/*",
            "react-dom",
            "**/api",
            "**/storage",
            "**/session",
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "fetch",
        "localStorage",
        "window",
        "document",
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Render tooltip content as text.",
        },
      ],
    },
  },
];
