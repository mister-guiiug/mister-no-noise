// web-ext configuration (lint / run / build) — source = extension/
export default {
  sourceDir: 'extension',
  ignoreFiles: [
    'manifest.chrome.json',
    'src/sw.js',
  ],
  build: {
    overwriteDest: true,
    filename: 'mister-no-noise-{version}.zip',
  },
};
