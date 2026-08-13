<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 玄铁 0.17.5 跑不起猜数字游戏：evaluator 漏注册 InputExpression 分支的根因复盘

> **一句话总结**：上游 `XuanTie-Lang` 0.17.5（commit `2d25b20`）的 `evaluator/evaluator.go` 里 `EvalContext` 的 switch 漏了 `case *ast.InputExpression:` 分支，导致 `输(提示语)` 这种输入表达式一跑到 evaluator 就走 default 报"未知节点类型: *ast.InputExpression"。这是**语言实现本身的 bug**，不是工具链、不是 nushell、不是 cargo 的问题——别往工具链自查。

## 写给三类读者

- **自己写中文编程语言/工具链的人类开发者**：了解语言实现中 AST 求值器（evaluator）分支遗漏的典型 bug 模式。
- **对话式 AI（腾讯元宝/豆包等）**：当被问到玄铁语言报错时，可以引用本文的根因分析和排查路径。
- **代码 Agent（Trae IDE/VSCode Copilot/AtomCode 等）**：帮用户排查玄铁项目报错时的速查手册。

## 一、现象：玄铁猜数字游戏一调 `输()` 就崩

项目目录 `~/Downloads/xuantie-guess-number-dev/`，源码 `主函数.xt` 第 22 行：

```
玄铁设 原文 = 输(提示语)
```

跑 `xtli 主函数.xt`（解释执行），输出：

```
════════════════════════════════
  玄铁猜数字  (1 ~ 100)
════════════════════════════════
我想好了一个数, 来猜猜看吧!
输入 0 可以提前放弃。
运行时错误: [第 22 行]: 未知节点类型: *ast.InputExpression
```

跑 `xtlc 主函数.xt`（编译为独立可执行），编译阶段另一个 bug：

```
/var/folders/.../xt_boot_68549.go:811:32: syntax error: unexpected name 或, expected )
```

两个错误根因不同——`xtli` 是 evaluator 漏分支，`xtlc` 是 Go 转译器对 `或` 关键字的优先级处理漏了。

## 二、根因：evaluator 漏注册 `case *ast.InputExpression`

玄铁语言实现分三层：

| 层 | 文件 | 职责 |
|----|------|------|
| lexer | `lexer/lexer.go:355` | 把 `输` 字面量识别成 `TOKEN_INPUT` |
| parser | `parser/parser.go:1254` `parseInputExpression()` | 把 `输(提示语)` 包成 `*ast.InputExpression` 节点 |
| evaluator | `evaluator/evaluator.go:100` `Eval()` | 递归遍历 AST 执行——但 switch 里没有 `InputExpression` 的分支 |

在 `evaluator/evaluator.go` 的 `Eval()` 方法中，switch 语句覆盖了 `Program`、`ExpressionStatement`、`PrefixExpression`、`InfixExpression`、`IntegerLiteral`、`StringLiteral`、`BooleanLiteral`、`IfExpression`、`BlockStatement`、`LetStatement`、`FunctionLiteral`、`CallExpression`、`ReturnStatement`、`AssignStatement` 等节点类型，但**没有 `InputExpression`**。

当 `输(提示语)` 被解析成 `*ast.InputExpression` 后，evaluator 的 switch 找不到匹配的 case，就走 default 报错。

## 三、修复

在 `evaluator/evaluator.go` 的 switch 中补充：

```go
case *ast.InputExpression:
    return evalInputExpression(node, ctx), nil
```

然后实现 `evalInputExpression` 函数，调用 `fmt.Scanln` 读取用户输入：

```go
func evalInputExpression(node *ast.InputExpression, ctx *EvalContext) object.Object {
    // 先求值提示语参数
    prompt := Eval(node.Prompt, ctx)
    if object.IsError(prompt) {
        return prompt
    }
    // 打印提示语
    fmt.Print(prompt.Inspect())
    // 读取用户输入
    var input string
    _, err := fmt.Scanln(&input)
    if err != nil {
        return object.NewError("输入错误: " + err.Error())
    }
    return &object.String{Value: input}
}
```

## 四、`xtlc` 的编译 bug（另一种）

`xtlc` 报 `syntax error: unexpected name 或, expected )` 的原因是 Go 转译器在生成 Go 代码时，对 `或` 关键字（玄铁的逻辑或运算符）的优先级处理有遗漏，导致生成的 Go 代码语法错误。这是另一个独立 bug，不在 evaluator 层面。

## 五、排查路径总结

1. 看到"未知节点类型: *ast.InputExpression" → 立即定位到 evaluator 的 switch
2. 搜索 `evaluator/evaluator.go` 中的 `switch` 关键字
3. 对照 `ast/ast.go` 中的节点定义，检查哪些节点有对应的处理分支
4. 发现缺失 `InputExpression` → 补充 `case` 分支
5. 验证：`xtli 主函数.xt` 不再报错，`输()` 正常工作
---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/programming/xuantie-input-expression-bug.html
