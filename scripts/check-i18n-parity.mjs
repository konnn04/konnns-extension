import fs from "node:fs";
import path from "node:path";

function getKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? getKeys(v, prefix + k + ".") : [prefix + k],
  );
}

function checkPair(enPath, viPath, label) {
  if (!fs.existsSync(enPath) || !fs.existsSync(viPath)) {
    console.error(`❌ [${label}] Missing en or vi file.`);
    return false;
  }

  const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  const vi = JSON.parse(fs.readFileSync(viPath, "utf-8"));
  const a = getKeys(en).sort();
  const b = getKeys(vi).sort();

  const strA = JSON.stringify(a);
  const strB = JSON.stringify(b);

  if (strA === strB) {
    console.log(`✓ [${label}] Key parity OK (${a.length} keys)`);
    return true;
  }

  console.error(`❌ [${label}] Parity MISMATCH!`);
  const onlyInEn = a.filter((k) => !b.includes(k));
  const onlyInVi = b.filter((k) => !a.includes(k));
  if (onlyInEn.length) console.error("  Only in EN:", onlyInEn);
  if (onlyInVi.length) console.error("  Only in VI:", onlyInVi);
  return false;
}

let allOk = true;

// 1. Core locales
allOk = checkPair(
  "./src/core/i18n/locales/en.json",
  "./src/core/i18n/locales/vi.json",
  "core",
) && allOk;

// 2. Feature-scoped locales
function findFeatureLocales(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "locales") {
        const enPath = path.join(fullPath, "en.json");
        const viPath = path.join(fullPath, "vi.json");
        const rel = path.relative("./src", fullPath);
        allOk = checkPair(enPath, viPath, rel) && allOk;
      } else {
        findFeatureLocales(fullPath);
      }
    }
  }
}

findFeatureLocales("./src/features");

if (!allOk) {
  process.exit(1);
}
console.log("🎉 All i18n locales have 100% key parity!");
