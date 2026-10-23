import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));
const entries = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((name) => name !== pkg.name)
  .sort()
  .map((name) => {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry?.version || !entry.license) throw new Error(`Missing locked license/version: ${name}`);
    return {
      name, version: entry.version,
      license: name === "twemoji" ? "MIT AND CC-BY-4.0" : entry.license,
      dev: Object.hasOwn(pkg.devDependencies || {}, name),
      url: `https://www.npmjs.com/package/${name}`,
    };
  });
await writeFile(new URL("src/utils/openSource.web.json", root), JSON.stringify(entries, null, 2) + "\n");
console.log(`Updated ${entries.length} Web direct dependencies (including development dependencies).`);
