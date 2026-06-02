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
  paymentMethod: document.querySelector("#payment-method"),
  customerName: document.querySelector("#customer-name"),
  saleNote: document.querySelector("#sale-note"),
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
  renderProducts();
  renderCart();
});

function bindEvents() {
  els.reloadProducts.addEventListener("click", async () => {
    await loadProducts();
    renderProducts();
  });

  els.saleForm.addEventListener("submit", handleSubmitSale);
}

async function initLiffProfile() {
  if (!window.liff || !config.LIFF_ID) {
    updateProfileView(null, "ยังไม่ได้ตั้งค่า LIFF_ID");
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
    updateProfileView(null, "เชื่อมต่อ LINE ไม่สำเร็จ");
  }
}

function updateProfileView(profile, status) {
  els.profileStatus.textContent = status;
  els.profileName.textContent = profile?.displayName || "Guest";
  els.profileId.textContent = profile?.userId || "-";
  els.profileImage.src = profile?.pictureUrl || "https://placehold.co/112x112?text=LINE";
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

function renderProducts() {
  if (!state.products.length) {
    els.productList.innerHTML = `<div class="empty-state">ยังไม่มีสินค้า</div>`;
    return;
  }

  els.productList.innerHTML = state.products.map((product) => {
    const qty = state.cart.get(product.sku)?.qty || 0;
    return `
      <article class="product-card">
        <div class="product-top">
          <div>
            <h3>${product.name}</h3>
            <p class="subtle">SKU: ${product.sku}</p>
          </div>
          <div class="price-tag">${formatMoney(product.price)}</div>
        </div>
        <div class="product-top">
          <span class="subtle">คงเหลือ ${product.stock} ขวด</span>
          <div class="qty-controls">
            <button class="small-button" type="button" data-action="decrease" data-sku="${product.sku}">-</button>
            <span class="qty-pill">${qty}</span>
            <button class="small-button" type="button" data-action="increase" data-sku="${product.sku}">+</button>
          </div>
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
    els.cartList.innerHTML = `<div class="empty-state">ยังไม่มีสินค้าในบิล</div>`;
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

  if (!config.APPS_SCRIPT_URL) {
    setFeedback(els.saleMessage, "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL");
    return;
  }

  const payload = {
    action: "createSale",
    sale: {
      createdAt: new Date().toISOString(),
      lineUserId: state.profile?.userId || "",
      lineDisplayName: state.profile?.displayName || "Guest",
      customerName: els.customerName.value.trim(),
      paymentMethod: els.paymentMethod.value,
      note: els.saleNote.value.trim(),
      totalQty: items.reduce((sum, item) => sum + item.qty, 0),
      totalAmount: items.reduce((sum, item) => sum + item.qty * item.price, 0),
      items,
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
