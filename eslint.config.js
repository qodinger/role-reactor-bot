import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      // Code quality rules
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off", // Allow console.log for bot logging
      "no-debugger": "error",
      "no-alert": "error",

      // Code style rules
      indent: ["error", 2],
      "linebreak-style": ["error", "unix"],
      quotes: "off",
      semi: ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],

      // Best practices
      "prefer-const": "error",
      "no-var": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // Async/await rules
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",

      // Variable rules
      "no-undef": "error",
      "no-unused-expressions": "error",

      // Function rules
      "arrow-spacing": ["error", { before: true, after: true }],

      // Object and array rules
      "object-shorthand": "error",
      "prefer-template": "error",
      "template-curly-spacing": ["error", "never"],

      // Import/export rules (if using modules)
      "no-duplicate-imports": "error",

      // Discord.js specific rules
      camelcase: ["error", { properties: "never" }],
    },
  },
];
