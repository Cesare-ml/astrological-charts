import ts from 'typescript';

// This is a line-based inventory, not an authority on the runtime asset set.
// The TypeScript AST identifies quoted/template/regexp tokens so URLs or
// comment-like text inside a literal are never stripped as comments.
const RELEVANT_ASSET_EXPRESSION = /(?:assets\/|assetsImgRef|fontFilename|\.(?:png|jpe?g|webp|svg|woff2?|ttf)|\.getImg\(|\.loadAsync\(|imgRisuonatoreSolare|texture\s*:)/i;
const DYNAMIC_EXPRESSION = /\+\s*(?:opzioni|nome|pianeta|img|String|i\b)/;

export function maskTypeScriptComments(source) {
  if (typeof source !== 'string') throw new TypeError('Expected TypeScript source text');
  const file = ts.createSourceFile('asset-inventory.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const protectedTokens = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isRegularExpressionLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) {
      protectedTokens.push({ start: node.getStart(file), end: node.getEnd() });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  protectedTokens.sort((a, b) => a.start - b.start);

  let output = '';
  let offset = 0;
  let tokenIndex = 0;
  while (offset < source.length) {
    while (tokenIndex < protectedTokens.length && protectedTokens[tokenIndex].end <= offset) tokenIndex++;
    const token = protectedTokens[tokenIndex];
    if (token && token.start === offset) {
      output += source.slice(offset, token.end);
      offset = token.end;
    } else if (source.startsWith('//', offset)) {
      const newline = source.indexOf('\n', offset);
      const end = newline === -1 ? source.length : newline;
      output += ' '.repeat(end - offset);
      offset = end;
    } else if (source.startsWith('/*', offset)) {
      const closing = source.indexOf('*/', offset + 2);
      const end = closing === -1 ? source.length : closing + 2;
      output += source.slice(offset, end).replace(/[^\r\n]/g, ' ');
      offset = end;
    } else {
      output += source[offset++];
    }
  }
  return output;
}

export function collectActiveAssetLines(source, path) {
  return maskTypeScriptComments(source).split(/\r?\n/).flatMap((line, index) => {
    const expression = line.trim();
    if (!expression || !RELEVANT_ASSET_EXPRESSION.test(expression)) return [];
    return [{
      file: path,
      line: index + 1,
      expression: expression.slice(0, 220),
      kind: expression.includes('${') || DYNAMIC_EXPRESSION.test(expression) ? 'dynamic' : 'reference',
    }];
  });
}
