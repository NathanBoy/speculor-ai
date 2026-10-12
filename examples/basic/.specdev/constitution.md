# 项目原则（constitution）

## 技术栈边界
- 优先使用项目既有技术栈（Next.js + TypeScript），不引入未经评估的新框架。

## 工程规范
- 任何代码必须通过 lint / typecheck / 测试。
- 会话信息只存服务端 cookie，不落客户端 localStorage。
