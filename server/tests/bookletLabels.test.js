const { test } = require("node:test");
const assert = require("node:assert/strict");
const { labelChanges, DESCRIPTION } = require("../scripts/refreshBookletLabels");

test("cleanup changes only imported default labels and is idempotent", () => {
  const imported = { sourceBatchId: "branch:networks:0:01", title: "GATE PYQs - TARGATE Set 01",
    description: "Subject practice: 1 mark per question, no negative marking. Source: TARGATE EDUCATION." };
  const changes = labelChanges(imported);
  assert.deepEqual(changes, { title: "GATE PYQs - Set 01", description: DESCRIPTION });
  assert.deepEqual(labelChanges({ ...imported, ...changes }), {});
  assert.deepEqual(labelChanges({ ...imported, sourceBatchId: undefined }), {});
  assert.deepEqual(labelChanges({ ...imported, title: "Custom set", description: "Custom attribution" }), {});
});
