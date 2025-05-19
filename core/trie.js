// Build a trie from an array of morph objects.
// Each node contains an 'ismorph' flag and a 'children' object.
// Only the morph structure is stored, not POS tags.
export function buildMorphTrie(morphs) {
  const root = {};
  for (let i = 0; i < morphs.length; i++) {
    const morph = morphs[i].morph;
    let node = root;
    for (let j = 0; j < morph.length; j++) {
      const ch = morph[j];
      // Create a new node if it doesn't exist
      if (!node[ch]) node[ch] = { ismorph: false, children: {} };
      // Mark the end of a morph
      if (j === morph.length - 1) node[ch].ismorph = true;
      node = node[ch].children;
    }
  }
  return root;
}

// Find all morphs in the trie that start at position 'start' in 'text'.
// Returns an array of objects: { morph, end } where 'end' is the index after the morph.
export function findMorphsFromTrie(trie, text, start) {
  const found = [];
  let node = trie;
  let idx = start;
  // Traverse the trie as long as the next character exists in children
  while (idx < text.length && node[text[idx]]) {
    node = node[text[idx]];
    // If this node marks the end of a morph, record it
    if (node.ismorph) {
      found.push({ morph: text.slice(start, idx + 1), end: idx + 1 });
    }
    node = node.children;
    idx++;
  }
  return found;
}