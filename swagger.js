// public/swagger-custom.js
document.title = "Wibitech Tasks API Docs"; // Change the document title
const favIcons = document.querySelectorAll("link[rel~='icon']");
favIcons.forEach((link) => {
  if (link.href.includes("favicon")) {
    link.href =
      "https://cdn.jsdelivr.net/gh/Ouasl/tasks-backend@90a78f726821ee68433b73833e2cbd7a7453e366/img/favicon.png"; // Change the favicon
  }
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("Custom Swagger JS loaded!");
  // Example: Change topbar text
  const getTopBar = () => {
    return document.querySelector(".swagger-ui .topbar .topbar-wrapper");
  };
  console.log("topbar: ", getTopBar());
  let topBar = getTopBar();
  let interval;
  //   while (!topBar) topBar = getTopBar();
  if (!topBar)
    interval = setInterval(() => {
      topBar = getTopBar();
      console.log("topbar: ", topBar);
      if (topBar) {
        clearInterval(interval);
        topBar.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/Ouasl/tasks-backend@90a78f726821ee68433b73833e2cbd7a7453e366/img/wibitech-logo-w.svg" />`;
      }
    }, 50);
});
