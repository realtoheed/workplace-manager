const https = require("https");

const options = {
  hostname: "2.24.75.34",
  port: 443,
  path: "/api/salary/auto-calculate",
  method: "POST",
  headers: {
    "x-cron-secret": "infovibex-auto-salary-2026",
  },
  rejectUnauthorized: false,
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    const data = JSON.parse(body);
    console.log(`[${new Date().toISOString()}] Salary auto-calc:`, JSON.stringify(data, null, 2));
    process.exit(0);
  });
});

req.on("error", (err) => {
  console.error(`[${new Date().toISOString()}] Salary auto-calc failed:`, err.message);
  process.exit(1);
});

req.end();