import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { socket, socketURL } from "../src/services/socket.js";

test("admin socket singleton targets the backend and waits for explicit connect", () => {
  assert.equal(socketURL, "http://localhost:5000");
  assert.equal(socket.io.uri, socketURL);
  assert.equal(socket.connected, false);
  assert.equal(socket.io.opts.autoConnect, false);
  assert.deepEqual(socket.io.opts.transports, ["websocket", "polling"]);
});

test("AdminLayout connects the singleton and cleans up admin listeners", () => {
  const source = readFileSync(
    new URL("../src/layouts/AdminLayout.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ socket \} from "\.\.\/services\/socket";/);
  assert.match(source, /socket\.connect\(\);/);
  assert.match(source, /socket\.on\("admin:new-order", handleNewOrder\);/);
  assert.match(source, /socket\.on\("admin:new-review", handleNewReview\);/);
  assert.match(source, /console\.log\("\[admin socket\] received admin:new-order", payload\);/);
  assert.match(source, /console\.log\("\[admin socket\] received admin:new-review", payload\);/);
  assert.match(source, /orderCode: payload\.orderCode \|\| payload\.order\?\.orderCode \|\| "",/);
  assert.match(source, /socket\.off\("admin:new-order", handleNewOrder\);/);
  assert.match(source, /socket\.off\("admin:new-review", handleNewReview\);/);
});
