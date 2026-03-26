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
    const wikipediaSummary = await fetchWikipediaSummary(selection);
    if (wikipediaSummary) {
      showPopup(e.pageX, e.pageY, selection, [wikipediaSummary]);
    } else {
      showPopup(e.pageX, e.pageY, selection, [
        {
          definition: "No definition found.",
          partOfSpeech: "",
          pronunciation: "",
        },
      ]);
    }
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

  const firstDef = definitions[0];
  const isWikipedia = firstDef?.source === 'Wikipedia';

  let content = `<strong>${word}</strong>`;
  if (!isWikipedia && firstDef?.sourceUrl) {
    content = `<strong><a href="${firstDef.sourceUrl}" target="_blank" rel="noopener noreferrer">${word}</a></strong>`;
  }

  definitions.forEach((def) => {
    if (isWikipedia) {
      content += `<br/><br/><span>${def.definition}</span>`;
    } else {
      const wordSearched = def.word ? `<strong>(${def.word})</strong> ` : "";
      content += `<br/><br/>${wordSearched}<em>${def.pronunciation || ""}</em> <span>${def.definition} <i>(${def.partOfSpeech || ""})</i></span>`;
    }
  });

  if (isWikipedia) {
    content += `<hr/><small>Summary from <a href="${firstDef.sourceUrl}" target="_blank" rel="noopener">Wikipedia</a></small>`;
  } else {
    content += '<hr/><small>Powered by <a href="https://freedictionaryapi.com" target="_blank" rel="noopener">FreeDictionaryAPI.com</a></small>';
  }

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

async function fetchWikipediaSummary(word) {
  const formattedWord = word.replace(/ /g, "_");
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedWord)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.type === 'disambiguation' || !data.extract) {
      return null;
    }
    return {
      definition: data.extract,
      source: 'Wikipedia',
      sourceUrl: data.content_urls.desktop.page
    };
  } catch (error) {
    return null;
  }
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}
