// Background Service Worker
// Native alert suppression is now handled by inject.js in the MAIN world
// and CSP removal is handled by declarativeNetRequest rules.

chrome.runtime.onInstalled.addListener(() => {
  console.log("AUTOQECFILL installed");
});

// Keep the service worker alive if needed for future logic
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.automationState) {
    const state = changes.automationState.newValue;
    console.log("Automation state changed:", state);
  }
});
