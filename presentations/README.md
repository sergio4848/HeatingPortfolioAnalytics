# Reproduce the meeting package

Editable content: source/slides.json, docs/product/one-pager.md, docs/business/pilot-proposal.md, docs/meeting and packages/brand. Update brand.json and the content together when changing name or claims. No unverified founder facts may be inserted.

## Input evidence

Run the local app and `npm run e2e` in apps/web. Tests create actual screenshots in reports/screenshots, including portfolio/building pitch views. The synthetic seed is reproducible; labels are separate from analysis. Shared metrics in reports/demo-statistics.json come from the real analysis function, not invented presentation KPIs.

## Brand

Set RUNTIME_NODE_MODULES to the bundled Node package directory returned by the Codex workspace-dependency tool. Then `node scripts/brand.mjs` creates PNG and app-icon exports from the editable SVGs. No font binaries are distributed.

## Editable PowerPoint

The builder uses the bundled @oai/artifact-tool and presentation skill finalizer. Set:

```powershell
$env:RUNTIME_NODE_MODULES = '<bundled Node node_modules directory>'
$env:PRESENTATION_SKILL_DIR = '<installed Presentations SKILL directory>'
$env:RUNTIME_PYTHON = '<bundled Python executable>'
$env:DECK_STEM = 'Portotherm-LIAA-new-revision'
node presentations/source/build.mjs
```

Use a new stem for each revision. The finalizer does not overwrite final outputs/receipts. It checks package integrity, exact twelve slides, geometry and Arial font policy, and re-imports the file. Finalizer receipts remain in ignored work/presentation. Windows sandbox may block its hard-link operation; run in a permitted local process.

Native PDF export may fail with missing #standard-fonts/Helvetica in this runtime. The builder then calls scripts/deck_pdf.py, putting the identical slide renders into the matching PDF. This PDF is a visual export; its text is flattened. PPTX text and notes remain editable. Rendered screenshots in the deck remain images as intended.

## Standalone PDFs

`python scripts/materials.py` creates a one-page overview, three-page pilot proposal and one-page brand guide. It uses ReportLab with exact numeric evidence from reports/demo-statistics.json. Scripts hold the editable layout/content used for the final PDFs; the Markdown sources carry their corresponding written material. After editing, keep script content and Markdown in agreement, regenerate, render and visually inspect every page.

## Visual validation

All twelve slide PNGs and five standalone PDF pages were visually inspected. PDF page counts, package integrity, disclosure and methods are recorded in reports/validation.md. Font/native PowerPoint rendering is not proved by structural checks. No private meeting link, password or actual email is included.
