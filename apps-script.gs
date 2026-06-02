const SHEET_PRODUCTS = "Products";
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

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "";

  if (action === "getProducts") {
    return jsonOutput_({
      ok: true,
      products: getProducts_(),
    });
  }

  return jsonOutput_({
    ok: true,
    message: "POS Apps Script is running",
  });
}

function createSale_(sale) {
  const sheet = getSheetByName_(SHEET_SALES);
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
  applySaleToProducts_(sale.items);
  return { saleId: saleId };
}

function updateStock_(stock) {
  const sheet = getSheetByName_(SHEET_STOCK_LOGS);
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
  setProductStock_(stock.sku, stock.quantity);
}

function getProducts_() {
  const sheet = getSheetByName_(SHEET_PRODUCTS, "products");
  if (!sheet) throw new Error("Missing products sheet");

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(header) {
    return String(header).trim().toLowerCase();
  });

  return values.slice(1).map(function(row) {
    return mapProductRow_(headers, row);
  }).filter(function(product) {
    return product && product.sku && product.active;
  });
}

function mapProductRow_(headers, row) {
  const product = {};

  headers.forEach(function(header, index) {
    product[header] = row[index];
  });

  return {
    sku: String(product.sku || "").trim(),
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    cost: Number(product.cost || 0),
    stock: Number(product.stock || 0),
    active: parseBoolean_(product.active),
    category: String(product.category || "").trim(),
  };
}

function applySaleToProducts_(items) {
  items.forEach(function(item) {
    adjustProductStock_(item.sku, -Number(item.qty || 0));
  });
}

function setProductStock_(sku, quantity) {
  updateProductStock_(sku, function() {
    return Number(quantity || 0);
  });
}

function adjustProductStock_(sku, delta) {
  updateProductStock_(sku, function(currentStock) {
    return Math.max(0, currentStock + delta);
  });
}

function updateProductStock_(sku, nextStockFn) {
  const sheet = getSheetByName_(SHEET_PRODUCTS, "products");
  if (!sheet) throw new Error("Missing products sheet");

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("Products sheet is empty");

  const headers = values[0].map(function(header) {
    return String(header).trim().toLowerCase();
  });
  const skuIndex = headers.indexOf("sku");
  const stockIndex = headers.indexOf("stock");

  if (skuIndex === -1 || stockIndex === -1) {
    throw new Error("Products sheet must contain sku and stock columns");
  }

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][skuIndex]).trim() === sku) {
      const currentStock = Number(values[rowIndex][stockIndex] || 0);
      const nextStock = nextStockFn(currentStock);
      sheet.getRange(rowIndex + 1, stockIndex + 1).setValue(nextStock);
      return;
    }
  }

  throw new Error("Product not found for SKU: " + sku);
}

function getSheetByName_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  for (var i = 0; i < arguments.length; i += 1) {
    const sheet = spreadsheet.getSheetByName(arguments[i]);
    if (sheet) return sheet;
  }

  return null;
}

function parseBoolean_(value) {
  if (typeof value === "boolean") return value;
  return String(value).trim().toLowerCase() !== "false" && String(value).trim() !== "";
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
