// Safe recursive-descent arithmetic expression evaluator for Normal Calculator
// Supports: +, -, *, /, %, parentheses (), decimals, unary +/-

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '%' }
  | { type: 'paren'; value: '(' | ')' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').trim();

  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        if (s[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error('Invalid decimal number');
        numStr += s[i];
        i++;
      }
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) throw new Error('Invalid number');
      tokens.push({ type: 'num', value: parsed });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

export function evaluateExpression(expr: string): { result: number; formattedEquation: string } {
  const cleanExpr = expr.trim().replace(/\s+/g, ' ');
  if (!cleanExpr) throw new Error('Empty expression');
  const tokens = tokenize(cleanExpr);
  if (tokens.length === 0) throw new Error('Empty expression');

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const right = parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        consume();
        const right = parseFactor();
        if (t.value === '/' && right === 0) throw new Error('Cannot divide by zero');
        left = t.value === '*' ? left * right : left / right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor(): number {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');

    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume();
      const val = parseFactor();
      return t.value === '-' ? -val : val;
    }

    let val: number;
    if (t.type === 'num') {
      consume();
      val = t.value;
    } else if (t.type === 'paren' && t.value === '(') {
      consume();
      val = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      consume();
    } else {
      throw new Error('Invalid syntax');
    }

    // Handle trailing percentage operator (e.g. 50% -> 0.5)
    while (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value === '%') {
      consume();
      val = val / 100;
    }
    return val;
  }

  const rawResult = parseExpression();
  if (pos !== tokens.length) {
    throw new Error('Unexpected trailing tokens');
  }
  if (!Number.isFinite(rawResult)) {
    throw new Error('Result is not finite');
  }

  const rounded = Math.round((rawResult + Number.EPSILON) * 1e10) / 1e10;
  return {
    result: rounded,
    formattedEquation: `${cleanExpr} = ${rounded}`,
  };
}
