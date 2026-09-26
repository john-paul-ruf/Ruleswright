/**
 * Tokenizer + shared parse plumbing for the DSL compilers (CA-2). One lexer
 * serves both grammars: numbers, kebab/camel names, dice lexemes (S02's
 * recipes), operators, grouping. Positions are 0-based character offsets so
 * E-FORM-01 can point at the exact character that broke the grammar.
 *
 * Kebab ids force one documented lexing rule: a name lexeme swallows `-`, so
 * `iron-will` is ONE name and subtraction around names needs a space —
 * `level-1` reads as the name "level-1", which E-FORM-03's did-you-mean then
 * catches. Digit-leading terms keep the classic rule: `4-2` subtracts.
 */
import type { DslCheckRequest } from '../../schema/validate';
import type { ErrorCard, RuleId } from '../../schema/error-card';

/** 0-based character span of a lexeme inside the source expression. */
export interface SourcePos {
  readonly start: number;
  readonly length: number;
}

/** Anything that remembers where it came from. */
export interface Pos {
  readonly pos: SourcePos;
}

export type TokenKind = 'number' | 'dice' | 'name' | 'op' | 'lparen' | 'rparen' | 'comma';

export interface Token extends Pos {
  readonly kind: TokenKind;
  readonly text: string;
}

/** Parse outcome shared by both compilers; failures carry a source span (E-FORM-01). */
export type DslParse<T> = { ok: true; value: T } | { ok: false; reason: string; start: number; length: number };

/** Bounded parse depth (CA-2, database.md): deeper nesting is a parse failure, never a hang. */
export const MAX_PARSE_DEPTH = 24;

/** Bounded expression length at load: longer strings are E-FORM-01 before tokenizing. */
export const MAX_EXPR_LENGTH = 512;

const BARE_DICE = /^d\d+(?:kh|kl\d+)?$/;
const TWO_CHAR_OPS: Readonly<Record<string, string>> = { '>=': '≥', '<=': '≤' };
const ONE_CHAR_OPS = '+-*/><=≥≤';

/** Lex the shared token vocabulary; the only place raw characters are read. */
export function tokenize(src: string): DslParse<Token[]> {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }
    const start = i;
    if (isDigit(ch)) {
      while (i < src.length && isDigit(src[i]!)) i += 1;
      const diceEnd = diceEndAt(src, i);
      if (diceEnd !== undefined) i = diceEnd;
      tokens.push({
        kind: diceEnd === undefined ? 'number' : 'dice',
        text: src.slice(start, i),
        pos: { start, length: i - start },
      });
      continue;
    }
    if (isNameStart(ch)) {
      while (i < src.length && isNameChar(src[i]!)) i += 1;
      const text = src.slice(start, i);
      tokens.push({ kind: BARE_DICE.test(text) ? 'dice' : 'name', text, pos: { start, length: i - start } });
      continue;
    }
    const two = TWO_CHAR_OPS[src.slice(i, i + 2)];
    if (two !== undefined) {
      tokens.push({ kind: 'op', text: two, pos: { start, length: 2 } });
      i += 2;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({ kind: ch === '(' ? 'lparen' : ch === ')' ? 'rparen' : 'comma', text: ch, pos: { start, length: 1 } });
      i += 1;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      tokens.push({ kind: 'op', text: ch, pos: { start, length: 1 } });
      i += 1;
      continue;
    }
    return { ok: false, reason: `unexpected character "${ch}"`, start: i, length: 1 };
  }
  return { ok: true, value: tokens };
}

/** If a dice lexeme (d + digits, optional keep modifier) starts at `i`, the index just past it. */
function diceEndAt(src: string, i: number): number | undefined {
  if (src[i] !== 'd' || !isDigit(src[i + 1] ?? '')) return undefined;
  let j = i + 2;
  while (j < src.length && isDigit(src[j]!)) j += 1;
  const keep = src[j];
  if (keep === 'k' && (src[j + 1] === 'h' || src[j + 1] === 'l') && isDigit(src[j + 2] ?? '')) {
    j += 3;
    while (j < src.length && isDigit(src[j]!)) j += 1;
  }
  return j;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isNameStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isNameChar(ch: string): boolean {
  return isNameStart(ch) || isDigit(ch) || ch === '-';
}

/** Nearest known name by edit distance — the did-you-mean hint (E-FORM-03). Mirrors S01's nearestIds; local because core takes no runtime schema imports. */
export function nearestName(target: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = editDistance(target, candidate);
    if (distance < bestDistance || (distance === bestDistance && best !== undefined && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (previous[j] ?? i) + 1,
        (current[j - 1] ?? i) + 1,
        (previous[j - 1] ?? i - 1) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j] ?? i;
  }
  return previous[b.length] ?? a.length;
}

/** One ErrorCard shape (S01's contract) built literally — core constructs cards without a runtime schema import. */
export function dslCard(rule: RuleId, request: DslCheckRequest, message: string, hint?: string): ErrorCard {
  const card: ErrorCard = { severity: 'error', artifactId: request.artifactId, jsonPath: request.jsonPath, rule, message };
  return hint === undefined ? card : { ...card, hint };
}