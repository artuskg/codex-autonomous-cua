export const inventoryMarker = "AUTONOMOUS_CUA_INVENTORY:";

export function parseInventoryResult(texts) {
  const results = texts.flatMap((text) =>
    text.split(/\r?\n/).filter((line) => line.startsWith(inventoryMarker)),
  );
  if (results.length !== 1) return null;
  try {
    const state = JSON.parse(results[0].slice(inventoryMarker.length));
    return state?.apps === true && state?.browsers === true ? state : null;
  } catch {
    return null;
  }
}
