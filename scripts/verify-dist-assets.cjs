const fs = require("node:fs");
const path = require("node:path");

const distDirectory = path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distDirectory, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const assetReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith("data:"));

if (!assetReferences.length) {
  throw new Error("The production HTML does not reference any application assets.");
}

for (const reference of assetReferences) {
  if (reference.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(reference)) {
    throw new Error(`Production asset reference must be package-relative: ${reference}`);
  }
  const assetPath = path.resolve(distDirectory, reference);
  if (!assetPath.startsWith(`${distDirectory}${path.sep}`) || !fs.existsSync(assetPath)) {
    throw new Error(`Production asset is missing or outside the package: ${reference}`);
  }
}

console.log(`Verified ${assetReferences.length} package-relative production assets.`);
