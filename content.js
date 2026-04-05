let popup;

document.addEventListener("mouseup", async (e) => {
  const selection = window.getSelection().toString().trim();
  if (!selection || selection.split(' ').length > 5) {
    removePopup();
    return;
  }

  const [dictionaryResults, wikipediaResult] = await Promise.all([
    fetchDictionaryDefinitions(selection),
    fetchWikipediaSummary(selection),
  ]);

  const results = {};
  if (dictionaryResults.length > 0) {
    results.dictionary = dictionaryResults;
  }
  if (wikipediaResult) {
    results.wikipedia = [wikipediaResult];
  }

  if (Object.keys(results).length > 0) {
    showPopup(e.pageX, e.pageY, selection, results);
  } else {
    showPopup(e.pageX, e.pageY, selection, {
      fallback: [{
        definition: "No definition found.",
        partOfSpeech: "",
        pronunciation: "",
      }],
    });
  }
});

async function fetchDictionaryDefinitions(selection) {
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
  return Array.from(allDefinitions.values());
}

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

function showPopup(x, y, word, results) {
  removePopup();

  popup = document.createElement("div");
  popup.className = "dictionary-popup";
  popup.addEventListener('mouseup', (e) => {
    if (e.target.classList.contains('dict-tab-button')) {
      e.stopPropagation();
    }
  });

  const hasDictionary = results.dictionary && results.dictionary.length > 0;
  const hasWikipedia = results.wikipedia && results.wikipedia.length > 0;

  let content = `<strong>${word}</strong>`;
  let tabs = '';
  let tabContents = '';

  if (hasDictionary && hasWikipedia) {
    tabs = `
      <div class="dict-tabs">
        <button class="dict-tab-button active" data-tab="dictionary">Dictionary</button>
        <button class="dict-tab-button" data-tab="wikipedia">Wikipedia</button>
      </div>
    `;
  }

  if (hasDictionary) {
    const dictionaryContent = results.dictionary.map(def => {
      const wordSearched = def.word ? `<strong>(${def.word})</strong> ` : "";
      return `<br/><br/>${wordSearched}<em>${def.pronunciation || ""}</em> <span>${def.definition} <i>(${def.partOfSpeech || ""})</i></span>`;
    }).join('');
    tabContents += `<div class="dict-tab-content active" data-tab-content="dictionary">${dictionaryContent}</div>`;
  }

  if (hasWikipedia) {
    const wikipediaContent = results.wikipedia.map(def => `<br/><br/><span>${def.definition}</span>`).join('');
    const wikipediaActiveClass = hasDictionary ? '' : ' active';
    tabContents += `<div class="dict-tab-content${wikipediaActiveClass}" data-tab-content="wikipedia">${wikipediaContent}</div>`;
  }

  if (results.fallback) {
    content += `<br/><br/><span>${results.fallback[0].definition}</span>`;
  }

  let attribution = '<hr/><small>';
  if (hasDictionary) {
    attribution += 'Powered by <a href="https://freedictionaryapi.com" target="_blank" rel="noopener">FreeDictionaryAPI.com</a>';
  }
  if (hasDictionary && hasWikipedia) {
    attribution += ' & ';
  }
  if (hasWikipedia) {
    attribution += 'Summary from <a href="' + results.wikipedia[0].sourceUrl + '" target="_blank" rel="noopener">Wikipedia</a>';
  }
  attribution += '</small>';

  popup.innerHTML = content + tabs + tabContents + attribution;

  if (hasDictionary && hasWikipedia) {
    const tabButtons = popup.querySelectorAll('.dict-tab-button');
    const tabContentsElements = popup.querySelectorAll('.dict-tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        tabContentsElements.forEach(content => {
          if (content.dataset.tabContent === button.dataset.tab) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
  }

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
