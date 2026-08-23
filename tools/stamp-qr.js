// Stamps the AR-site QR code onto the top-right corner of the resume PDF.
// Scales page content down slightly (anchored at bottom-left) so the QR
// gets clean whitespace instead of overlapping the contact line.
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const QRCode = require("qrcode");
const fs = require("fs");

const SITE_URL = "https://canman2828.github.io/AR-Resume/";

(async () => {
  const qrPng = await QRCode.toBuffer(SITE_URL, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 600,
  });

  const pdf = await PDFDocument.load(fs.readFileSync("resume-original.pdf"));
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  console.log("PAGE_SIZE:", width, height);

  const dark = rgb(0.12, 0.16, 0.22);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // --- dark header band (the AR tracker needs large high-contrast
  // shapes; dense body text alone is too self-similar to detect) ----
  // The original name/contact/skills lines sit at y≈700-776 with no
  // usable gap below them, so the band covers through the SKILLS
  // section and all of it is redrawn in white inside the band.
  // Visible body content resumes at ACADEMICS (y≈694).
  const bandBottom = 697;
  page.drawRectangle({ x: 0, y: bandBottom, width, height: height - bandBottom, color: dark });

  // photo (left) and QR tile (right) are symmetric, so text centers
  // on the full page width
  const centered = (t, f, s) => (width - f.widthOfTextAtSize(t, s)) / 2;
  const line = (t, y, f, s, color) =>
    page.drawText(t, { x: centered(t, f, s), y, size: s, font: f, color });

  const white = rgb(1, 1, 1);
  const lightGray = rgb(0.82, 0.85, 0.89);
  line("CANADY MITCHEM", 764, bold, 26, white);
  line(
    "816-724-9751   |   Csmhgc@umsystem.edu   |   canadymitchem.com   |   linkedin.com/in/c-mitchem",
    745, font, 9.5, lightGray
  );
  line("Languages: C, C#, Python, Java, HTML, CSS.", 727, font, 8, lightGray);
  line("Platforms: Visual Studio Code, Visual Studio, Git, Unity, React Native.", 715, font, 8, lightGray);

  // profile photo inside the band, top-left (also a strong, unique
  // feature source for the tracker)
  const photoPng = fs.readFileSync(
    "C:\\Users\\canma\\documents\\AR-Resume\\assets\\profile.png"
  );
  const photoImg = await pdf.embedPng(photoPng);
  const ph = 78;
  page.drawImage(photoImg, {
    x: 16,
    y: bandBottom + (height - bandBottom - ph) / 2,
    width: ph,
    height: ph,
  });

  // QR on a white tile inside the band, top-right
  const qrImage = await pdf.embedPng(qrPng);
  const tile = 78, qrSize = 68;
  const tx = width - 16 - tile;
  const ty = bandBottom + (height - bandBottom - tile) / 2;
  page.drawRectangle({ x: tx, y: ty, width: tile, height: tile, color: white });
  page.drawImage(qrImage, {
    x: tx + (tile - qrSize) / 2,
    y: ty + (tile - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  // dark chips behind the resume's own section headings — distributes
  // tracking anchors down the page instead of only in the header band
  const chips = [
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

  // corner brackets + footer bar: extra unique anchors
  const bkt = { t: 2.5, arm: 22, off: 10 };
  const corner = (cx, cy, dx, dy) => {
    page.drawRectangle({ x: cx, y: cy - (dy < 0 ? bkt.t : 0), width: dx * bkt.arm, height: bkt.t, color: dark });
    page.drawRectangle({ x: cx - (dx < 0 ? bkt.t : 0), y: cy, width: bkt.t, height: dy * bkt.arm, color: dark });
  };
  corner(bkt.off, 24, 1, 1);
  corner(width - bkt.off, 24, -1, 1);

  const footer = "canadymitchem.com   ·   scan the QR code for the AR version of this resume";
  page.drawRectangle({ x: 40, y: 4, width: width - 80, height: 14, color: dark });
  page.drawText(footer, {
    x: (width - font.widthOfTextAtSize(footer, 7.5)) / 2,
    y: 8.5,
    size: 7.5,
    font,
    color: rgb(1, 1, 1),
  });

  fs.writeFileSync("resume-ar.pdf", await pdf.save());
  console.log("STAMPED: resume-ar.pdf");
})().catch((e) => { console.error("STAMP_FAILED:", e.message); process.exit(1); });
