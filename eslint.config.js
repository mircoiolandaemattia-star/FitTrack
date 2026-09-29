// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "dist-server/*",
      ".expo/*",
      ".opencode/*",
      "node_modules/*",
    ],
  },
  {
    // Script Node (postinstall, tooling): globals di ambiente Node.
    files: ["scripts/**/*.js", "*.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        Buffer: "readonly",
      },
    },
  },
]);
