const SHEET_SALES = "sales";
const SHEET_STOCK_LOGS = "stock_logs";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");

    if (payload.action === "createSale") {
      const result = createSale_(payload.sale);
      return jsonOutput_({ ok: true, saleId: result.saleId });
    }

    if (payload.action === "updateStock") {
      updateStock_(payload.stock);
      return jsonOutput_({ ok: true });
    }

    return jsonOutput_({ ok: false, message: "Unsupported action" });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message });
  }
}

function doGet() {
  return jsonOutput_({
    ok: true,
    message: "POS Apps Script is running",
  });
}

function createSale_(sale) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SALES);
  if (!sheet) throw new Error("Missing sales sheet");

  const saleId = Utilities.getUuid().slice(0, 8).toUpperCase();
  const row = [
    saleId,
    sale.createdAt,
    sale.lineUserId,
    sale.lineDisplayName,
    sale.customerName,
    sale.paymentMethod,
    sale.note,
    sale.totalQty,
    sale.totalAmount,
    sale.totalCost,
    sale.grossProfit,
    JSON.stringify(sale.items),
  ];

  sheet.appendRow(row);
  return { saleId: saleId };
}

function updateStock_(stock) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STOCK_LOGS);
  if (!sheet) throw new Error("Missing stock_logs sheet");

  const row = [
    stock.updatedAt,
    stock.sku,
    stock.productName,
    stock.quantity,
    stock.reason,
    stock.lineUserId,
    stock.lineDisplayName,
  ];

  sheet.appendRow(row);
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
