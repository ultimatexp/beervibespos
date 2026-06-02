const state = {
  products: [],
  profile: null,
};

const els = {
  stockList: document.querySelector("#stock-list"),
  stockMessage: document.querySelector("#stock-message"),
  reloadProducts: document.querySelector("#reload-products"),
  profileStatus: document.querySelector("#profile-status"),
  profileName: document.querySelector("#profile-name"),
  profileId: document.querySelector("#profile-id"),
  profileImage: document.querySelector("#profile-image"),
};

const config = window.APP_CONFIG || {};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await Promise.all([initLiffProfile(), loadProducts()]);
  renderStock();
});

function bindEvents() {
  els.reloadProducts.addEventListener("click", async () => {
    await loadProducts();
    renderStock();
  });
}

async function initLiffProfile() {
  if (!window.liff || !config.LIFF_ID) {
    updateProfileView(null, "ต้องตั้งค่า LIFF_ID ก่อนแก้สต๊อก");
    return;
  }

  try {
    await window.liff.init({ liffId: config.LIFF_ID });

    if (!window.liff.isLoggedIn()) {
      window.liff.login();
      return;
    }

    const profile = await window.liff.getProfile();
    state.profile = {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || "",
    };

    updateProfileView(state.profile, "เชื่อมต่อ LINE แล้ว");
  } catch (error) {
    console.error(error);
    updateProfileView(null, "กรุณาเข้าสู่ระบบ LINE");
  }
}

function updateProfileView(profile, status) {
  els.profileStatus.textContent = status;
  els.profileName.textContent = profile?.displayName || "ยังไม่ได้เข้าสู่ระบบ";
  els.profileId.textContent = profile?.userId || "-";
  els.profileImage.src = profile?.pictureUrl || "https://placehold.co/112x112?text=LINE";
}

async function loadProducts() {
  try {
    const localProducts = await loadLocalProducts_();
    state.products = isConfiguredAppsScriptUrl(config.APPS_SCRIPT_URL)
      ? await loadProductsFromDatabase_(localProducts)
      : localProducts;
  } catch (error) {
    console.error(error);
    els.stockList.innerHTML = `<div class="empty-state">ไม่สามารถโหลดสินค้าได้</div>`;
  }
}

function isConfiguredAppsScriptUrl(url) {
  if (!url || url.includes("REPLACE_WITH_YOUR_APPS_SCRIPT_WEB_APP_URL")) return false;

  try {
    const parsedUrl = new URL(url.trim());
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

async function loadLocalProducts_() {
  const response = await fetch("./products.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("โหลดสินค้าไม่สำเร็จ");
  }

  return response.json();
}

async function loadProductsFromDatabase_(localProducts) {
  const productsUrl = new URL(config.APPS_SCRIPT_URL.trim());
  productsUrl.searchParams.set("action", "getProducts");
  productsUrl.searchParams.set("_", String(Date.now()));

  const response = await fetch(productsUrl.toString(), { method: "GET" });
  const text = await response.text();
  if (/accounts\.google\.com|<html/i.test(text)) {
    throw new Error("DB ต้องเปิดสิทธิ์ Anyone");
  }

  const result = JSON.parse(text);
  if (!response.ok || !result.ok || !Array.isArray(result.products)) {
    throw new Error(result.message || "โหลดสินค้าจากฐานข้อมูลไม่สำเร็จ");
  }

  const imageBySku = new Map(localProducts.map((product) => [product.sku, product.image]));
  return result.products.map((product) => ({
    ...product,
    image: imageBySku.get(product.sku) || "",
  }));
}

function renderStock() {
  if (!state.products.length) {
    els.stockList.innerHTML = `<div class="empty-state">ยังไม่มีสินค้า</div>`;
    return;
  }

  els.stockList.innerHTML = state.products.map((product) => `
    <article class="stock-card">
      <div class="stock-top">
        <div>
          <h3>${product.name}</h3>
          <p class="subtle">SKU: ${product.sku}</p>
        </div>
        <strong>${product.stock} ขวด</strong>
      </div>
      <form class="stock-form" data-sku="${product.sku}">
        <input name="quantity" type="number" min="0" value="${product.stock}" required>
        <select name="reason">
          <option value="manual_adjust">ปรับยอด</option>
          <option value="restock">รับของเข้า</option>
          <option value="count">ตรวจนับสต๊อก</option>
        </select>
        <button class="primary-button" type="submit">บันทึกสต๊อก</button>
      </form>
    </article>
  `).join("");

  els.stockList.querySelectorAll("form[data-sku]").forEach((form) => {
    form.addEventListener("submit", handleStockSubmit);
  });
}

async function handleStockSubmit(event) {
  event.preventDefault();

  if (!config.APPS_SCRIPT_URL) {
    setFeedback("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL");
    return;
  }

  if (!state.profile?.userId) {
    setFeedback("กรุณาเข้าสู่ระบบ LINE ก่อนแก้สต๊อก");
    return;
  }

  const form = event.currentTarget;
  const sku = form.dataset.sku;
  const quantity = Number(form.quantity.value);
  const reason = form.reason.value;
  const product = state.products.find((item) => item.sku === sku);

  if (!product || Number.isNaN(quantity) || quantity < 0) {
    setFeedback("ข้อมูลสต๊อกไม่ถูกต้อง");
    return;
  }

  setFeedback(`กำลังอัปเดต ${product.name} ...`);

  const payload = {
    action: "updateStock",
    stock: {
      updatedAt: new Date().toISOString(),
      sku,
      productName: product.name,
      quantity,
      reason,
      lineUserId: state.profile.userId,
      lineDisplayName: state.profile.displayName,
    },
  };

  try {
    const response = await fetch(config.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "อัปเดตสต๊อกไม่สำเร็จ");
    }

    product.stock = quantity;
    renderStock();
    setFeedback(`อัปเดต ${product.name} สำเร็จ`, true);
  } catch (error) {
    console.error(error);
    setFeedback(error.message || "เกิดข้อผิดพลาด");
  }
}

function setFeedback(message, success = false) {
  els.stockMessage.textContent = message;
  els.stockMessage.classList.toggle("success", success);
}
