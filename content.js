let popup;

document.addEventListener("mouseup", async (e) => {
  const selection = window.getSelection().toString().trim();
  if (!selection) {
    removePopup();
    return;
  }

  const url = `https://freedictionaryapi.com/api/v1/entries/en/${selection}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Not found");
    const data = await response.json();

    const entry = data.entries?.[0];
    const partOfSpeech = entry?.partOfSpeech || "unknown";
    const definition = entry?.senses?.[0]?.definition || "No definition found.";
    const pronunciation = entry?.pronunciations?.[0]?.text || "";

    showPopup(e.pageX, e.pageY, selection, pronunciation, definition, partOfSpeech);
  } catch {
    showPopup(e.pageX, e.pageY, selection, "", "Definition not found.", "");
  }
});

document.addEventListener("click", (e) => {
  if (popup && !popup.contains(e.target)) {
    removePopup();
  }
});

function showPopup(x, y, word, phonetic, definition, pos) {
  removePopup();

  popup = document.createElement("div");
  popup.className = "dictionary-popup";
  popup.innerHTML = `
    <strong>${word}</strong> <em>${phonetic}</em><br/>
    <span>${definition} <i>(${pos})</i></span>
  `;
  popup.style.top = `${y + 10}px`;
  popup.style.left = `${x + 10}px`;
  document.body.appendChild(popup);
}

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}
