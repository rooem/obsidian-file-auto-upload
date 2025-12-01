import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/main.ts",
  output: {
    dir: ".",
    sourcemap: production ? false : "inline",
    format: "cjs",
    exports: "default",
    inlineDynamicImports: true,
  },
  external: ["obsidian"],
  plugins: [
    typescript({
      sourceMap: !production,
      inlineSources: !production,
    }),
    nodeResolve({
      browser: false,
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
  ],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
};
