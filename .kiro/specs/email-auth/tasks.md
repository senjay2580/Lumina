# Implementation Plan: Email Authentication

## Overview

本实现计划将邮箱认证功能分解为可执行的编码任务，按照数据库 → 后端逻辑 → 前端 UI 的顺序实现，确保每个步骤都可以独立验证。

## Tasks

- [x] 1. 数据库迁移 - 添加邮箱认证相关表和字段
  - [x] 1.1 创建数据库迁移文件 `supabase/plus/007_add_email_auth.sql`
    - 扩展 users 表添加 email, email_verified, login_attempts, locked_until 字段
    - 创建 email_verifications 表
    - 添加索引和 RLS 策略
    - _Requirements: 1.1, 3.1, 4.1_

- [x] 2. 邮件服务实现
  - [x] 2.1 创建 Supabase Edge Function `supabase/functions/send-email/index.ts`
    - 实现 Resend API 调用
    - 支持 verification 和 password_reset 两种邮件类型
    - _Requirements: 1.5, 3.1, 4.1_
  
  - [x] 2.2 创建邮件服务库 `lib/email.ts`
    - 实现 sendVerificationEmail 函数
    - 实现 sendPasswordResetEmail 函数
    - 添加开发模式下的模拟邮件功能（console 输出验证码）
    - _Requirements: 1.5, 3.1, 4.1_

- [-] 3. 认证库扩展 - 扩展 lib/auth.ts
  - [ ] 3.1 扩展 User 接口和基础函数
    - 更新 User 接口添加 email, email_verified 字段
    - 添加邮箱格式验证函数 validateEmail
    - 添加验证码生成函数 generateVerificationCode
    - _Requirements: 1.3, 3.1_
  
  - [x] 3.2 实现邮箱注册功能
    - 实现 registerWithEmail 函数
    - 检查邮箱是否已存在
    - 创建用户并发送验证邮件
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
  
  - [ ]* 3.3 编写邮箱注册属性测试
    - **Property 1: Registration-Login Round Trip**
    - **Property 2: Duplicate Email Prevention**
    - **Validates: Requirements 1.1, 1.2, 2.1**
  
  - [x] 3.4 实现邮箱登录功能
    - 修改 login 函数支持邮箱或用户名登录
    - 实现登录失败计数和账户锁定
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 6.1_
  
  - [ ]* 3.5 编写登录功能属性测试
    - **Property 6: Credential Error Uniformity**
    - **Property 7: Dual Identifier Login**
    - **Property 8: Unverified Email Login**
    - **Validates: Requirements 2.2, 2.3, 2.5**
  
  - [x] 3.6 实现邮箱验证功能
    - 实现 requestEmailVerification 函数
    - 实现 verifyEmail 函数
    - 添加验证码过期检查和速率限制
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ]* 3.7 编写邮箱验证属性测试
    - **Property 9: Verification Code Format**
    - **Property 10: Verification Code Validation**
    - **Property 11: Verification Code Rate Limiting**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6**
  
  - [x] 3.8 实现密码重置功能
    - 实现 requestPasswordReset 函数
    - 实现 resetPassword 函数
    - 确保不泄露邮箱是否存在
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 3.9 编写密码重置属性测试
    - **Property 12: Password Reset Security**
    - **Property 13: Password Reset Code Validation**
    - **Validates: Requirements 4.2, 4.4, 4.5**

- [ ] 4. Checkpoint - 后端功能验证
  - 确保所有认证函数可以正常调用
  - 验证数据库操作正确
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 共享组件 - 创建验证码输入组件
  - [x] 5.1 创建 `shared/VerificationInput.tsx`
    - 6位数字输入框，自动聚焦下一个
    - 支持粘贴完整验证码
    - 显示倒计时和重新发送按钮
    - _Requirements: 7.1, 7.2, 7.6_

- [x] 6. AuthPage 重构 - 添加邮箱认证 UI
  - [x] 6.1 重构 AuthPage 状态管理
    - 添加新的 AuthMode: 'forgot-password', 'verify-email', 'reset-password'
    - 添加 email, verificationCode, countdown 状态
    - _Requirements: 7.1, 7.4_
  
  - [x] 6.2 更新注册表单
    - 添加邮箱输入字段
    - 添加邮箱格式验证
    - 注册成功后跳转到邮箱验证页面
    - _Requirements: 1.1, 1.3, 7.3_
  
  - [x] 6.3 更新登录表单
    - 支持邮箱或用户名登录
    - 添加"忘记密码"链接
    - 未验证邮箱时显示验证提醒
    - _Requirements: 2.3, 2.5, 7.4_
  
  - [x] 6.4 实现邮箱验证页面
    - 显示验证码输入组件
    - 显示倒计时和重新发送按钮
    - 验证成功后跳转登录
    - _Requirements: 3.1, 3.3, 3.5, 7.6_
  
  - [x] 6.5 实现忘记密码页面
    - 邮箱输入表单
    - 发送重置码后跳转到重置页面
    - _Requirements: 4.1, 4.2_
  
  - [x] 6.6 实现密码重置页面
    - 验证码输入
    - 新密码输入和确认
    - 重置成功后跳转登录
    - _Requirements: 4.4, 4.6_

- [ ] 7. Checkpoint - 认证流程验证
  - 测试完整注册流程：注册 → 验证邮箱 → 登录
  - 测试密码重置流程：忘记密码 → 输入验证码 → 重置 → 登录
  - 确保所有测试通过，如有问题请询问用户

- [ ] 8. SettingsPage 扩展 - 邮箱管理
  - [x] 8.1 添加邮箱管理区域
    - 显示当前邮箱和验证状态
    - 未验证时显示"重新发送验证邮件"按钮
    - 添加"修改邮箱"功能入口
    - _Requirements: 5.3, 5.4_
  
  - [x] 8.2 实现修改邮箱功能
    - 输入新邮箱和当前密码
    - 发送验证码到新邮箱
    - 验证成功后更新邮箱
    - _Requirements: 5.1_
  
  - [x] 8.3 更新密码修改功能
    - 确保需要输入当前密码
    - 添加密码强度提示
    - _Requirements: 5.2_

- [ ] 9. Final Checkpoint - 完整功能验证
  - 测试所有认证流程
  - 测试设置页面邮箱管理
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个 Checkpoint 用于验证阶段性成果
- Edge Function 需要在 Supabase Dashboard 配置 RESEND_API_KEY 环境变量
- 开发阶段可使用模拟邮件功能（验证码输出到 console）
