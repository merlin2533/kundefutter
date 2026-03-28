const fs = require('fs');
const path = require('path');

// Simple SVG icon with "A" for AgrarOffice (green background)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#16a34a"/>
  <text x="256" y="320" font-family="Arial,sans-serif" font-size="280" font-weight="bold"
        text-anchor="middle" fill="white">A</text>
</svg>`;

const dir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon.svg'), svgIcon);
console.log('SVG icon created at public/icons/icon.svg');

// Try to generate PNG icons using sharp if available
try {
  const sharp = require('sharp');
  const svgBuffer = Buffer.from(svgIcon);

  Promise.all([
    sharp(svgBuffer).resize(192, 192).png().toFile(path.join(dir, 'icon-192x192.png')),
    sharp(svgBuffer).resize(512, 512).png().toFile(path.join(dir, 'icon-512x512.png')),
  ])
    .then(() => {
      console.log('PNG icons generated: icon-192x192.png, icon-512x512.png');
    })
    .catch((err) => {
      console.error('Error generating PNGs:', err.message);
    });
} catch (e) {
  console.log('sharp not available – only SVG icon created.');
  console.log('NOTE: Convert to PNG manually or install sharp for auto-conversion');
}
