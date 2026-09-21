// Decision logic for scripts/auditEquippedFlair.js: an equipped value is valid only if some
// shop item of that slot's category carries that exact value.

function buildValidValueLookup(items) {
  const lookup = {};
  for (const { category, value } of items) {
    if (!lookup[category]) {
      lookup[category] = new Set();
    }
    lookup[category].add(value);
  }
  return lookup;
}

function findInvalidSlots(equippedFlair, lookup) {
  const invalid = [];
  for (const [slot, value] of Object.entries(equippedFlair || {})) {
    if (!value) {
      continue;
    }
    if (!lookup[slot] || !lookup[slot].has(value)) {
      invalid.push({ slot, value });
    }
  }
  return invalid;
}

module.exports = { buildValidValueLookup, findInvalidSlots };
