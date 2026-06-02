const state = {
  products: [],
  cart: new Map(),
  profile: null,
};

const els = {
  productList: document.querySelector("#product-list"),
  cartList: document.querySelector("#cart-list"),
  totalQty: document.querySelector("#total-qty"),
  grandTotal: document.querySelector("#grand-total"),
  saleForm: document.querySelector("#sale-form"),
  saleMessage: document.querySelector("#sale-message"),
  submitSale: document.querySelector("#submit-sale"),
  reloadProducts: document.querySelector("#reload-products"),
  testDbConnection: document.querySelector("#test-db-connection"),
  dbStatusDot: document.querySelector("#db-status-dot"),
  dbStatusText: document.querySelector("#db-status-text"),
  profileStatus: document.querySelector("#profile-status"),
  profileStatusDot: document.querySelector("#profile-status-dot"),
  profileImage: document.querySelector("#profile-image"),
};

const config = window.APP_CONFIG || {};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await Promise.all([initLiffProfile(), loadProducts(), checkDatabaseConnection()]);
  renderProducts();
  renderCart();
});

function bindEvents() {
  els.reloadProducts.addEventListener("click", async () => {
    await loadProducts();
    renderProducts();
  });

  els.testDbConnection.addEventListener("click", () => {
    checkDatabaseConnection();
  });

  els.saleForm.addEventListener("submit", handleSubmitSale);
}

async function initLiffProfile() {
  if (!window.liff || !config.LIFF_ID) {
    updateProfileView(null, "ต้องตั้งค่า LIFF_ID ก่อนขาย");
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
  els.profileImage.src = profile?.pictureUrl || "https://placehold.co/112x112?text=LINE";
  els.profileImage.alt = profile?.displayName || "LINE profile";
  els.profileStatusDot.className = `status-dot ${profile?.userId ? "status-online" : "status-offline"}`;
  els.submitSale.disabled = !profile?.userId;
}

async function loadProducts() {
  try {
    const response = await fetch("./products.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("โหลดสินค้าไม่สำเร็จ");
    }

    const products = await response.json();
    state.products = products.filter((product) => product.active);
  } catch (error) {
    console.error(error);
    els.productList.innerHTML = `<div class="empty-state">ไม่สามารถโหลดสินค้าได้</div>`;
  }
}

async function checkDatabaseConnection() {
  if (!config.APPS_SCRIPT_URL) {
    updateDatabaseStatus("ยังไม่ได้ตั้งค่า DB", "offline");
    return;
  }

  updateDatabaseStatus("กำลังตรวจสอบฐานข้อมูล...", "pending");

  try {
    const response = await fetch(config.APPS_SCRIPT_URL, {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "เชื่อมต่อฐานข้อมูลไม่สำเร็จ");
    }

    updateDatabaseStatus("ฐานข้อมูลพร้อมใช้งาน", "online");
  } catch (error) {
    console.error(error);
    updateDatabaseStatus("ฐานข้อมูลไม่พร้อมใช้งาน", "offline");
  }
}

function updateDatabaseStatus(message, status) {
  els.dbStatusText.textContent = message;
  els.dbStatusDot.className = `db-status-dot db-status-${status}`;
}

function renderProducts() {
  if (!state.products.length) {
    els.productList.innerHTML = `<div class="empty-state">ยังไม่มีสินค้า</div>`;
    return;
  }

  els.productList.innerHTML = state.products.map((product) => {
    const qty = state.cart.get(product.sku)?.qty || 0;
    return `
      <article class="product-card">
        <img class="product-image" src="${product.image}" alt="${product.name}">
        <div class="product-meta">
          <div class="price-block">
            <span class="price-label">ราคา</span>
            <strong class="price-tag">${formatMoney(product.price)}</strong>
          </div>
          <strong class="stock-count">คงเหลือ ${product.stock}</strong>
        </div>
        <div class="product-actions">
          <button class="qty-button" type="button" data-action="decrease" data-sku="${product.sku}" aria-label="ลด ${product.name}">-</button>
          <span class="qty-pill">${qty}</span>
          <button class="qty-button" type="button" data-action="increase" data-sku="${product.sku}" aria-label="เพิ่ม ${product.name}">+</button>
        </div>
      </article>
    `;
  }).join("");

  els.productList.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => adjustCart(button.dataset.sku, button.dataset.action));
  });
}

function adjustCart(sku, action) {
  const product = state.products.find((item) => item.sku === sku);
  if (!product) return;

  const current = state.cart.get(sku) || { ...product, qty: 0 };
  const nextQty = action === "increase" ? current.qty + 1 : current.qty - 1;

  if (nextQty <= 0) {
    state.cart.delete(sku);
  } else if (nextQty <= product.stock) {
    state.cart.set(sku, { ...current, qty: nextQty });
  }

  renderProducts();
  renderCart();
}

function renderCart() {
  const items = Array.from(state.cart.values());

  if (!items.length) {
    els.cartList.innerHTML = `<div class="empty-state">ยังไม่มีสินค้า</div>`;
    els.totalQty.textContent = "0";
    els.grandTotal.textContent = formatMoney(0);
    return;
  }

  let totalQty = 0;
  let grandTotal = 0;

  els.cartList.innerHTML = items.map((item) => {
    const lineTotal = item.qty * item.price;
    totalQty += item.qty;
    grandTotal += lineTotal;

    return `
      <article class="cart-item">
        <div class="cart-row">
          <strong>${item.name}</strong>
          <span>${formatMoney(lineTotal)}</span>
        </div>
        <div class="cart-row">
          <span class="subtle">${item.qty} x ${formatMoney(item.price)}</span>
          <button class="ghost-button" type="button" data-remove="${item.sku}">ลบ</button>
        </div>
      </article>
    `;
  }).join("");

  els.totalQty.textContent = String(totalQty);
  els.grandTotal.textContent = formatMoney(grandTotal);

  els.cartList.querySelectorAll("button[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart.delete(button.dataset.remove);
      renderProducts();
      renderCart();
    });
  });
}

async function handleSubmitSale(event) {
  event.preventDefault();
  setFeedback(els.saleMessage, "กำลังบันทึก...");

  const items = Array.from(state.cart.values());
  if (!items.length) {
    setFeedback(els.saleMessage, "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
    return;
  }

  if (!state.profile?.userId) {
    setFeedback(els.saleMessage, "กรุณาเข้าสู่ระบบ LINE ก่อนขาย");
    return;
  }

  if (!config.APPS_SCRIPT_URL) {
    setFeedback(els.saleMessage, "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL");
    return;
  }

  const saleItems = items.map((item) => ({
    sku: item.sku,
    name: item.name,
    qty: item.qty,
    price: item.price,
    cost: Number(item.cost || 0),
    lineTotal: item.qty * item.price,
    lineCost: item.qty * Number(item.cost || 0),
  }));
  const totalAmount = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCost = saleItems.reduce((sum, item) => sum + item.lineCost, 0);

  const payload = {
    action: "createSale",
    sale: {
      createdAt: new Date().toISOString(),
      lineUserId: state.profile.userId,
      lineDisplayName: state.profile.displayName,
      customerName: "",
      paymentMethod: "",
      note: "",
      totalQty: saleItems.reduce((sum, item) => sum + item.qty, 0),
      totalAmount,
      totalCost,
      grossProfit: totalAmount - totalCost,
      items: saleItems,
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
      throw new Error(result.message || "บันทึกการขายไม่สำเร็จ");
    }

    state.cart.clear();
    els.saleForm.reset();
    renderProducts();
    renderCart();
    setFeedback(els.saleMessage, `บันทึกสำเร็จ เลขที่ ${result.saleId}`, true);
  } catch (error) {
    console.error(error);
    setFeedback(els.saleMessage, error.message || "เกิดข้อผิดพลาด");
  }
}

function setFeedback(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function formatMoney(value) {
  return `${Number(value).toFixed(2)} บาท`;
}
