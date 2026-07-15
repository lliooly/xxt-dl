import assert from "node:assert/strict";
import test from "node:test";

import { CliInputError, parseCliOptions } from "../src/cli-options.js";

test("parseCliOptions accepts separate and inline values", () => {
  assert.deepEqual(
    parseCliOptions([
      "--out", "review-notes",
      "--limit=3",
      "--course", "高等数学",
      "--url", "https://i.chaoxing.com/",
      "--profile", ".profile-test",
    ]),
    {
      out: "review-notes",
      limit: 3,
      course: "高等数学",
      url: "https://i.chaoxing.com/",
      profile: ".profile-test",
    },
  );
});

test("parseCliOptions rejects invalid or missing limit values", () => {
  for (const args of [
    ["--limit", "0"],
    ["--limit", "-1"],
    ["--limit", "1.5"],
    ["--limit", "abc"],
    ["--limit"],
  ]) {
    assert.throws(
      () => parseCliOptions(args),
      (error: unknown) => error instanceof CliInputError && error.message.includes("--limit"),
    );
  }
});

test("parseCliOptions does not consume the next flag as a value", () => {
  assert.throws(
    () => parseCliOptions(["--out", "--limit", "3"]),
    (error: unknown) => error instanceof CliInputError && error.message.includes("--out"),
  );
});

test("parseCliOptions rejects unknown flags and positional arguments", () => {
  assert.throws(() => parseCliOptions(["--limt", "3"]), /未知参数.*--limt/);
  assert.throws(() => parseCliOptions(["unexpected"]), /未知参数.*unexpected/);
});
