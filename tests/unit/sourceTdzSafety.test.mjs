import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '../../src');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);
const HOOKS_WITH_DEP_ARRAY = new Set(['useEffect', 'useLayoutEffect', 'useMemo', 'useCallback']);

const walkFiles = (dirPath) => {
  const results = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
};

const collectPatternIdentifiers = (patternNode, names = []) => {
  if (!patternNode) return names;
  if (patternNode.type === 'Identifier') {
    names.push({
      name: patternNode.name,
      line: patternNode.loc?.start?.line || 0,
    });
    return names;
  }
  if (patternNode.type === 'ObjectPattern') {
    for (const property of patternNode.properties || []) {
      if (property.type === 'ObjectProperty') {
        collectPatternIdentifiers(property.value, names);
      } else if (property.type === 'RestElement') {
        collectPatternIdentifiers(property.argument, names);
      }
    }
    return names;
  }
  if (patternNode.type === 'ArrayPattern') {
    for (const element of patternNode.elements || []) {
      collectPatternIdentifiers(element, names);
    }
    return names;
  }
  if (patternNode.type === 'AssignmentPattern') {
    collectPatternIdentifiers(patternNode.left, names);
    return names;
  }
  if (patternNode.type === 'RestElement') {
    collectPatternIdentifiers(patternNode.argument, names);
  }
  return names;
};

const collectStatementDeclarations = (statementPath) => {
  const declarations = [];

  if (statementPath.isVariableDeclaration()) {
    for (const declaratorPath of statementPath.get('declarations')) {
      for (const identifierPath of collectPatternIdentifiers(declaratorPath.node.id)) {
        declarations.push({
          name: identifierPath.name,
          line: identifierPath.line || declaratorPath.node.loc?.start?.line || 0,
          start: declaratorPath.node.start,
          kind: 'variable',
        });
      }
    }
  }

  if (statementPath.isFunctionDeclaration() && statementPath.node.id) {
    declarations.push({
      name: statementPath.node.id.name,
      line: statementPath.node.id.loc?.start?.line || statementPath.node.loc?.start?.line || 0,
      start: statementPath.node.start,
      kind: 'function',
    });
  }

  return declarations;
};

const collectTdzIssuesFromFile = (filePath) => {
  const source = readFileSync(filePath, 'utf8');
  let ast = null;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
  } catch {
    return [];
  }

  const issues = [];

  traverse(ast, {
    Function(functionPath) {
      const bodyPath = functionPath.get('body');
      if (!bodyPath.isBlockStatement()) return;

      const blockStatements = bodyPath.get('body');
      const declarations = new Map();
      for (const statementPath of blockStatements) {
        for (const declaration of collectStatementDeclarations(statementPath)) {
          declarations.set(declaration.name, declaration);
        }
      }
      if (declarations.size === 0) return;

      for (const statementPath of blockStatements) {
        statementPath.traverse({
          Function(innerPath) {
            innerPath.skip();
          },
          Identifier(identifierPath) {
            if (!identifierPath.isReferencedIdentifier()) return;

            const declaration = declarations.get(identifierPath.node.name);
            if (!declaration || declaration.kind === 'function') return;
            if (declaration.start <= statementPath.node.start) return;

            const binding = identifierPath.scope.getBinding(identifierPath.node.name);
            if (!binding || binding.scope.block !== bodyPath.node) return;

            issues.push({
              file: path.relative(path.resolve(__dirname, '../..'), filePath),
              statementLine: statementPath.node.loc?.start?.line || 0,
              referenceLine: identifierPath.node.loc?.start?.line || 0,
              declarationLine: declaration.line,
              name: declaration.name,
            });
          },
        });
      }

      bodyPath.traverse({
        Function(innerPath) {
          if (innerPath === functionPath) return;
          innerPath.skip();
        },
        CallExpression(callPath) {
          const calleePath = callPath.get('callee');
          if (!calleePath.isIdentifier() || !HOOKS_WITH_DEP_ARRAY.has(calleePath.node.name)) return;

          const depArrayPath = callPath.get('arguments')[1];
          if (!depArrayPath?.isArrayExpression()) return;

          depArrayPath.traverse({
            Function(innerPath) {
              innerPath.skip();
            },
            Identifier(identifierPath) {
              if (!identifierPath.isReferencedIdentifier()) return;

              const binding = identifierPath.scope.getBinding(identifierPath.node.name);
              if (!binding) return;

              const bindingFunctionParent = binding.path.getFunctionParent();
              if (!bindingFunctionParent || bindingFunctionParent.node !== functionPath.node) return;

              const declarationLine = binding.path.node.loc?.start?.line || 0;
              const callLine = callPath.node.loc?.start?.line || 0;
              if (declarationLine <= callLine) return;

              issues.push({
                file: path.relative(path.resolve(__dirname, '../..'), filePath),
                statementLine: callLine,
                referenceLine: identifierPath.node.loc?.start?.line || 0,
                declarationLine,
                name: identifierPath.node.name,
              });
            },
          });
        },
      });
    },
  });

  const uniqueIssues = [];
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.file}:${issue.statementLine}:${issue.referenceLine}:${issue.declarationLine}:${issue.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueIssues.push(issue);
  }
  return uniqueIssues;
};

test('source files do not reference later same-scope bindings during function evaluation', () => {
  const files = walkFiles(srcRoot);
  const issues = files.flatMap((filePath) => collectTdzIssuesFromFile(filePath));

  assert.equal(
    issues.length,
    0,
    issues.length
      ? `Found same-scope TDZ risks:\n${issues
          .slice(0, 20)
          .map((issue) => `- ${issue.file}:${issue.referenceLine} references \`${issue.name}\` before its declaration at line ${issue.declarationLine}`)
          .join('\n')}`
      : undefined,
  );
});
