import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const publicDir = new URL("../public/", import.meta.url);
const read = (name) => readFileSync(new URL(name, publicDir), "utf8");
const pages = readdirSync(publicDir).filter((name) => name.endsWith(".html"));

test("every local script and stylesheet referenced by a public page exists", () => {
  for (const page of pages) {
    const refs = [...read(page).matchAll(/(?:href|src)="\/([^"?#{]+\.(?:css|js))(?:\?[^"]*)?"/g)].map((match) => match[1]);
    assert.ok(refs.length > 0, page + " references at least one asset");
    for (const ref of refs) assert.ok(existsSync(new URL(ref, publicDir)), page + " references a missing file: " + ref);
  }
});

test("the game page loads the motion layer before the game script and its stylesheet after the base styles", () => {
  const html = read("index.html");
  assert.ok(html.indexOf("/motion.js") > -1 && html.indexOf("/motion.js") < html.indexOf("/app.js"));
  assert.ok(html.indexOf("/motion.css") > html.indexOf("/animations.css"));
});

test("the motion layer never breaks the game and respects reduced motion", () => {
  const script = read("motion.js");
  const styles = read("motion.css");
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /catch \(error\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
