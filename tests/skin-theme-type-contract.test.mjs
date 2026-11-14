import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const skinsSource = ts.createSourceFile(
  'skin-manager.ts',
  readFileSync(new URL('../src/lib/renderers/@skin-manager.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const optionsSource = ts.createSourceFile(
  'opzioni-grafico.model.ts',
  readFileSync(new URL('../src/lib/models/opzioni-grafico.model.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function propertyName(name) {
  if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) return name.text;
  return undefined;
}

function propertyOf(object, key) {
  assert.ok(ts.isObjectLiteralExpression(object), `Expected object literal for ${key}`);
  const property = object.properties.find(
    (entry) => ts.isPropertyAssignment(entry) && propertyName(entry.name) === key,
  );
  assert.ok(property, `Missing configuration property ${key}`);
  return property.initializer;
}

const skinClass = skinsSource.statements.find(
  (node) => ts.isClassDeclaration(node) && node.name?.text === 'SkinManager',
);
assert.ok(skinClass, 'SkinManager class must exist');
const skinProperty = skinClass.members.find(
  (node) => ts.isPropertyDeclaration(node) && propertyName(node.name) === 'skins',
);
assert.ok(skinProperty?.initializer && ts.isObjectLiteralExpression(skinProperty.initializer));
const skinEntries = skinProperty.initializer.properties.filter(ts.isPropertyAssignment);
const themeRegistry = new Map(skinEntries.map(
  (property) => [propertyName(property.name), property.initializer],
));

const typeAlias = optionsSource.statements.find(
  (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'TemaGrafico',
);
assert.ok(typeAlias && ts.isUnionTypeNode(typeAlias.type), 'TemaGrafico must be a literal union');
const declaredThemes = typeAlias.type.types.map((node) => {
  assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal), 'Every theme must have a literal name');
  return node.literal.text;
});

test('TemaGrafico TypeScript union matches every registered renderer skin', () => {
  assert.equal(new Set(declaredThemes).size, declaredThemes.length, 'Duplicate literal in TemaGrafico');
  assert.equal(themeRegistry.size, skinEntries.length, 'Duplicate key in SkinManager.skins');
  assert.deepEqual([...declaredThemes].sort(), [...themeRegistry.keys()].sort());
  assert.ok(declaredThemes.includes('astrolabio-girasole'), 'Girasole skin must be selectable by typed consumers');
});

test('each registered skin provides the essential chart-rendering sections', () => {
  const sections = [
    'bgColor', 'elementi', 'cerchioAspetti', 'anelloElementiCelesti',
    'anelloSegni', 'anelloCase', 'anelloTransiti', 'latitudini',
  ];
  for (const [name, configuration] of themeRegistry) {
    for (const section of sections) {
      const field = propertyOf(configuration, section);
      if (section !== 'bgColor' && section !== 'elementi') {
        assert.ok(ts.isObjectLiteralExpression(field), `${name}.${section} must be an object`);
      }
    }
  }
});

test('the default chart theme resolves to an available registered skin', () => {
  const defaults = optionsSource.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((declaration) => declaration.name.getText(optionsSource) === 'defaultOpzioniGrafico');
  assert.ok(defaults?.initializer, 'defaultOpzioniGrafico must exist');
  const theme = propertyOf(defaults.initializer, 'temaGrafico');
  assert.ok(ts.isStringLiteral(theme), 'Default theme must be a string literal');
  assert.ok(themeRegistry.has(theme.text), 'Default chart theme must exist in SkinManager.skins');
});
