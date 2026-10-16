import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const modules = process.env.RUNTIME_NODE_MODULES;
const skill = process.env.PRESENTATION_SKILL_DIR;
const python = process.env.RUNTIME_PYTHON;
if (!modules || !skill || !python)
  throw new Error(
    "Set RUNTIME_NODE_MODULES, PRESENTATION_SKILL_DIR and RUNTIME_PYTHON. See presentations/README.md.",
  );
const req = createRequire(path.join(modules, "runtime.cjs"));
const { Presentation, PresentationFile } = await import(
  pathToFileURL(req.resolve("@oai/artifact-tool")).href
);
const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(skill, "container_tools/artifact_tool_utils.mjs"))
    .href
);
const font = resolvePresentationFont({ fontFamily: "Arial" });
const fontFamily =
  typeof font === "string" ? font : (font.fontFamily ?? "Arial");
const brand = JSON.parse(
  await fs.readFile(path.join(root, "packages/brand/brand.json"), "utf8"),
);
const stats = JSON.parse(
  await fs.readFile(path.join(root, "reports/demo-statistics.json"), "utf8"),
);
const slides = JSON.parse(
  await fs.readFile(path.join(import.meta.dirname, "slides.json"), "utf8"),
);
const out = path.join(root, "presentations/exports");
const work = path.join(root, "work/presentation");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(work, { recursive: true });
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const navy = brand.navy,
  teal = brand.teal,
  muted = "#526776";
function text(slide, txt, x, y, w, h, size = 26, color = navy, bold = false) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name: txt.slice(0, 45),
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = txt;
  box.text.style = { typeface: fontFamily, fontSize: size, color, bold };
  return box;
}
async function image(slide, file, x, y, w, h) {
  const bytes = await fs.readFile(path.join(root, file));
  slide.images.add({
    blob: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
    contentType: "image/png",
    alt: "Actual running local synthetic demo screen",
    fit: "contain",
    position: { left: x, top: y, width: w, height: h },
  });
}
for (const [i, c] of slides.entries()) {
  const s = deck.slides.add();
  const dark = ["cover", "closing"].includes(c.layout);
  s.background.fill = dark ? navy : brand.background;
  const color = dark ? "#ffffff" : navy;
  text(s, c.kicker, 66, 47, 1148, 25, 14, dark ? "#8CD5CA" : teal, true);
  text(
    s,
    c.title,
    66,
    c.layout === "cover" ? 150 : 95,
    1148,
    c.layout === "cover" ? 120 : 85,
    c.layout === "cover" ? 88 : 46,
    color,
    true,
  );
  if (c.layout === "cover") {
    text(s, c.body[0], 70, 310, 960, 155, 44, color);
    text(s, c.body[1], 72, 565, 1000, 45, 20, "#B8CED7");
  } else if (c.layout === "statement") {
    text(s, c.body[0], 70, 225, 1060, 115, 50, teal, true);
    text(s, c.body[1], 72, 380, 1000, 115, 30);
    text(s, c.body[2], 72, 550, 1000, 70, 23, muted);
  } else if (c.layout === "portfolio") {
    await image(
      s,
      "reports/screenshots/07-portfolio-pitch.png",
      66,
      190,
      752,
      470,
    );
    [
      [stats.buildings, "synthetic buildings"],
      [stats.usable_reference, "usable references"],
      [stats.investigation, "investigation priority"],
    ].forEach(([n, label], j) => {
      text(s, String(n), 1000, 220 + j * 130, 190, 75, 58, teal, true);
      text(s, label, 1000, 293 + j * 130, 210, 45, 19, muted);
    });
  } else if (c.layout === "building") {
    text(s, c.body[0], 66, 220, 415, 115, 33, teal, true);
    text(s, c.body[1], 66, 352, 410, 75, 26);
    text(s, c.body[2], 66, 445, 410, 110, 24, muted);
    text(s, c.body[3], 66, 578, 1100, 50, 24, teal, true);
    await image(
      s,
      "reports/screenshots/08-building-pitch.png",
      510,
      210,
      688,
      430,
    );
  } else if (c.layout === "ai") {
    await image(s, "reports/screenshots/09-ai-evidence.png", 66, 210, 660, 400);
    c.body.slice(0,3).forEach((line,j)=>text(s,line,770,235+j*105,440,85,30,teal,true));
    text(s,c.body[3],770,560,420,85,24,muted);
  } else if (c.layout === "readiness") {
    text(s, c.body[0], 70, 225, 480, 60, 30, teal, true);
    text(s, c.body[1], 70, 310, 480, 210, 30);
    text(s, c.body[2], 670, 225, 500, 85, 30, teal, true);
    text(s, c.body[3], 670, 335, 490, 230, 30);
  } else if (c.layout === "pilot") {
    c.body.forEach((line, j) =>
      text(s, line, 72, 215 + j * 65, 1120, 55, 28, j % 2 ? muted : navy),
    );
  } else if (c.layout === "closing") {
    c.body
      .slice(0, 3)
      .forEach((line, j) =>
        text(s, line, 72, 235 + j * 115, 1070, 90, 35, "#FFFFFF"),
      );
    text(s, c.body[3], 72, 615, 1100, 38, 19, "#B8CED7");
  } else if (c.layout === "roles") {
    text(s, c.body[0], 72, 215, 1070, 105, 36, teal, true);
    c.body
      .slice(1)
      .forEach((line, j) => text(s, line, 72, 365 + j * 80, 1100, 65, 29));
  } else if (c.layout === "process") {
    c.body.forEach((line, j) =>
      text(
        s,
        line,
        72,
        230 + j * 95,
        1130,
        70,
        34,
        j % 2 ? muted : teal,
        j % 2 === 0,
      ),
    );
  } else if (c.layout === "alternatives") {
    c.body
      .slice(0, 3)
      .forEach((line, j) => text(s, line, 72, 220 + j * 80, 1110, 65, 30));
    text(s, c.body[3], 72, 500, 1110, 110, 29, teal, true);
  } else if (c.layout === "business") {
    c.body
      .slice(0, 3)
      .forEach((line, j) =>
        text(s, line, 72, 215 + j * 75, 1110, 58, 34, teal, j === 2),
      );
    text(s, c.body[3], 72, 480, 1110, 80, 29);
    text(s, c.body[4], 72, 585, 1110, 45, 22, muted);
  } else {
    text(s, c.body[0], 72, 215, 1100, 100, 32);
    text(s, c.body[1], 72, 350, 1100, 55, 25, muted);
    c.body
      .slice(2)
      .forEach((line, j) =>
        text(s, line, 72, 420 + j * 70, 1100, 60, 30, teal),
      );
  }
  const foot =
    c.source ??
    (dark ? "Provisional brand. Discussion proposal." : stats.disclosure);
  text(s, foot, 66, 676, 1090, 24, 12, dark ? "#B8CED7" : muted);
  text(
    s,
    String(i + 1).padStart(2, "0"),
    1170,
    674,
    70,
    28,
    15,
    dark ? "#B8CED7" : muted,
  );
  s.speakerNotes.text =
    c.note +
    "\nSource: provided product brief and repository artifacts. No real pilot outcomes claimed.";
  const png = await deck.export({ slide: s, format: "png", scale: 1 });
  await fs.writeFile(
    path.join(work, `slide-${String(i + 1).padStart(2, "0")}.png`),
    new Uint8Array(await png.arrayBuffer()),
  );
}
const candidate = path.join(work, "candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidate);
const stem = process.env.DECK_STEM ?? "Portotherm-LIAA";
const final = path.join(out, stem + ".pptx");
await finalizePresentation({
  workspaceDir: root,
  candidatePath: candidate,
  finalPath: final,
  pythonExecutable: python,
  integrityValidatorPath: path.join(
    skill,
    "container_tools/inspect_presentation_package_integrity.py",
  ),
  layoutValidatorPath: path.join(
    skill,
    "container_tools/inspect_presentation_layout_geometry.py",
  ),
  explicitTotalSlideCount: 12,
  layoutArgs: [
    "--expected-slide-size-emu",
    "12192000,6858000",
    "--validate-heading-fit",
  ],
  fontPolicy: { basis: "design", families: [fontFamily] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(work, stem + ".validation.json"),
});
try {
  const pdf = await deck.export({ format: "pdf" });
  await fs.writeFile(
    path.join(out, stem + ".pdf"),
    new Uint8Array(await pdf.arrayBuffer()),
  );
} catch (error) {
  console.log(
    "Native PDF export unavailable; using matching rendered slides:",
    error.message,
  );
  execFileSync(
    python,
    [
      path.join(root, "scripts/deck_pdf.py"),
      work,
      path.join(out, stem + ".pdf"),
    ],
    { stdio: "inherit" },
  );
}
const montage = await deck.export({ format: "webp", montage: true });
await fs.writeFile(
  path.join(work, "montage.webp"),
  new Uint8Array(await montage.arrayBuffer()),
);
console.log("Exported and validated 12-slide deck and matching PDF.");
