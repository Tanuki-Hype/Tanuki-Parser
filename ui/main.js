import { buildMorphTrie, findMorphsFromTrie } from '../core/trie.js';
import { buildPosMap, viterbiSegment } from '../core/viterbi.js';

// Load dictionary JSON from file
async function loadDictionary(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Failed to load dictionary");
  return await response.json();
}

let dict, trie, posMap, transitionMap, recombinationMap;
let userMorphSet = new Set();

// Load user.json and build userMorphSet
async function loadUserMorphs(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Failed to load user morphs");
  const userData = await response.json();
  userMorphSet = new Set(
    (userData.morphs || []).map(m => `${m.morph}|${m.pos}`)
  );
}
loadUserMorphs('/user/user.json').catch(err => {
  // TODO: handle user morph load error
});

loadDictionary('/dict/jp.json').then(data => {
  dict = data;
  trie = buildMorphTrie(dict.morphs);
  posMap = buildPosMap(dict.morphs);
  transitionMap = dict.transitions;
  recombinationMap = dict.recombination;
}).catch(err => {
  document.getElementById('output').textContent = "Dictionary load error: " + err;
});

document.getElementById('segmentBtn').onclick = function() {
  if (!dict) {
    document.getElementById('output').textContent = "Dictionary not loaded";
    document.getElementById('visualOutput').textContent = "";
    return;
  }
  const text = document.getElementById('textInput').value;
  const words = viterbiSegment(text, trie, posMap, transitionMap, findMorphsFromTrie, recombinationMap);
  document.getElementById('output').textContent = JSON.stringify({ words: words }, null, 2);

  renderVisual(words);

  // Attach click handler for toggling user morphs (first token only)
  const visualDiv = document.getElementById('visualOutput'); // TODO: Why are we reattaching this every time?
  visualDiv.onclick = function(e) {
    const target = e.target;
    if (target.classList.contains('visual-word')) {
      const morphKey = target.getAttribute('data-morph-key');
      if (!morphKey) return;
      if (userMorphSet.has(morphKey)) {
        userMorphSet.delete(morphKey);
      } else {
        userMorphSet.add(morphKey);
      }
      renderVisual(words);
    }
  };
};

// Render visual output: underline each word as a unit (all tokens in a word)
// Only the first token in a word is used for color and user set toggling
function renderVisual(words) {
  const visualDiv = document.getElementById('visualOutput');
  const visualHtml = words.map(wordObj => {
    // If the word is a single whitespace token, render as-is (no span)
    if (
      wordObj.tokens[0].type === "whitespace" ||
      wordObj.tokens[0].type === "skipped"
    ) {
      return escapeHtml(wordObj.tokens[0].morph);
    }

    // Use only the first token for user set logic
    const firstTok = wordObj.tokens[0];
    const morphKey = `${firstTok.morph}|${firstTok.pos}`;
    const inUser = userMorphSet.has(morphKey);
    const underlineColor = inUser ? '#B7CECE40' : '#ff4673';
    const wordText = wordObj.tokens.map(tok => escapeHtml(tok.morph)).join('');
    return `<span class="visual-word" data-morph-key="${morphKey}" style="text-decoration-color: ${underlineColor}; cursor:pointer;">${wordText}</span>`;
  }).join('');
  visualDiv.innerHTML = visualHtml;
}

// Helper to escape HTML special characters
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}