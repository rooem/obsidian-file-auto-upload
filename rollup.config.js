import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { visualizer } from "rollup-plugin-visualizer";

const production = !process.env.ROLLUP_WATCH;
const analyze = !!process.env.ANALYZE;

export default {
  input: "src/main.ts",
  output: {
    dir: ".",
    sourcemap: production ? false : "inline",
    format: "cjs",
    exports: "default",
    inlineDynamicImports: true,
    compact: true,
  },
  external: ["obsidian", "@codemirror/state", "@codemirror/view"],
  plugins: [
    typescript({
      compilerOptions: {
        outDir: ".",
        declaration: false,
        sourceMap: false,
        inlineSourceMap: !production,
        inlineSources: !production,
      },
      noEmitOnError: true,
    }),
    nodeResolve({
      browser: false,
      preferBuiltins: true,
    }),
    commonjs({
      ignoreDynamicRequires: true,
    }),
    json(),
    analyze && visualizer({
      filename: "bundle-stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
    preset: "smallest",
  },
  onwarn(warning, warn) {
    if (warning.code === "CIRCULAR_DEPENDENCY") return;
    // Suppress certain warnings for smaller bundle size
    if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
    if (warning.code === "MISSING_NODE_BUILTINS") return;
    warn(warning);
  },
};