const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const packages = new Map();
function scanModules(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".bin" || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      for (const child of fs.readdirSync(path.join(directory, entry.name), { withFileTypes: true })) {
        if (child.isDirectory()) readPackage(path.join(directory, entry.name, child.name));
      }
    } else readPackage(path.join(directory, entry.name));
  }
}
function readPackage(packageDirectory) {
  try {
    const dependency = JSON.parse(fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8"));
    packages.set(`${dependency.name}@${dependency.version}`, dependency);
    scanModules(path.join(packageDirectory, "node_modules"));
  } catch {
    // Ignore non-package implementation folders.
  }
}
scanModules(path.join(root, "node_modules"));
const sections = [...packages.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)).map((dependency) => {
  try {
    const license = typeof dependency.license === "string" ? dependency.license : JSON.stringify(dependency.license || "Not specified");
    return `## ${dependency.name} ${dependency.version}\n\nLicense: ${license}\nHomepage: ${dependency.homepage || dependency.repository?.url || "Not specified"}`;
  } catch {
    return `## ${dependency.name}\n\nPackage metadata was unavailable during notice generation.`;
  }
});
const header = "# Third-Party Notices\n\nGenerated from installed direct and transitive dependencies by `npm run notices`. Each package remains governed by its own distributed licence terms.\n\nThird-party product names and file formats belong to their respective owners.\n\n";
fs.writeFileSync(path.join(root, "THIRD-PARTY-NOTICES.md"), `${header}${sections.join("\n\n")}\n`);
