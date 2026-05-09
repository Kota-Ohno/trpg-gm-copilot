import { readFileSync } from "node:fs";

const checks = [
  {
    file: "dist/_headers",
    patterns: [
      "X-Content-Type-Options: nosniff",
      "X-Frame-Options: DENY",
      "Referrer-Policy: strict-origin-when-cross-origin",
      "Permissions-Policy: camera=(), geolocation=(), microphone=(self)",
      "Content-Security-Policy:",
      "connect-src 'self' https://api.openai.com http://localhost:* http://127.0.0.1:*",
    ],
  },
  {
    file: "dist/.well-known/security.txt",
    patterns: [
      "Contact: https://github.com/Kota-Ohno/trpg-gm-copilot/security/advisories/new",
      "Policy: https://github.com/Kota-Ohno/trpg-gm-copilot/blob/main/SECURITY.md",
      "Preferred-Languages: ja, en",
      "Expires: 2027-05-09T00:00:00Z",
    ],
  },
];

for (const check of checks) {
  const content = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      throw new Error(`${check.file} is missing expected release content: ${pattern}`);
    }
  }
}

console.log("release files ok");
