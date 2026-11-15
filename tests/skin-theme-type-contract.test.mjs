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

const settingsSource = ts.createSourceFile(
  'settaggi.model.ts',
  readFileSync(new URL('../src/lib/models/settaggi.model.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const publicApiSource = ts.createSourceFile(
  'public-api.ts',
  readFileSync(new URL('../src/public-api.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const modelBarrelExport = publicApiSource.statements.find(
  (node) => ts.isExportDeclaration(node)
    && node.exportClause === undefined
    && ts.isStringLiteral(node.moduleSpecifier)
    && node.moduleSpecifier.text === './lib/models/opzioni-grafico.model',
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

const optionsInterface = optionsSource.statements.find(
  (node) => ts.isInterfaceDeclaration(node) && node.name.text === 'OpzioniGrafico',
);
const themeField = optionsInterface?.members.find(
  (member) => ts.isPropertySignature(member) && propertyName(member.name) === 'temaGrafico',
);

test('OpzioniGrafico.temaGrafico remains a required TemaGrafico-typed field', () => {
  assert.ok(optionsInterface, 'Public OpzioniGrafico interface must exist');
  assert.ok(themeField && ts.isPropertySignature(themeField), 'Public theme field must exist');
  assert.equal(themeField.questionToken, undefined, 'Theme selection must remain required');
  assert.ok(themeField.type && ts.isTypeReferenceNode(themeField.type),
    'Theme selection must reference its declared union, not string or any');
  assert.equal(themeField.type.typeName.getText(optionsSource), 'TemaGrafico');
});

test('TemaGrafico is exportable via the existing public Angular library barrel', () => {
  assert.ok(typeAlias.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    'The TemaGrafico alias must be exported from its model module');
  assert.ok(modelBarrelExport, 'Public API must re-export the entire options model module');
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

test('Settaggi constructor and saved defaults select a registered skin', () => {
  const settingsClass = settingsSource.statements.find(
    (node) => ts.isClassDeclaration(node) && node.name?.text === 'Settaggi',
  );
  assert.ok(settingsClass, 'Settaggi class must exist');
  const skinId = settingsClass.members.find(
    (member) => ts.isPropertyDeclaration(member) && propertyName(member.name) === 'skin_id',
  );
  assert.ok(skinId?.initializer && ts.isStringLiteral(skinId.initializer));
  const defaultSettings = settingsSource.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((declaration) => declaration.name.getText(settingsSource) === 'settaggiDefault');
  assert.ok(defaultSettings?.initializer, 'settaggiDefault must exist');
  const persistedSkinId = propertyOf(defaultSettings.initializer, 'skin_id');
  assert.ok(ts.isStringLiteral(persistedSkinId), 'Saved default skin must be a string literal');
  assert.ok(themeRegistry.has(skinId.initializer.text), 'Constructor renderer skin must exist');
  assert.ok(themeRegistry.has(persistedSkinId.text), 'Saved renderer skin must exist');
});

test('TypeScript can import all seven themes through the public barrel and rejects unknown skins', () => {
  const virtualModelFile = '/virtual/lib/models/opzioni-grafico.model.ts';
  const virtualPublicFile = '/virtual/public-api.ts';
  const virtualFile = '/virtual/chart-theme-consumer.ts';
  const compilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
  };
  const diagnosticsFor = (theme) => {
    const virtualSources = new Map([
      [virtualModelFile, `${typeAlias.getText(optionsSource)}\nexport interface PublicChartSelection { ${themeField.getText(optionsSource)} }\n`],
      [virtualPublicFile, `${modelBarrelExport.getText(publicApiSource)}\n`],
      [virtualFile, `import type { TemaGrafico, PublicChartSelection } from './public-api';\nconst direct: TemaGrafico = ${JSON.stringify(theme)};\nconst selected: PublicChartSelection = { temaGrafico: ${JSON.stringify(theme)} };\n`],
    ]);
    const host = ts.createCompilerHost(compilerOptions);
    const originalGetSourceFile = host.getSourceFile.bind(host);
    const originalFileExists = host.fileExists.bind(host);
    const originalReadFile = host.readFile.bind(host);
    const originalDirectoryExists = host.directoryExists.bind(host);
    host.directoryExists = (name) =>
      name === '/virtual' || name === '/virtual/lib' || name === '/virtual/lib/models'
      || originalDirectoryExists(name);
    host.fileExists = (name) => virtualSources.has(name) || originalFileExists(name);
    host.readFile = (name) => virtualSources.get(name) ?? originalReadFile(name);
    host.getSourceFile = (name, version, onError, shouldCreateNewSourceFile) =>
      virtualSources.has(name)
        ? ts.createSourceFile(name, virtualSources.get(name), version, true, ts.ScriptKind.TS)
        : originalGetSourceFile(name, version, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([virtualFile], compilerOptions, host);
    return ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === virtualFile);
  };
  for (const theme of declaredThemes) {
    assert.deepEqual(diagnosticsFor(theme), [], `Public type import must accept registered skin ${theme}`);
  }
  assert.ok(diagnosticsFor('invalid-chart-skin').some((diagnostic) => diagnostic.code === 2322),
    'An unknown theme must be rejected by the imported public type');
});
