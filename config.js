// ============================================================
//  AR RESUME — EDIT THIS FILE ONLY
//  Everything the AR scene shows comes from here.
// ============================================================

const AR_CONFIG = {
  // Your name + title (shown on the glass header above the resume)
  name: "Your Name",
  title: "Software Developer",

  // Left column — About panel
  about:
    "Passionate developer building AR/VR experiences and full-stack " +
    "applications. Always learning, always shipping.",

  // Optional profile photo (put the file in assets/ and set the path).
  // Leave as null to show a generated placeholder avatar.
  photo: null, // e.g. "assets/profile.jpg"

  // Left column — Contacts panel (each row is tappable in AR)
  contacts: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/your-profile" },
    { label: "GitHub",   url: "https://github.com/Canman2828" },
    { label: "Website",  url: "https://your-website.com" },
  ],

  // Right column — Highlighted Projects (each card is tappable, opens YouTube)
  // youtubeId = the part after "watch?v=" in the video URL
  projects: [
    { title: "Sizzle - mysight", youtubeId: "1Tngz3l_SmQ" },
    { title: "Guessify",         youtubeId: "NaGQZsKkdBM" },
  ],

  // The URL where this site is deployed — the printable QR code points here.
  siteUrl: "https://canman2828.github.io/AR-Resume/",

  // Aspect ratio (height / width) of your tracking target image.
  // The bundled demo card is landscape: 0.6
  // A letter-size printed resume is portrait: 1.294  (11 / 8.5)
  targetHeight: 0.6,
};
