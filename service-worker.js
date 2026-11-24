const CACHE_NAME = "siddhivinayak-stock-pwa-v68";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./icons/app-icon-v2.png",
  "./icons/siddhivinayak-premium.svg",
  "./icons/app-icon.png",
  "./backend/supabase-runtime.js?v=otf-print-sidebyside-20261124c",
  "./backend/price-list-module.js?v=department-filter-20261121a"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {