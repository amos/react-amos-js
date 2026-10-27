import { playwright } from "@vitest/browser-playwright";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    dts({
      outDirs: "dist",
      entryRoot: "src",
      compilerOptions: { rootDir: "src" },
      beforeWriteFile: (filePath, content) => {
        const normalized = filePath.replaceAll("\\", "/");

        // Ensure downstream consumers get the global `google.payments.api.*`
        // types (re-exposed via @amos.com/amos-js -> @types/googlepay) when
        // they import `@amos.com/react-amos-js`.
        if (normalized.endsWith("/dist/index.d.ts")) {
          return {
            content: `/// <reference types="googlepay" />\n${content}`,
          };
        }

        return { content };
      },
    }),
  ],
  build: {
    // Match @amos.com/amos-js / amos-ui embed (native-ESM, 2018+).
    target: ["chrome64", "firefox67", "safari12", "ios12", "edge79"],
    lib: {
      entry: {
        index: "src/index.tsx",
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "@amos.com/amos-js"],
      output: {
        globals: {
          react: "React",
        },
        keepNames: true,
      },
    },
  },
  test: {
    include: ["src/**/*.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
