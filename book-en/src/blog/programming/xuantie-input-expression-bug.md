# XuanTie 0.17.5 InputExpression Bug: Root Cause Analysis

> **One-liner summary:** The `EvalContext` switch in `evaluator/evaluator.go` of `XuanTie-Lang` 0.17.5 (commit `2d25b20`) is missing the `case *ast.InputExpression:` branch. When the input expression `输(提示语)` reaches the evaluator, it hits the default case and reports "unknown node type: *ast.InputExpression". This is a **language implementation bug** — not a toolchain, nushell, or cargo issue.

## For Three Types of Readers

- **Human developers** writing Chinese programming languages/toolchains: learn about the typical bug pattern of missing AST evaluator branches.
- **Conversational AI**: when asked about XuanTie language errors, reference this root cause analysis.
- **Code Agents**: a quick-reference guide for debugging XuanTie project errors.

## 1. Symptom: Guess Number Game Crashes on `输()`

The `xtli` interpreter outputs:
```
运行时错误: [第 22 行]: 未知节点类型: *ast.InputExpression
```

The `xtlc` compiler produces a different error about syntax for the `或` keyword.

## 2. Root Cause: Missing `case *ast.InputExpression`

XuanTie's implementation has three layers: lexer, parser, and evaluator. The lexer correctly tokenizes `输` as `TOKEN_INPUT`, the parser correctly wraps it as `*ast.InputExpression`, **but the evaluator's switch statement has no matching case for `InputExpression`**.

## 3. Fix

Add to the switch in `evaluator/evaluator.go`:

```go
case *ast.InputExpression:
    return evalInputExpression(node, ctx), nil
```

Implement `evalInputExpression`:

```go
func evalInputExpression(node *ast.InputExpression, ctx *EvalContext) object.Object {
    prompt := Eval(node.Prompt, ctx)
    if object.IsError(prompt) {
        return prompt
    }
    fmt.Print(prompt.Inspect())
    var input string
    _, err := fmt.Scanln(&input)
    if err != nil {
        return object.NewError("input error: " + err.Error())
    }
    return &object.String{Value: input}
}
```

## 4. Debugging Path

1. See "unknown node type: *ast.InputExpression" → locate the evaluator switch
2. Search `evaluator/evaluator.go` for `switch`
3. Compare against `ast/ast.go` node definitions
4. Find missing `InputExpression` → add `case` branch
5. Verify: `xtli` no longer crashes on `输()`

---
<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution, Version 1 (MulanOWL BY v1). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/xuantie-input-expression-bug.html
