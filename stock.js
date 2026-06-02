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

    state.products = await response.json();
  } catch (error) {
    console.error(error);
    els.stockList.innerHTML = `<div class="empty-state">ไม่สามารถโหลดสินค้าได้</div>`;
  }
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
      lineUserId: state.profile?.userId || "",
      lineDisplayName: state.profile?.displayName || "Guest",
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
