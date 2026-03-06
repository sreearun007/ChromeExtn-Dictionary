let popup;

document.addEventListener("mouseup", async (e) => {
  const selection = window.getSelection().toString().trim();
  if (!selection) {
    removePopup();
    return;
  }

  const initialVariations = new Set([
    selection,
    selection.toLowerCase(),
    selection.charAt(0).toUpperCase() + selection.slice(1).toLowerCase(),
  ]);

  const allDefinitions = new Map();
  let wordsToFetch = new Set(initialVariations);

  while (wordsToFetch.size > 0) {
    const currentDefinitions = await fetchDefinitions(wordsToFetch);
    wordsToFetch.clear();

    for (const def of currentDefinitions) {
      if (!allDefinitions.has(def.definition)) {
        allDefinitions.set(def.definition, def);

        const pluralOfMatch = def.definition.match(/plural of ([a-zA-Z]+)/i);
        if (pluralOfMatch && pluralOfMatch[1]) {
          const baseWord = pluralOfMatch[1];
          if (!initialVariations.has(baseWord) && !wordsToFetch.has(baseWord)) {
            wordsToFetch.add(baseWord);
          }
        }
      }
    }
  }

  const definitionsArray = Array.from(allDefinitions.values());

  if (definitionsArray.length > 0) {
    showPopup(e.pageX, e.pageY, selection, definitionsArray);
  } else {
    showPopup(e.pageX, e.pageY, selection, [
      {
        definition: "No definition found.",
        partOfSpeech: "",
        pronunciation: "",
      },
    ]);
  }
});

async function fetchDefinitions(variations) {
  const variationArray = Array.from(variations);
  const requests = variationArray.map((word) =>
    fetch(`https://freedictionaryapi.com/api/v1/entries/en/${word}`).then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
  );

  const results = await Promise.allSettled(requests);
  const uniqueDefinitions = new Map();

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      const word = variationArray[index];
      const data = result.value;
      const sourceUrl = data.source?.url || "";
      const entries = data.entries || [];
      
      for (const entry of entries) {
        const definitionText = entry.senses?.[0]?.definition;
        if (definitionText && !uniqueDefinitions.has(definitionText)) {
          uniqueDefinitions.set(definitionText, {
            word: word,
            definition: definitionText,
            partOfSpeech: entry.partOfSpeech || "unknown",
            pronunciation: entry.pronunciations?.[0]?.text || "",
            sourceUrl: sourceUrl
          });
        }
      }
    }
  });

  return Array.from(uniqueDefinitions.values());
}

document.addEventListener("click", (e) => {
  if (popup && !popup.contains(e.target)) {
    removePopup();
  }
});

function showPopup(x, y, word, definitions) {
  removePopup();

  popup = document.createElement("div");
  popup.className = "dictionary-popup";

  const firstSourceUrl = definitions[0]?.sourceUrl;
  let content = firstSourceUrl && firstSourceUrl !== "" 
    ? `<strong><a href="${firstSourceUrl}" target="_blank" rel="noopener noreferrer">${word}</a></strong>`
    : `<strong>${word}</strong>`;

  definitions.forEach((def) => {
    const wordSearched = def.word ? `<strong>(${def.word})</strong> ` : "";
    content += `<br/><br/>${wordSearched}<em>${def.pronunciation || ""}</em> <span>${def.definition} <i>(${def.partOfSpeech || ""})</i></span>`;
  });

  content += '<hr/><small>Powered by <a href="https://freedictionaryapi.com" target="_blank" rel="noopener">FreeDictionaryAPI.com</a></small>';

  popup.innerHTML = content;

  // Temporarily add to DOM to measure dimensions
  popup.style.visibility = "hidden";
  document.body.appendChild(popup);
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;

  // Calculate position
  let top = y + 10;
  let left = x + 10;

  if (left + popupWidth > window.innerWidth) {
    left = x - popupWidth - 10;
  }

  if (top + popupHeight > window.innerHeight) {
    top = y - popupHeight - 10;
  }

  if (top < 0) {
    top = 10;
  }
  if (left < 0) {
    left = 10;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  // Make it visible
  popup.style.visibility = "visible";
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}
