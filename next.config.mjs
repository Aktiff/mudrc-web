import fs from "fs";
import path from "path";

function fixUtf16File(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 2) return false;

  let text = null;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.slice(2).toString("utf16le");
  } else if (buf.includes(0) && buf.slice(0, 40).filter((byte, index) => index % 2 === 1 && byte === 0).length >= 8) {
    text = buf.toString("utf16le");
  }

  if (!text) return false;
  fs.writeFileSync(filePath, text, "utf8");
  return true;
}

function walkAndFix(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndFix(fullPath);
      continue;
    }
    if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      fixUtf16File(fullPath);
    }
  }
}

walkAndFix(path.join(process.cwd(), "src"));

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;