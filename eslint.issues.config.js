module.exports = [
  {
    files: [
      "src/issues/**/*.js",
      "tests/issues/**/*.js",
      "scripts/issues-*.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: Object.fromEntries(
        [
          "process",
          "Buffer",
          "console",
          "setTimeout",
          "fetch",
          "AbortSignal",
          "FormData",
          "Blob",
          "URL",
          "__dirname",
        ].map((key) => [key, "readonly"]),
      ),
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-undef": "error",
      eqeqeq: "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-dupe-keys": "error",
    },
  },
];
