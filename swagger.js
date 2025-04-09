document.title = "Wibitech Tasks API Docs";
const favIcons = document.querySelectorAll("link[rel~='icon']");
favIcons.forEach((link) => {
  if (link.href.includes("favicon")) {
    link.href =
      "https://cdn.jsdelivr.net/gh/Ouasl/tasks-backend@master/img/favicon.png";
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const getTopBar = () => {
    return document.querySelector(".swagger-ui .topbar .topbar-wrapper");
  };
  let topBar = getTopBar();
  let interval;
  if (!topBar)
    interval = setInterval(() => {
      topBar = getTopBar();
      if (topBar) {
        clearInterval(interval);
        topBar.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/Ouasl/tasks-backend@master/img/wibitech-logo-w.svg" />`;
      }
    }, 50);
});
