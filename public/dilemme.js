(() => {
  const root = document.querySelector("[data-choice-root]");
  const outcomes = document.querySelector(".outcomes");
  if (!root || !outcomes) return;
  // Amélioration progressive : sans JavaScript, les quatre issues restent lisibles.
  const relevant = { share: ["share-share", "share-steal"], steal: ["steal-share", "steal-steal"] };
  root.hidden = false;
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pick]");
    if (!button) return;
    const keys = relevant[button.dataset.pick] || [];
    outcomes.classList.add("has-pick");
    outcomes.querySelectorAll(".outcome").forEach((item) => item.classList.toggle("is-relevant", keys.includes(item.dataset.outcome)));
    root.querySelectorAll("[data-pick]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  });
})();
