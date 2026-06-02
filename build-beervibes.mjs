import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "outputs");
const outputPath = path.join(outputDir, "beervibes.xlsx");
const dashboardPreviewPath = path.join(outputDir, "beervibes-dashboard.png");

const workbook = Workbook.create();

const dashboard = workbook.worksheets.add("Dashboard");
const products = workbook.worksheets.add("Products");
const sales = workbook.worksheets.add("Sales");
const stockLogs = workbook.worksheets.add("Stock Logs");
const instructions = workbook.worksheets.add("Instructions");

products.getRange("A1:G4").values = [
  ["sku", "name", "price", "cost", "stock", "active", "category"],
  ["CHANG-BOTTLE", "เบียร์ช้างขวด", 75, 52, 48, true, "Beer"],
  ["LEO-BOTTLE", "เบียร์ลีโอขวด", 75, 51, 48, true, "Beer"],
  ["SINGHA-BOTTLE", "เบียร์สิงห์ขวด", 80, 56, 36, true, "Beer"],
];

sales.getRange("A1:L1").values = [
  ["sale_id", "created_at", "line_user_id", "line_display_name", "customer_name", "payment_method", "note", "total_qty", "total_amount", "total_cost", "gross_profit", "items_json"],
];

stockLogs.getRange("A1:G1").values = [
  ["updated_at", "sku", "product_name", "quantity", "reason", "line_user_id", "line_display_name"],
];

dashboard.getRange("A1:F16").values = [
  ["BeerVibes POS Workbook", "", "", "", "", ""],
  ["พร้อมใช้งานกับ GitHub Pages + LIFF + Google Sheets", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["KPI", "Value", "", "Product", "Stock", ""],
  ["Active Products", "", "", "เบียร์ช้างขวด", "", ""],
  ["Current Stock Units", "", "", "เบียร์ลีโอขวด", "", ""],
  ["Sales Rows Used", "", "", "เบียร์สิงห์ขวด", "", ""],
  ["Sales Amount Logged", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["How to use", "", "", "", "", ""],
  ["1. Update Products sheet if price or opening stock changes", "", "", "", "", ""],
  ["2. Apps Script appends rows to Sales and Stock Logs", "", "", "", "", ""],
  ["3. Dashboard updates automatically from sheet formulas", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["Suggested Apps Script target sheets", "", "", "", "", ""],
  ["Sales -> sales | Stock Logs -> stock_logs", "", "", "", "", ""],
];

dashboard.getRange("B5").formulas = [["=COUNTA(Products!A2:A200)"]];
dashboard.getRange("B6").formulas = [["=SUM(Products!E2:E200)"]];
dashboard.getRange("B7").formulas = [["=COUNTA(Sales!A2:A1000)"]];
dashboard.getRange("B8").formulas = [["=SUM(Sales!I2:I1000)"]];
dashboard.getRange("E5").formulas = [["=Products!E2"]];
dashboard.getRange("E6").formulas = [["=Products!E3"]];
dashboard.getRange("E7").formulas = [["=Products!E4"]];

instructions.getRange("A1:B12").values = [
  ["Step", "Detail"],
  ["1", "Open config.js and set LIFF_ID and APPS_SCRIPT_URL"],
  ["2", "Deploy static files from the pos-github-pages folder to GitHub Pages"],
  ["3", "Create a Google Sheet with tabs named sales and stock_logs"],
  ["4", "Deploy apps-script.gs as a Web App with access set to Anyone"],
  ["5", "Use the same GitHub Pages URL as the LIFF endpoint"],
  ["6", "Use Products sheet as the source of truth for items and opening stock"],
  ["7", "Sales rows will store order headers and items_json"],
  ["8", "Stock Logs rows will store stock adjustments and audit trail"],
  ["9", "If you need live stock in the static app, move product loading to Apps Script"],
  ["10", "Protect the stock page with a PIN or LINE whitelist before production use"],
  ["11", "Review Dashboard before each shift to confirm stock baseline"],
];

dashboard.getRange("A1:F16").format.columnWidthPx = 160;
dashboard.getRange("A1:A16").format.columnWidthPx = 230;
dashboard.getRange("B1:B16").format.columnWidthPx = 170;
dashboard.getRange("D1:D16").format.columnWidthPx = 240;
dashboard.getRange("E1:E16").format.columnWidthPx = 120;

products.getRange("A1:G10").format.columnWidthPx = 140;
products.getRange("B1:B10").format.columnWidthPx = 220;
sales.getRange("A1:L20").format.columnWidthPx = 160;
sales.getRange("D1:D20").format.columnWidthPx = 180;
sales.getRange("L1:L20").format.columnWidthPx = 260;
stockLogs.getRange("A1:G20").format.columnWidthPx = 170;
instructions.getRange("A1:B20").format.columnWidthPx = 180;
instructions.getRange("B1:B20").format.columnWidthPx = 520;

const inspection = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A1:F16",
  include: "values,formulas",
  tableMaxRows: 16,
  tableMaxCols: 6,
});

console.log(inspection.ndjson);

const preview = await workbook.render({
  sheetName: "Dashboard",
  range: "A1:F16",
  scale: 2,
});

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(dashboardPreviewPath, Buffer.from(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath);
