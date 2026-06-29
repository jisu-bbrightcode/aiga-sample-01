/**
 * Build Output API generator for Vercel
 * Creates .vercel/output structure from nest build output
 * Docs: https://vercel.com/docs/build-output-api/v3
 *
 * NOTE: rootDirectory is apps/server, so .vercel/output goes there
 */
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const SERVER = path.resolve(__dirname, "..");
const OUTPUT = path.resolve(SERVER, ".vercel/output");
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://product-builder-app.vercel.app",
  "https://product-builder-admin.vercel.app",
];
const REQUIRED_RUNTIME_ENV = ["DATABASE_URL"];
const EXTERNAL_RUNTIME_PACKAGES = ["sharp"];

function destinationForPackage(destinationNodeModules, packageName) {
  return path.resolve(destinationNodeModules, ...packageName.split("/"));
}

function findPackageJson(packageName, paths, originalError) {
  for (const basePath of paths) {
    for (const nodeModulesPath of Module._nodeModulePaths(basePath)) {
      const packageJson = path.resolve(nodeModulesPath, ...packageName.split("/"), "package.json");
      if (fs.existsSync(packageJson)) return packageJson;
    }
  }

  throw originalError;
}

function resolvePackage(packageName, paths) {
  let packageJson;
  try {
    packageJson = require.resolve(`${packageName}/package.json`, { paths });
  } catch (error) {
    packageJson = findPackageJson(packageName, paths, error);
  }
  const packageDir = path.dirname(packageJson);

  return { packageDir, packageJson };
}

function copyDereferenced(source, destination) {
  const resolvedSource = fs.lstatSync(source).isSymbolicLink() ? fs.realpathSync(source) : source;
  const stat = fs.statSync(resolvedSource);

  fs.rmSync(destination, { recursive: true, force: true });

  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(resolvedSource)) {
      copyDereferenced(path.resolve(resolvedSource, entry), path.resolve(destination, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(resolvedSource, destination);
  fs.chmodSync(destination, stat.mode);
}

function copyPackageClosure({
  packageName,
  destinationNodeModules,
  paths,
  seen = new Set(),
  optional = false,
}) {
  if (seen.has(packageName)) return;
  seen.add(packageName);

  let packageInfo;
  try {
    packageInfo = resolvePackage(packageName, paths);
  } catch (error) {
    if (optional) return;
    throw error;
  }

  const { packageDir, packageJson } = packageInfo;
  const pkg = JSON.parse(fs.readFileSync(packageJson, "utf8"));
  copyDereferenced(packageDir, destinationForPackage(destinationNodeModules, packageName));

  const dependencies = pkg.dependencies ?? {};
  const optionalDependencies = pkg.optionalDependencies ?? {};

  for (const dependencyName of Object.keys(dependencies)) {
    copyPackageClosure({
      packageName: dependencyName,
      destinationNodeModules,
      paths: [packageDir],
      seen,
    });
  }

  for (const dependencyName of Object.keys(optionalDependencies)) {
    copyPackageClosure({
      packageName: dependencyName,
      destinationNodeModules,
      paths: [packageDir],
      seen,
      optional: true,
    });
  }
}

function copyExternalRuntimePackages(funcDir) {
  const destinationNodeModules = path.resolve(funcDir, "node_modules");

  for (const packageName of EXTERNAL_RUNTIME_PACKAGES) {
    copyPackageClosure({
      packageName,
      destinationNodeModules,
      paths: [SERVER, process.cwd()],
    });
  }
}

function buildFunctionEntrySource() {
  return `const DEFAULT_CORS_ORIGINS = ${JSON.stringify(DEFAULT_CORS_ORIGINS, null, 2)};
const REQUIRED_RUNTIME_ENV = ${JSON.stringify(REQUIRED_RUNTIME_ENV)};
let cachedApp = null;
let cachedGetApp = null;

function splitOrigins(value) {
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveAllowedOrigins() {
  const configured = splitOrigins(process.env.CORS_ORIGINS);
  if (configured.length > 0) return Array.from(new Set(configured));
  return Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...splitOrigins(process.env.APP_URL)]));
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedCorsOrigin(req, origin) {
  if (resolveAllowedOrigins().includes(origin)) return true;
  return false;
}

function applyCorsHeaders(req, res) {
  const origin = firstHeader(req.headers.origin);
  if (!origin || !isAllowedCorsOrigin(req, origin)) return;

  const requestedHeaders = firstHeader(req.headers["access-control-request-headers"]);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", requestedHeaders || "authorization,content-type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
}

function handlePreflight(req, res) {
  applyCorsHeaders(req, res);
  res.statusCode = 204;
  res.end();
}

function getMissingRuntimeEnv() {
  return REQUIRED_RUNTIME_ENV.filter((key) => !process.env[key]);
}

function sendBootstrapError(req, res, message) {
  applyCorsHeaders(req, res);
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    handlePreflight(req, res);
    return;
  }

  const missingEnv = getMissingRuntimeEnv();
  if (missingEnv.length > 0) {
    sendBootstrapError(req, res, "Missing required server env: " + missingEnv.join(", "));
    return;
  }

  try {
    applyCorsHeaders(req, res);
    if (!cachedGetApp) {
      ({ getApp: cachedGetApp } = require("./main"));
    }
    if (!cachedApp) {
      cachedApp = await cachedGetApp();
    }
    const instance = cachedApp.getHttpAdapter().getInstance();
    instance.server.emit("request", req, res);
  } catch (err) {
    console.error("[server] Error:", err instanceof Error ? err.message : err, err instanceof Error ? err.stack : "");
    sendBootstrapError(req, res, err instanceof Error ? err.message : "Internal Server Error");
  }
};
`;
}

function generateVercelOutput() {
  // Clean previous output
  fs.rmSync(OUTPUT, { recursive: true, force: true });

  // Create function directory — catch-all "api" function
  const funcDir = path.resolve(OUTPUT, "functions/api.func");
  fs.mkdirSync(funcDir, { recursive: true });

  // Copy dist/ contents into function directory
  const distDir = path.resolve(SERVER, "dist");
  for (const file of fs.readdirSync(distDir)) {
    fs.copyFileSync(path.resolve(distDir, file), path.resolve(funcDir, file));
  }

  // Webpack externals are resolved by Node at runtime, so native packages must
  // be present inside the .func filesystem mount.
  copyExternalRuntimePackages(funcDir);

  // Create entry point that handles CORS preflight before loading the Nest bundle.
  fs.writeFileSync(path.resolve(funcDir, "index.js"), buildFunctionEntrySource());

  // Create .vc-config.json — Node.js runtime
  fs.writeFileSync(
    path.resolve(funcDir, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs20.x",
        handler: "index.js",
        maxDuration: 60,
        launcherType: "Nodejs",
      },
      null,
      2,
    ),
  );

  // Create config.json — route all requests to the api function
  fs.writeFileSync(
    path.resolve(OUTPUT, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/api" }],
      },
      null,
      2,
    ),
  );

  // Stats
  const files = fs.readdirSync(funcDir);
  const totalSize = files.reduce((sum, f) => {
    const stat = fs.statSync(path.resolve(funcDir, f));
    return sum + stat.size;
  }, 0);
  console.log(`✅ Build Output API at ${OUTPUT}`);
  console.log(`   ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
}

if (require.main === module) {
  generateVercelOutput();
}

module.exports = {
  DEFAULT_CORS_ORIGINS,
  EXTERNAL_RUNTIME_PACKAGES,
  REQUIRED_RUNTIME_ENV,
  buildFunctionEntrySource,
  copyExternalRuntimePackages,
  generateVercelOutput,
};
