"use strict";

(function () {
  const status = document.getElementById("status");
  if (typeof Catalog === "undefined" || typeof FinderView === "undefined") {
    status.textContent = "The page scripts did not load.";
    return;
  }
  Promise.all([
    fetch("data/concerts.json"),
    fetch("data/musicians.json"),
  ]).then(async ([concertsRes, musiciansRes]) => {
    if (!concertsRes.ok || !musiciansRes.ok) throw new Error("fetch failed");
    const concerts = await concertsRes.json();
    const musicians = await musiciansRes.json();
    FinderView.mount(document, {
      concerts,
      musicians,
      themeTarget: document.documentElement,
      persistTheme: true,
    });
  }).catch(() => {
    status.textContent = "Could not load the concert data. Serve this folder with a local web server so the JSON can be read.";
  });
})();
