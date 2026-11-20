
/**
 * Fruits & Harvest
 * motionsports.de – Verfügbare Produkte zuerst
 * Version 1.0
 *
 * Nur für Collections mit Standardsortierung.
 * Lädt maximal 5 Seiten mit jeweils bis zu 50 Produkten.
 */

(() => {
  "use strict";

  const MAX_PAGES = 5;
  const GRID_SELECTOR = ".products-collection-grid";
  const SECTION_SELECTOR = ".section-main-collection-grid, .shopify-section";

  let currentRun = 0;

  function isDefaultSort() {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get("sort_by");

    // Explizite Kundensortierungen nicht verändern.
    return !sort || sort === "manual";
  }

  function getGrid(root = document) {
    return root.querySelector(GRID_SELECTOR);
  }

  function getNextUrl(root) {
    const link = root.querySelector(
      "pagination-load-more a[href]"
    );
    return link ? link.href : null;
  }

  function getAvailability(card) {
    return card.dataset.msAvailable === "true";
  }

  function sortCards(cards) {
    const available = [];
    const unavailable = [];

    cards.forEach(card => {
      if (getAvailability(card)) {
        available.push(card);
      } else {
        unavailable.push(card);
      }
    });

    return [...available, ...unavailable];
  }

  async function fetchPage(url) {
    const response = await fetch(url, {
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error(
        `Collection-Seite konnte nicht geladen werden: ${response.status}`
      );
    }

    const html = await response.text();

    return new DOMParser().parseFromString(
      html,
      "text/html"
    );
  }

  async function initialize() {
    const run = ++currentRun;

    if (!isDefaultSort()) return;

    const grid = getGrid();
    if (!grid || grid.dataset.msSorted === "true") return;

    const originalCards = Array.from(grid.children);

    // Nur starten, wenn die Karten bereits markiert sind.
    if (
      !originalCards.length ||
      !originalCards.every(card =>
        card.hasAttribute("data-ms-available")
      )
    ) {
      return;
    }

    const allCards = [...originalCards];
    let nextUrl = getNextUrl(document);
    let pages = 1;

    grid.dataset.msSorting = "true";

    try {
      while (nextUrl && pages < MAX_PAGES) {
        const page = await fetchPage(nextUrl);

        if (run !== currentRun) return;

        const nextGrid = getGrid(page);
        if (!nextGrid) break;

        const cards = Array.from(nextGrid.children);

        if (
          !cards.every(card =>
            card.hasAttribute("data-ms-available")
          )
        ) {
          throw new Error(
            "Produktkarten besitzen keine Verfügbarkeitskennzeichnung."
          );
        }

        allCards.push(...cards);

        nextUrl = getNextUrl(page);
        pages++;
      }

      // Nicht unvollständig global sortieren.
      if (nextUrl) {
        throw new Error(
          "Collection umfasst mehr als die unterstützten Seiten."
        );
      }

      if (run !== currentRun) return;

      const sorted = sortCards(allCards);

      grid.replaceChildren(...sorted);
      grid.dataset.msSorted = "true";

      // Pagination entfernen, da alle Karten vorhanden sind.
      const section = grid.closest(".shopify-section");
      section
        ?.querySelectorAll("pagination-load-more")
        .forEach(element => element.remove());

      console.info(
        `[Fruits & Harvest] ${sorted.length} Produkte nach Verfügbarkeit sortiert.`
      );

    } catch (error) {
      console.error(
        "[Fruits & Harvest] Verfügbarkeitssortierung:",
        error
      );
    } finally {
      delete grid.dataset.msSorting;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
