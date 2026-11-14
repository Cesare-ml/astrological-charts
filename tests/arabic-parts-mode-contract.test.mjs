import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function parse(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0, path + ': TypeScript parse errors');
  return { source, ast };
}

const options = parse('../src/lib/models/opzioni-grafico.model.ts');
const scene = parse('../src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts');
const planets = parse('../src/lib/renderers/moduli/elementi-celesti.renderer.ts');

function modeProperty() {
  const iface = options.ast.statements.find(stmt =>
    ts.isInterfaceDeclaration(stmt) && stmt.name.text === 'PartiArabeOptions');
  assert.ok(iface, 'PartiArabeOptions must be declared');
  const property = iface.members.find(member =>
    ts.isPropertySignature(member) && member.name?.getText(options.ast) === 'modalita');
  assert.ok(property?.type && ts.isUnionTypeNode(property.type), 'modalita must be a literal union');
  return property;
}

test('Arabic-parts mode accepts only the three runtime spellings', () => {
  const node = modeProperty();
  const choices = node.type.types.map(v => {
    assert.ok(ts.isLiteralTypeNode(v) && ts.isStringLiteral(v.literal));
    return v.literal.text;
  });
  assert.deepEqual(choices, ['essenziali', 'abumashar', 'crea']);
});

test('TypeScript type checker accepts abumashar and rejects the obsolete spaced spelling', () => {
  const node = modeProperty();
  const file = '/__synthetic_arabic_parts_typecheck__.ts';
  const content = [
    'type Mode = ' + node.type.getText(options.ast) + ';',
    "const accepted: Mode = 'abumashar';",
    "const rejected: Mode = 'abu mashar';",
  ].join('\n');
  const compilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(compilerOptions);
  const originalGet = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...args) =>
    name === file ? ts.createSourceFile(name, content, languageVersion, true) :
      originalGet(name, languageVersion, ...args);
  const program = ts.createProgram([file], compilerOptions, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(d => d.file?.fileName === file);
  assert.equal(errors.length, 1, errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
  assert.equal(errors[0].code, 2820); // TS 5.8 suggests the canonical 'abumashar' spelling
  assert.match(ts.flattenDiagnosticMessageText(errors[0].messageText, '\n'), /"abu mashar"/);
});

test('both actual render paths select the same canonical mode literal', () => {
  assert.match(scene.source, /opzioni\.partiArabe\.modalita\s*==\s*'abumashar'/);
  const renderReferences = planets.source.match(
    /opzioni\.partiArabe\.modalita\s*==\s*'abumashar'/g) ?? [];
  assert.equal(renderReferences.length, 2, 'both element rendering paths must agree');
  for (const { source } of [scene, planets]) {
    assert.doesNotMatch(source, /opzioni\.partiArabe\.modalita\s*==\s*'abu mashar'/);
  }
});

test('the default options remain unset, preserving the existing initial behavior', () => {
  assert.match(options.source, /partiArabe:\s*\{\s*modalita:\s*undefined/);
});
