module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
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
    quotes: ["error", "double"],
    semi: ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
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
  overrides: [
    {
      files: ["*.js"],
      env: {
        node: true,
      },
    },
  ],
};
