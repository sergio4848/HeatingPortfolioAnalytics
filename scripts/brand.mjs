import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "..");
const modules = process.env.RUNTIME_NODE_MODULES;
if (!modules)
  throw new Error(
    "Set RUNTIME_NODE_MODULES to the bundled workspace Node packages.",
  );
const require = createRequire(path.join(modules, "runtime.cjs"));
const sharp = require("sharp");
const target = path.join(root, "packages/brand");
const brand = JSON.parse(
  await fs.readFile(path.join(target, "brand.json"), "utf8"),
);
for (const file of await fs.readdir(target))
  if (/^(wordmark|symbol)-.*\.svg$/.test(file)) {
    let svg = await fs.readFile(path.join(target, file), "utf8");
    svg = svg.replace(/>Portotherm<\/text>/g, `>${brand.name}</text>`);
    await fs.writeFile(path.join(target, file), svg);
    for (const scale of [1, 4])
      await sharp(Buffer.from(svg))
        .resize(
          file.startsWith("wordmark") ? 255 * scale : 38 * scale,
          36 * scale,
        )
        .png()
        .toFile(path.join(target, file.replace(".svg", `-${scale}x.png`)));
  }
const symbol = await fs.readFile(path.join(target, "symbol-light.svg"));
for (const n of [16, 24, 32, 192, 512])
  await sharp(symbol)
    .resize(n, n, { fit: "contain" })
    .png()
    .toFile(path.join(target, `icon-${n}.png`));
await fs.copyFile(
  path.join(target, "icon-192.png"),
  path.join(root, "apps/web/public/icon-192.png"),
);
await fs.copyFile(
  path.join(target, "icon-512.png"),
  path.join(root, "apps/web/public/icon-512.png"),
);
await fs.copyFile(
  path.join(target, "symbol-light.svg"),
  path.join(root, "apps/web/public/symbol.svg"),
);
await fs.copyFile(
  path.join(target, "symbol-light.svg"),
  path.join(root, "apps/web/public/favicon.svg"),
);
console.log("Brand PNG/icon exports created from editable SVG sources.");
