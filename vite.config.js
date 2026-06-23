import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

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
      },
    },
  },
  esbuild: {
    keepNames: true,
  },
});
