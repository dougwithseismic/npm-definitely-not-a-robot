const esbuild = require("esbuild");

async function build() {
  esbuild
    .build({
      entryPoints: ["./src/index.ts"],
      bundle: true,
      platform: "node",
      target: "node14",
      outfile: "./dist/index.js",
      format: "cjs",
      tsconfig: "./tsconfig.json", // Point to your tsconfig
      plugins: [],
    })
    .catch(() => process.exit(1));
}

build();
