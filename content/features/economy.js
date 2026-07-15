/* ========================================================= */
/* ============ VERTEX POINTS (V07 ECONOMY) ================ */
/* ========================================================= */
/* Free earn-only currency for Vortex07 users. Balance lives
   on the Vortex07 API (economy:{userId}); this module renders
   the coin + balance in the header (left of search) and lets
   the user claim their daily VP bonus by clicking the wallet. */

const VERTEX_WALLET_CACHE_KEY = "vortex07VertexWallet";
const VERTEX_WALLET_REFRESH_MS = 60000;
const VERTEX_COIN_ASSET = "assets/VertexCoin-64.png";

let vertexWalletState = null;
let vertexWalletUserId = null;
let vertexWalletFetchAt = 0;
let vertexWalletFetchInFlight = null;
let vertexWalletCacheLoaded = false;
let vertexDailyClaimInFlight = false;

function logEconomy(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][VP]", ...args);
}

function isVertexPointsEnabled() {
  return Boolean(
    currentSettings.enabled && currentSettings.showVertexPoints !== false,
  );
}

function getVertexWalletUserId() {
  const navId =
    typeof getLoggedInUserIdFromNav === "function"
      ? getLoggedInUserIdFromNav()
      : null;
  return safeNumber(navId ?? cachedSessionUser?.id);
}

function formatVertexAmount(amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

function removeVertexWallet() {
  document.getElementById("vortex07-vertex-wallet")?.remove();
}

function buildVertexWalletEl() {
  const wallet = document.createElement("button");
  wallet.type = "button";
  wallet.id = "vortex07-vertex-wallet";
  wallet.className = "vortex07-vertex-wallet";
  wallet.title = "Vertex Points — Vortex07 currency";

  const coin = document.createElement("img");
  coin.className = "vortex07-vertex-coin";
  coin.alt = "Vertex Points";
  coin.src = extensionAssetUrl(VERTEX_COIN_ASSET);

  const amount = document.createElement("span");
  amount.className = "vortex07-vertex-amount";
  amount.textContent = "—";

  wallet.appendChild(coin);
  wallet.appendChild(amount);

  wallet.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void claimVertexDaily();
  });

  return wallet;
}

function renderVertexWallet() {
  const wallet = document.getElementById("vortex07-vertex-wallet");
  if (!wallet) return;

  const amountEl = wallet.querySelector(".vortex07-vertex-amount");
  const state = vertexWalletState;

  if (!state) {
    if (amountEl) amountEl.textContent = "—";
    wallet.title = "Vertex Points — Vortex07 currency";
    wallet.classList.remove("vortex07-vertex-claimable");
    return;
  }

  if (amountEl) amountEl.textContent = formatVertexAmount(state.balance);

  const claimable = Boolean(state.canClaimDaily);
  wallet.classList.toggle("vortex07-vertex-claimable", claimable);

  if (claimable) {
    wallet.title = `Vertex Points: ${state.balance} VP — daily bonus ready! Click the coin to claim +${state.nextDailyReward} VP.`;
  } else {
    const streakNote = state.streak > 1 ? ` Streak: ${state.streak} days.` : "";
    wallet.title = `Vertex Points: ${state.balance} VP — daily bonus claimed, come back tomorrow.${streakNote}`;
  }
}

function showVertexBurst(text) {
  const wallet = document.getElementById("vortex07-vertex-wallet");
  if (!wallet) return;

  wallet.querySelector(".vortex07-vertex-burst")?.remove();

  const burst = document.createElement("span");
  burst.className = "vortex07-vertex-burst";
  burst.textContent = text;
  wallet.appendChild(burst);

  setTimeout(() => burst.remove(), 1600);
}

async function loadCachedVertexWallet(userId) {
  if (vertexWalletCacheLoaded) return;
  vertexWalletCacheLoaded = true;

  const data = await storageGet("local", { [VERTEX_WALLET_CACHE_KEY]: null });
  const cached = data[VERTEX_WALLET_CACHE_KEY];
  if (!cached || safeNumber(cached.userId) !== userId) return;
  if (vertexWalletState) return;

  vertexWalletState = cached.wallet || null;
  renderVertexWallet();
}

async function saveVertexWalletCache(userId, wallet) {
  await storageSet("local", {
    [VERTEX_WALLET_CACHE_KEY]: { userId, wallet, savedAt: Date.now() },
  });
}

async function refreshVertexWallet(userId, options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();

  if (!force && now - vertexWalletFetchAt < VERTEX_WALLET_REFRESH_MS) return;
  if (!force && shouldSkipNonEssentialPolling()) return;
  if (vertexWalletFetchInFlight) return vertexWalletFetchInFlight;

  vertexWalletFetchAt = now;
  vertexWalletFetchInFlight = (async () => {
    try {
      const voterId = await ensureVoterId();
      const url = `${VORTEX07_API_BASE}/economy?userId=${userId}&voterId=${encodeURIComponent(voterId)}`;
      const response = await fetchReputationRequest(url, { method: "GET" });
      if (!response.ok) {
        logEconomy("Wallet fetch failed:", response.status);
        return;
      }

      const data = await response.json();
      if (getVertexWalletUserId() !== userId) return;

      vertexWalletState = data;
      renderVertexWallet();
      await saveVertexWalletCache(userId, data);
      logEconomy("Wallet loaded:", data);
    } catch (err) {
      logEconomy("Wallet fetch error:", err);
    } finally {
      vertexWalletFetchInFlight = null;
    }
  })();

  return vertexWalletFetchInFlight;
}

async function claimVertexDaily() {
  if (vertexDailyClaimInFlight) return;

  const userId = getVertexWalletUserId();
  if (userId === null) return;

  if (vertexWalletState && !vertexWalletState.canClaimDaily) {
    showVertexBurst("Tomorrow!");
    return;
  }

  vertexDailyClaimInFlight = true;
  try {
    const voterId = await ensureVoterId();
    const response = await fetchReputationRequest(
      `${VORTEX07_API_BASE}/economy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "daily",
          userId: String(userId),
          actorUserId: String(userId),
          voterId,
        }),
      },
    );

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      logEconomy("Daily claim failed:", response.status, data);
      showVertexBurst("Try later");
      return;
    }

    vertexWalletState = data;
    renderVertexWallet();
    await saveVertexWalletCache(userId, data);

    if (data.ok && data.reward) {
      showVertexBurst(`+${data.reward} VP`);
      logEconomy("Daily claimed:", data.reward, "streak", data.streak);
    } else {
      showVertexBurst("Tomorrow!");
    }
  } catch (err) {
    logEconomy("Daily claim error:", err);
    showVertexBurst("Try later");
  } finally {
    vertexDailyClaimInFlight = false;
  }
}

function ensureVertexWallet() {
  if (!isVertexPointsEnabled()) {
    removeVertexWallet();
    return;
  }

  const anchor =
    document.getElementById("Alerts") ||
    document.getElementById("vortex07-search-slot");
  if (!anchor) return;

  const userId = getVertexWalletUserId();
  if (userId === null) {
    removeVertexWallet();
    return;
  }

  let wallet = document.getElementById("vortex07-vertex-wallet");
  if (!wallet) {
    wallet = buildVertexWalletEl();
    logEconomy("Vertex wallet injected");
  }

  // Keep the coin immediately left of the search box.
  const searchHost = anchor.querySelector(
    ".vortex07-search-host, #vortex07-search-form, #search-form, .navbar-search",
  );
  if (searchHost && searchHost.parentNode === anchor) {
    if (wallet.parentNode !== anchor || wallet.nextElementSibling !== searchHost) {
      anchor.insertBefore(wallet, searchHost);
    }
  } else if (wallet.parentNode !== anchor) {
    anchor.appendChild(wallet);
  }

  if (vertexWalletUserId !== userId) {
    vertexWalletUserId = userId;
    vertexWalletState = null;
    vertexWalletFetchAt = 0;
    vertexWalletCacheLoaded = false;
  }

  renderVertexWallet();
  void loadCachedVertexWallet(userId);
  void refreshVertexWallet(userId);
}
