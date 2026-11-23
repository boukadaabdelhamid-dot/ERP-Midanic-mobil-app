import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ENGLISH_TRANSLATIONS } from "../lib/english-translations.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app", "components", "contexts", "hooks", "lib"];

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".expo") {
        files.push(...collectSourceFiles(fullPath));
      }
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function literalText(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

test("English translations cover static t() and localizedText() phrases", () => {
  const missing = [];
  for (const root of sourceRoots) {
    for (const filePath of collectSourceFiles(path.join(appRoot, root))) {
      const text = readFileSync(filePath, "utf8");
      const source = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      walk(source, (node) => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
        const name = node.expression.text;
        const firstPhrase = name === "localizedText" ? literalText(node.arguments[1]) : name === "t" ? literalText(node.arguments[0]) : null;
        if (firstPhrase && !(firstPhrase in ENGLISH_TRANSLATIONS)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          missing.push(`${path.relative(appRoot, filePath)}:${line + 1}: ${firstPhrase}`);
        }
        if (name === "t" && node.arguments[0] && ts.isTemplateExpression(node.arguments[0]) && node.arguments.length < 3) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          missing.push(`${path.relative(appRoot, filePath)}:${line + 1}: dynamic phrase is missing its English text`);
        }
      });
    }
  }
  assert.deepEqual(missing, []);
});

test("English translations include key flows and non-empty labels", () => {
  assert.equal(ENGLISH_TRANSLATIONS["Langue de l'interface"], "Interface language");
  assert.equal(ENGLISH_TRANSLATIONS["Nouveau paiement fournisseur"], "New supplier payment");
  assert.equal(ENGLISH_TRANSLATIONS["Rembourser le client"], "Refund the customer");
  assert.equal(ENGLISH_TRANSLATIONS["Évolution mensuelle — CA vs bénéfice"], "Monthly trend — revenue vs. profit");
  assert.ok(Object.entries(ENGLISH_TRANSLATIONS).every(([source, translated]) => source.length > 0 && translated.trim().length > 0));
});
