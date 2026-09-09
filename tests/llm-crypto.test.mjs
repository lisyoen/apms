import test from "node:test";
import assert from "node:assert/strict";
import { decryptApiKey, encryptApiKey } from "../src/lib/llm/crypto.mjs";
test("AES-256-GCM API key encryption round trip",()=>{const encrypted=encryptApiKey("sk-test-not-a-real-key","one-secret");assert.notEqual(encrypted,"sk-test-not-a-real-key");assert.equal(decryptApiKey(encrypted,"one-secret"),"sk-test-not-a-real-key")});
test("decryption with a different key fails authentication",()=>{const encrypted=encryptApiKey("private","right-secret");assert.throws(()=>decryptApiKey(encrypted,"wrong-secret"))});
