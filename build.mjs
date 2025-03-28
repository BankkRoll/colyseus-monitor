import esbuild from "esbuild";
import glob from "fast-glob";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

// Get dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  target: "es2017",
  basePath: __dirname,
  backendSrc: path.resolve(__dirname, "src-backend", "**", "**.ts"),
  frontendSrc: path.resolve(__dirname, "src"),
  outdir: path.join(__dirname, "build"),
  staticOutdir: path.join(__dirname, "build", "static"),
  banner: {
    js: `/**
 * @colyseus/monitor v${JSON.parse(fs.readFileSync("./package.json")).version}
 * Licensed under MIT
 * https://github.com/colyseus/colyseus
 */`,
  },
  minify: process.env.NODE_ENV === "production",
  sourcemap: process.env.NODE_ENV !== "production",
};

/**
 * Build the backend (Node.js) code
 */
async function buildBackend() {
  try {
    console.log("🔨 Building backend...");

    // Get all .ts files from src-backend
    const entryPoints = glob.sync(config.backendSrc.replace(/\\/g, "/")); // windows support

    // CommonJS output
    console.log("📦 Generating CJS build...");
    await esbuild.build({
      entryPoints,
      outdir: config.outdir,
      target: config.target,
      format: "cjs",
      sourcemap: config.sourcemap ? "external" : false,
      platform: "node",
      banner: config.banner,
      minify: config.minify,
    });

    // ESM output
    console.log("📦 Generating ESM build...");
    await esbuild.build({
      entryPoints,
      outdir: config.outdir,
      target: "esnext",
      format: "esm",
      bundle: true,
      sourcemap: config.sourcemap ? "external" : false,
      platform: "node",
      outExtension: { ".js": ".mjs" },
      banner: config.banner,
      minify: config.minify,
      plugins: [
        {
          name: "add-mjs",
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.importer)
                return {
                  path: args.path.replace(/^\.(.*)\.js$/, ".$1.mjs"),
                  external: true,
                };
            });
          },
        },
        {
          // WORKAROUND FOR __dirname usage in ESM
          name: "dirname",
          setup(build) {
            build.onLoad({ filter: /.*/ }, ({ path: filePath }) => {
              let contents = fs.readFileSync(filePath, "utf8");
              const loader = path.extname(filePath).substring(1);
              contents = contents.replace(
                /__dirname/g,
                `path.dirname(fileURLToPath(import.meta.url))`,
              );
              return {
                contents,
                loader,
              };
            });
          },
        },
      ],
    });

    // TypeScript declarations
    generateTypeDeclarations(entryPoints);

    console.log("✅ Backend build complete");
    return true;
  } catch (error) {
    console.error("❌ Backend build failed:", error);
    return false;
  }
}

/**
 * Emit TypeScript declaration files
 */
function generateTypeDeclarations(entryPoints) {
  console.log("📝 Generating .d.ts files...");
  const program = ts.createProgram(entryPoints, {
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    module: "commonjs",
    target: config.target,
    outDir: config.outdir,
    esModuleInterop: true,
    experimentalDecorators: true,
  });

  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (allDiagnostics.length > 0) {
    console.warn("⚠️ TypeScript diagnostics:");
    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start,
        );
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        );
        console.warn(
          `  ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
        );
      } else {
        console.warn(
          `  ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
        );
      }
    });
  }
}

/**
 * Copy frontend configuration to static directory
 */
function copyFrontendConfig() {
  console.log("📋 Copying default frontend configuration...");

  // Create config.js file to initialize frontend configuration
  const configContent = `
/**
 * Colyseus Monitor v${JSON.parse(fs.readFileSync("./package.json")).version}
 * Default configuration
 */
window.__COLYSEUS_MONITOR_CONFIG = window.__COLYSEUS_MONITOR_CONFIG || {};
// Merge with any existing config
window.__COLYSEUS_MONITOR_VERSION = "${JSON.parse(fs.readFileSync("./package.json")).version}";
`;

  // Ensure directory exists
  if (!fs.existsSync(config.staticOutdir)) {
    fs.mkdirSync(config.staticOutdir, { recursive: true });
  }

  // Write config file
  fs.writeFileSync(
    path.join(config.staticOutdir, "monitor-config.js"),
    configContent,
  );

  console.log("✅ Frontend configuration prepared");
}

/**
 * Main build process
 */
async function main() {
  console.log("🚀 Starting Colyseus Monitor build process...");

  // Create output directory if it doesn't exist
  if (!fs.existsSync(config.outdir)) {
    fs.mkdirSync(config.outdir, { recursive: true });
  }

  // Build backend and frontend
  const backendSuccess = await buildBackend();

  // Copy frontend configuration
  if (backendSuccess) {
    copyFrontendConfig();
  }

  if (backendSuccess) {
    console.log("✅ Build completed successfully!");
  } else {
    console.error("❌ Build failed");
    process.exit(1);
  }
}

// Execute the build
export default await main();
