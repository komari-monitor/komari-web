import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));

// Vendored assets copied into public/assets/ (e.g. Twemoji flag SVGs in public/assets/flags/)
// whose npm package is not imported at runtime.
const vendoredEntries = [
  {
    name: "twemoji",
    version: "14.0.2",
    license: "CC-BY-4.0",
    dev: false,
    url: "https://github.com/twitter/twemoji",
  },
];

const directEntries = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter((name) => name !== pkg.name)
  .map((name) => {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry?.version || !entry.license) throw new Error(`Missing locked license/version: ${name}`);
    return {
      name,
      version: entry.version,
      license: name === "twemoji" ? "MIT AND CC-BY-4.0" : entry.license,
      dev: Object.hasOwn(pkg.devDependencies || {}, name),
      url: `https://www.npmjs.com/package/${name}`,
    };
  });

const directNames = new Set(directEntries.map((entry) => entry.name));
const entries = [
  ...directEntries,
  ...vendoredEntries.filter((entry) => !directNames.has(entry.name)),
].sort((a, b) => a.name.localeCompare(b.name));

await writeFile(new URL("src/utils/openSource.web.json", root), JSON.stringify(entries, null, 2) + "\n");
console.log(`Updated ${entries.length} Web open-source attributions (including development and vendored dependencies).`);
