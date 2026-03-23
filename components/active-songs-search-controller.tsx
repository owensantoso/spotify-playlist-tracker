"use client";

import { useEffect, useRef } from "react";

export function ActiveSongsSearchController() {
  const initializedRef = useRef(false);

  useEffect(() => {
    const input = document.getElementById("active-search-input");
    const empty = document.getElementById("active-song-empty");
    const tbody = document.getElementById("active-song-body");

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const inputElement = input;

    function filterRows() {
      const rows = Array.from(document.querySelectorAll("[data-song-row]"));
      const query = inputElement.value.trim().toLowerCase();
      let visibleCount = 0;

      rows.forEach((row) => {
        if (!(row instanceof HTMLElement)) {
          return;
        }

        const haystack = row.dataset.search ?? "";
        const visible = !query || haystack.includes(query);
        row.style.display = visible ? "" : "none";
        if (visible) {
          visibleCount += 1;
        }
      });

      if (empty instanceof HTMLElement) {
        empty.style.display = visibleCount === 0 ? "" : "none";
      }

      if (tbody instanceof HTMLElement) {
        tbody.style.display = visibleCount === 0 ? "none" : "";
      }
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      filterRows();
    }

    inputElement.addEventListener("input", filterRows);
    return () => {
      inputElement.removeEventListener("input", filterRows);
    };
  }, []);

  return null;
}
