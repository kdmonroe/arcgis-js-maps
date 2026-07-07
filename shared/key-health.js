/**
 * key-health.js - Non-fatal ArcGIS API key health check.
 *
 * Waits for the config loader to populate window.arcgisConfig, then validates
 * the key against the ArcGIS portal. If the key is rejected (498/499) or never
 * arrives, shows a dismissible warning banner so failures aren't silent blank
 * maps. Never blocks or delays map initialization.
 *
 * Include AFTER the config loader script:
 *   <script defer src="../shared/key-health.js"></script>   (demos/*.html)
 *   <script defer src="../../shared/key-health.js"></script> (demos/<app>/index.html)
 */
(function () {
  "use strict";

  var POLL_MS = 250;
  var MAX_WAIT_MS = 15000;
  var PORTAL_SELF_URL = "https://www.arcgis.com/sharing/rest/portals/self?f=json";

  function showBanner(message) {
    if (document.getElementById("arcgis-key-health-banner")) return;

    var banner = document.createElement("div");
    banner.id = "arcgis-key-health-banner";
    banner.setAttribute("role", "alert");
    banner.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:10000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "gap:12px",
      "padding:10px 44px 10px 16px",
      "background:#B45309",
      "color:#fff",
      "font-family:'Avenir Next','Helvetica Neue',Helvetica,Arial,sans-serif",
      "font-size:14px",
      "line-height:1.4",
      "box-shadow:0 2px 6px rgba(0,0,0,0.25)"
    ].join(";");

    var text = document.createElement("span");
    text.textContent = "⚠️ " + message;
    banner.appendChild(text);

    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss warning");
    close.textContent = "×";
    close.style.cssText = [
      "position:absolute",
      "right:10px",
      "top:50%",
      "transform:translateY(-50%)",
      "background:transparent",
      "border:none",
      "color:#fff",
      "font-size:20px",
      "cursor:pointer",
      "padding:0 6px"
    ].join(";");
    close.addEventListener("click", function () {
      banner.remove();
    });
    banner.appendChild(close);

    function attach() {
      document.body.appendChild(banner);
    }
    if (document.body) {
      attach();
    } else {
      document.addEventListener("DOMContentLoaded", attach);
    }
  }

  function validateKey(apiKey) {
    fetch(PORTAL_SELF_URL + "&token=" + encodeURIComponent(apiKey))
      .then(function (response) { return response.json(); })
      .then(function (json) {
        if (json && json.error && (json.error.code === 498 || json.error.code === 499)) {
          console.warn("[key-health] ArcGIS API key rejected:", json.error);
          showBanner(
            "ArcGIS API key is invalid or expired — basemaps and hosted layers may not load. " +
            "Rotate the key and update shared/config.js (local) / the ARCGIS_API_KEY secret (deploy)."
          );
        } else {
          console.info("[key-health] ArcGIS API key OK");
        }
      })
      .catch(function (err) {
        // Network hiccup or offline: not evidence of a bad key, stay quiet.
        console.warn("[key-health] key check skipped:", err);
      });
  }

  var waited = 0;
  var timer = setInterval(function () {
    var cfg = window.arcgisConfig;
    if (cfg && cfg.apiKey && cfg.apiKey !== "YOUR_API_KEY_HERE" && cfg.apiKey !== "YOUR_DEVELOPMENT_API_KEY") {
      clearInterval(timer);
      validateKey(cfg.apiKey);
      return;
    }
    waited += POLL_MS;
    if (waited >= MAX_WAIT_MS) {
      clearInterval(timer);
      console.warn("[key-health] no ArcGIS API key found after " + MAX_WAIT_MS + "ms");
      showBanner("ArcGIS API key not found — basemaps and hosted layers may not load. Check shared/config.js.");
    }
  }, POLL_MS);
})();
