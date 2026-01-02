# Requirements Document

## Introduction

为 Lumina 应用添加邮箱注册登录和找回密码功能。当前系统仅支持用户名+密码登录，需要扩展为支持邮箱注册、邮箱登录、邮箱验证和密码重置功能，遵循行业最佳实践。

## Glossary

- **Auth_System**: Lumina 的认证系统，负责用户注册、登录、验证和密码管理
- **User**: 系统用户实体，包含用户名、邮箱、密码等信息
- **Email_Service**: 邮件发送服务，负责发送验证码和重置链接
- **Verification_Code**: 6位数字验证码，用于邮箱验证和密码重置
- **Password_Reset_Token**: 密码重置令牌，用于验证重置请求的合法性

## Requirements

### Requirement 1: 邮箱注册

**User Story:** As a new user, I want to register with my email address, so that I can create an account and recover it if I forget my password.

#### Acceptance Criteria

1. WHEN a user enters a valid email and password on the registration form, THE Auth_System SHALL create a new user account with the email as the primary identifier
2. WHEN a user attempts to register with an already registered email, THE Auth_System SHALL display an error message indicating the email is already in use
3. WHEN a user enters an invalid email format, THE Auth_System SHALL display a validation error before submission
4. THE Auth_System SHALL require passwords to be at least 6 characters long
5. WHEN registration is successful, THE Auth_System SHALL send a verification email to the user's email address
6. THE Auth_System SHALL store passwords using secure hashing (SHA-256 with salt)

### Requirement 2: 邮箱登录

**User Story:** As a registered user, I want to log in with my email and password, so that I can access my account.

#### Acceptance Criteria

1. WHEN a user enters correct email and password, THE Auth_System SHALL authenticate the user and create a session
2. WHEN a user enters incorrect credentials, THE Auth_System SHALL display a generic error message without revealing which field is incorrect
3. THE Auth_System SHALL support both email and username for login (backward compatibility)
4. WHEN login is successful, THE Auth_System SHALL store the user session in localStorage
5. IF a user's email is not verified, THE Auth_System SHALL still allow login but display a reminder to verify email

### Requirement 3: 邮箱验证

**User Story:** As a registered user, I want to verify my email address, so that I can prove ownership and enable password recovery.

#### Acceptance Criteria

1. WHEN a user requests email verification, THE Email_Service SHALL send a 6-digit verification code to the user's email
2. THE Verification_Code SHALL expire after 10 minutes
3. WHEN a user enters the correct verification code, THE Auth_System SHALL mark the email as verified
4. WHEN a user enters an incorrect or expired code, THE Auth_System SHALL display an appropriate error message
5. THE Auth_System SHALL allow users to request a new verification code (with rate limiting)
6. WHILE a verification code is still valid, THE Auth_System SHALL not generate a new code for the same email within 60 seconds

### Requirement 4: 找回密码

**User Story:** As a user who forgot my password, I want to reset it using my email, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user requests password reset with a registered email, THE Email_Service SHALL send a 6-digit reset code to that email
2. WHEN a user requests password reset with an unregistered email, THE Auth_System SHALL display a success message (to prevent email enumeration)
3. THE Password_Reset_Token SHALL expire after 10 minutes
4. WHEN a user enters the correct reset code and new password, THE Auth_System SHALL update the password and invalidate the reset token
5. WHEN a user enters an incorrect or expired reset code, THE Auth_System SHALL display an appropriate error message
6. THE Auth_System SHALL require the new password to meet the same requirements as registration (minimum 6 characters)

### Requirement 5: 用户资料管理

**User Story:** As a logged-in user, I want to manage my email and password in settings, so that I can keep my account secure.

#### Acceptance Criteria

1. WHEN a user updates their email in settings, THE Auth_System SHALL require verification of the new email before updating
2. WHEN a user changes their password, THE Auth_System SHALL require the current password for verification
3. THE Auth_System SHALL display the user's email verification status in the settings page
4. WHEN a user's email is not verified, THE Auth_System SHALL provide a button to resend verification email

### Requirement 6: 安全性要求

**User Story:** As a system administrator, I want the authentication system to follow security best practices, so that user accounts are protected.

#### Acceptance Criteria

1. THE Auth_System SHALL implement rate limiting for login attempts (max 5 attempts per 15 minutes per IP/email)
2. THE Auth_System SHALL implement rate limiting for verification code requests (max 3 requests per 10 minutes per email)
3. THE Auth_System SHALL use secure random generation for verification codes
4. IF multiple failed login attempts occur, THE Auth_System SHALL temporarily lock the account

### Requirement 7: UI/UX 要求

**User Story:** As a user, I want a smooth and intuitive authentication experience, so that I can easily register, login, and recover my account.

#### Acceptance Criteria

1. THE Auth_System SHALL provide clear visual feedback during all authentication operations
2. THE Auth_System SHALL display loading states during async operations
3. THE Auth_System SHALL provide inline validation for email and password fields
4. WHEN switching between login modes (email/username), THE Auth_System SHALL preserve entered data where applicable
5. THE Auth_System SHALL support keyboard navigation and be accessible
6. THE Auth_System SHALL display countdown timer for verification code expiration
