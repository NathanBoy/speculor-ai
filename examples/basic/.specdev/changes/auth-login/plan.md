---
spec: auth-login
modules: [auth, session]
covers:
  - 未登录访问受保护路由重定向到登录页
  - 登录成功后写入会话
  - 会话有效期默认 30 分钟
  - 登录后写入会话 30 分钟内有效
---

# 方案

## auth 模块

- 新增登录接口：校验用户名密码，成功签发会话。
- 新增路由守卫：未登录访问受保护路由时 302 到 /login。

## session 模块

- 会话写入 httpOnly cookie，有效期 30 分钟。
- 提供会话读取与过期判断。

## 技术决策

- 用项目既有 Next.js App Router 的 middleware 做路由守卫，不引入新框架。
