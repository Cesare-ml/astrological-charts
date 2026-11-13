import ts from 'typescript';

// Parse syntax rather than searching source text: comments and string literals
// may contain historical imports which are not dependencies of the library.
export function importTargets(content) {
  const source = ts.createSourceFile('source.ts', content, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers;
}

// A computed import cannot be checked against the extracted source tree or
// declared package dependencies. Report it rather than silently skipping it.
export function nonLiteralImportLocations(content) {
  const source = ts.createSourceFile('source.ts', content, ts.ScriptTarget.Latest, true);
  const locations = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))) {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      locations.push(`${line + 1}:${character + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return locations;
}
