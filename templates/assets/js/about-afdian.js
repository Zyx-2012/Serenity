(function () {
  let currentAfdianPlan = null;
  let currentMonth = 1;
  let currentPopup = null;

  const API_URL = "/apis/afdian.blog.zyx-2012.cn/v1alpha1/afdianplans?page=1&size=100";

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function showToast(message, type) {
    let toast = document.querySelector(".afdian-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "afdian-toast";
      document.body.appendChild(toast);
    }

    toast.className = "afdian-toast";
    if (type) {
      toast.classList.add("afdian-toast--" + type);
    }
    toast.textContent = message;
    toast.classList.add("afdian-toast--show");

    window.clearTimeout(toast.__timer);
    toast.__timer = window.setTimeout(() => {
      toast.classList.remove("afdian-toast--show");
    }, 2200);
  }

  function normalizePlans(payload) {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.data)
      ? payload.data
      : [];

    return list
      .map((item) => (item && item.spec ? { ...item.spec, __raw: item } : null))
      .filter(Boolean)
      .filter((item) => item.visible !== false)
      .sort((a, b) => {
        const sa = Number.isFinite(Number(a.sort)) ? Number(a.sort) : 999999;
        const sb = Number.isFinite(Number(b.sort)) ? Number(b.sort) : 999999;
        return sa - sb;
      });
  }

  function renderPlanGrid(plans) {
    const grid = document.getElementById("afdian-plan-grid");
    if (!grid) return;

    if (!plans.length) {
      grid.innerHTML = `
        <div class="afdian-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <p>暂无发电方案</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = plans
      .map((plan) => {
        const name = escapeHtml(plan.name || "未命名方案");
        const price = escapeHtml(plan.price || plan.showPrice || "0");
        const desc = escapeHtml(plan.description || "");
        const planId = escapeHtml(plan.planId || "");
        const productType = escapeHtml(plan.productType || "");
        const month = Number(plan.payMonth || 1);

        return `
          <div class="afdian-plan-item"
               data-plan-id="${planId}"
               data-product-type="${productType}"
               data-pay-month="${month}"
               data-plan-name="${name}"
               data-plan-price="${price}"
               data-plan-desc="${desc}">
            <div class="afdian-plan-top">
              <span class="afdian-plan-name">${name}</span>
              <span class="afdian-plan-price">¥${price}</span>
            </div>
            <div class="afdian-plan-desc">${desc}</div>
            <span class="afdian-plan-action">查看详情 ></span>
          </div>
        `;
      })
      .join("");

    grid.querySelectorAll(".afdian-plan-item").forEach((item) => {
      item.addEventListener("click", function () {
        showAfdianModal({
          planId: this.dataset.planId || "",
          productType: this.dataset.productType || "",
          month: parseInt(this.dataset.payMonth || "1", 10) || 1,
          name: this.dataset.planName || "",
          price: this.dataset.planPrice || "0",
          desc: this.dataset.planDesc || "",
        });
      });
    });
  }

  async function loadAfdianPlans() {
    const grid = document.getElementById("afdian-plan-grid");
    if (!grid) return;

    grid.innerHTML = `
      <div class="afdian-loading">
        <div class="loading-spinner"></div>
        <p>正在加载发电方案...</p>
      </div>
    `;

    try {
      const resp = await fetch(API_URL, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const text = await resp.text();
      let payload = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch (e) {
        throw new Error("方案接口返回的不是合法 JSON");
      }

      if (!resp.ok) {
        throw new Error(
          (payload && (payload.message || payload.error)) ||
            `加载失败（HTTP ${resp.status}）`
        );
      }

      const plans = normalizePlans(payload);
      renderPlanGrid(plans);
    } catch (err) {
      console.error("[afdian] load plans failed:", err);
      grid.innerHTML = `
        <div class="afdian-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
          <p>发电方案加载失败</p>
        </div>
      `;
      showToast(err.message || "发电方案加载失败", "error");
    }
  }

  function setMonthActive(month) {
    document.querySelectorAll(".afdian-month-opt").forEach((el) => {
      const value = parseInt(el.dataset.month || "1", 10) || 1;
      el.classList.toggle("active", value === month);
    });
  }

  window.toggleAfdianPanel = function (id) {
    const panel = document.getElementById(id);
    if (!panel) return;

    const btn = document.querySelector(`[data-afdian-toggle="${id}"]`);
    const isOpen = panel.style.maxHeight && panel.style.maxHeight !== "0px";

    if (isOpen) {
      panel.style.maxHeight = "0";
      btn && btn.classList.remove("afdian-toggle-btn--open");
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
      btn && btn.classList.add("afdian-toggle-btn--open");
    }
  };

  window.showAfdianModal = function (plan) {
    currentAfdianPlan = plan;
    currentMonth = Number(plan.month || 1);

    const modal = document.getElementById("afdian-modal");
    if (!modal) return;

    const nameEl = modal.querySelector(".afdian-modal-name");
    const priceEl = modal.querySelector(".afdian-modal-price");
    const descEl = modal.querySelector(".afdian-modal-desc");

    if (nameEl) nameEl.textContent = plan.name || "";
    if (priceEl) priceEl.textContent = "¥" + (plan.price || "0");
    if (descEl) descEl.textContent = plan.desc || "";

    setMonthActive(currentMonth);
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  window.closeAfdianModal = function () {
    const modal = document.getElementById("afdian-modal");
    if (modal) {
      modal.classList.remove("active");
    }
    document.body.style.overflow = "";
  };

  window.selectAfdianMonth = function (month) {
    currentMonth = parseInt(String(month), 10) || 1;
    setMonthActive(currentMonth);
  };

  window.confirmAfdianOrder = function () {
    if (!currentAfdianPlan) {
      showToast("请先选择一个方案", "warn");
      return;
    }

    if (!window.__AFDIAN_FALLBACK_URL) {
      showToast("未配置爱发电链接", "error");
      return;
    }

    try {
      currentPopup = window.open(
        window.__AFDIAN_FALLBACK_URL,
        "afdian_pay_window",
        "width=720,height=860,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes"
      );

      if (!currentPopup) {
        showToast("弹窗被浏览器拦截，请允许弹窗后重试", "warn");
        return;
      }

      showToast("已打开支付窗口", "success");
      closeAfdianModal();
    } catch (err) {
      console.error("[afdian] open pay window failed:", err);
      showToast("打开支付窗口失败", "error");
    }
  };

  function bindModalKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const modal = document.getElementById("afdian-modal");
        if (modal && modal.classList.contains("active")) {
          closeAfdianModal();
        }
      }
    });
  }

  function resetCollapsePanels() {
    document.querySelectorAll(".afdian-collapse-panel").forEach((panel) => {
      panel.style.maxHeight = "0";
    });
    document.querySelectorAll(".afdian-toggle-btn--open").forEach((btn) => {
      btn.classList.remove("afdian-toggle-btn--open");
    });
  }

  function initAfdian() {
    if (!document.getElementById("afdian-plan-grid")) return;
    resetCollapsePanels();
    loadAfdianPlans();
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindModalKeyboard();
    initAfdian();
  });

  document.addEventListener("pjax:success", function () {
    initAfdian();
  });

  document.addEventListener("pjax:beforeReplace", function () {
    closeAfdianModal();
  });
})();
