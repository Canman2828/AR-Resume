// Minimal-change variant: the user's own PDF (already has their QR),
// only adding dark chips behind the existing section headings.
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync("user-version.pdf"));
  const page = pdf.getPage(0);
  const dark = rgb(0.12, 0.16, 0.22);
  const white = rgb(1, 1, 1);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const chips = [
    ["SKILLS", 727],
    ["ACADEMICS", 684],
    ["WORK EXPERIENCE", 653],
    ["RELEVANT PROJECTS", 243],
    ["PROFESSIONAL EXTRACURRICULAR", 141],
  ];
  for (const [t, y] of chips) {
    const w = bold.widthOfTextAtSize(t, 10) + 18;
    page.drawRectangle({ x: 26, y: y - 4.5, width: w, height: 16.5, color: dark });
    page.drawText(t, { x: 35, y, size: 10, font: bold, color: white });
  }

  fs.writeFileSync("user-chips.pdf", await pdf.save());
  console.log("STAMPED: user-chips.pdf");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
