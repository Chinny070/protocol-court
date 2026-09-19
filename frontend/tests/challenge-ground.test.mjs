import test from "node:test";
import assert from "node:assert/strict";

const grounds = [
  "IGNORED_EVIDENCE",
  "WRONG_TEMPORAL_INTERPRETATION",
  "SOURCE_AUTHORITY_ERROR",
  "IMPLEMENTATION_CONTRADICTION",
];

function groundsForCase(hasCitablePrecedent) {
  return hasCitablePrecedent
    ? grounds
    : grounds.filter((ground) => ground !== "IMPLEMENTATION_CONTRADICTION");
}

test("does not offer implementation contradiction without a precedent", () => {
  assert.equal(groundsForCase(false).includes("IMPLEMENTATION_CONTRADICTION"), false);
});

test("offers implementation contradiction when a precedent exists", () => {
  assert.equal(groundsForCase(true).includes("IMPLEMENTATION_CONTRADICTION"), true);
});
