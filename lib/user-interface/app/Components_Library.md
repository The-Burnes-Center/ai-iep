# Components Library - Authentication Flow

This document provides documentation for the React components built for the authentication flow in the AIEP application.

## AuthHeader Component

### Purpose
The `AuthHeader` component serves as a standardized header for authentication pages. It displays the AIEP logo and a customizable title, providing consistent branding across all authentication screens.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | ✅ | - | The main heading text to display below the logo |
| `logoSrc` | `string` | ❌ | `"/images/AIEP_Logo.png"` | Path to the logo image |
| `logoAlt` | `string` | ❌ | `"AIEP Logo"` | Alt text for the logo image for accessibility |
| `className` | `string` | ❌ | `''` | Additional CSS classes to apply to the container |

### Styling
- **CSS File**: `AuthHeader.css`
- **Main Classes**:
  - Container: `text-center mb-4` (Bootstrap classes for center alignment and bottom margin)
  - Logo: `aiep-logo mb-3` (custom logo styling with bottom margin)
- **Customization**: Accepts additional CSS classes via `className` prop
- **Layout**: Vertically stacked logo and title with center alignment

### Usage Example
```tsx
<AuthHeader 
  title="Sign In to AIEP"
  className="custom-header"
/>
```

---

## SubmitButton Component

### Purpose
The `SubmitButton` component is designed for form submissions with built-in loading state management. It displays a spinner during async operations and can be configured for different button types.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `loading` | `boolean` | ✅ | - | Shows spinner animation when true |
| `buttonText` | `string` | ✅ | - | Text to display on the button |
| `disabled` | `boolean` | ❌ | `loading` | Whether the button should be disabled |
| `type` | `'submit' \| 'button' \| 'reset'` | ❌ | `'submit'` | HTML button type attribute |

### Styling
- **CSS File**: `SubmitButton.css`
- **Bootstrap Variant**: `primary` (blue button styling)
- **Main Class**: `submit-button-login`
- **Loading State**: Shows Bootstrap `Spinner` component with `border` animation and `sm` size
- **Disabled State**: Automatically disabled when loading, or manually via `disabled` prop

### Usage Example
```tsx
<SubmitButton 
  loading={isLoading}
  buttonText="Sign In"
  disabled={!formValid}
/>
```

---

## LinkButton Component

### Purpose
The `LinkButton` component provides a button that appears as a text link, typically used for secondary actions like "Forgot Password" or navigation links that need button functionality.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onClick` | `() => void` | ✅ | - | Callback function executed when button is clicked |
| `disabled` | `boolean` | ✅ | - | Whether the button should be disabled |
| `buttonText` | `string` | ✅ | - | Text to display on the button |

### Styling
- **CSS File**: `LinkButton.css`
- **Bootstrap Variant**: `link` (styled as a text link)
- **Main Class**: `link-button`
- **Appearance**: Looks like a hyperlink but functions as a button
- **States**: Supports disabled state with appropriate visual feedback

### Usage Example
```tsx
<LinkButton 
  onClick={handleForgotPassword}
  disabled={false}
  buttonText="Forgot your password?"
/>
```

---

## EmailInput Component

### Purpose
The `EmailInput` component provides a standardized email input field with built-in validation. It uses a reusable `FormLabel` component and includes proper HTML5 email input type for client-side validation.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | ✅ | - | Label text displayed above the input field |
| `placeholder` | `string` | ✅ | - | Placeholder text shown in the input field |
| `value` | `string` | ✅ | - | Current value of the email input |
| `onChange` | `(value: string) => void` | ✅ | - | Callback function called when input value changes |
| `required` | `boolean` | ❌ | `true` | Whether the input field is required |

### Styling
- **CSS File**: `EmailInput.css`
- **Bootstrap Classes**: Uses `Form.Group` with `mb-3` margin bottom
- **Main Class**: `email-input-control` for the input field
- **Input Type**: HTML5 `email` type for automatic validation
- **Dependencies**: Uses `FormLabel` component for consistent label styling

### Usage Example
```tsx
<EmailInput 
  label="Email Address"
  placeholder="Enter your email"
  value={email}
  onChange={setEmail}
  required={true}
/>
```

---

## ForgotPassword Component

### Purpose
The `ForgotPassword` component handles the complete password reset flow, including sending reset codes and setting new passwords. It manages two states: requesting a reset code and confirming the new password.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `t` | `(key: string) => string` | ✅ | - | Translation function for internationalization |
| `loading` | `boolean` | ✅ | - | Loading state for async operations |
| `error` | `string \| null` | ✅ | - | Error message to display |
| `successMessage` | `string \| null` | ✅ | - | Success message to display |
| `resetSent` | `boolean` | ✅ | - | Whether reset code has been sent |
| `resetEmail` | `string` | ✅ | - | Email address for password reset |
| `resetCode` | `string` | ✅ | - | Verification code from email |
| `newPassword` | `string` | ✅ | - | New password value |
| `confirmPassword` | `string` | ✅ | - | Password confirmation value |
| `showNewPassword` | `boolean` | ✅ | - | Toggle for new password visibility |
| `showConfirmPassword` | `boolean` | ✅ | - | Toggle for confirm password visibility |
| `setResetEmail` | `(value: string) => void` | ✅ | - | Setter for reset email |
| `setResetCode` | `(value: string) => void` | ✅ | - | Setter for reset code |
| `setNewPassword` | `(value: string) => void` | ✅ | - | Setter for new password |
| `setConfirmPassword` | `(value: string) => void` | ✅ | - | Setter for confirm password |
| `setShowNewPassword` | `(value: boolean) => void` | ✅ | - | Toggle new password visibility |
| `setShowConfirmPassword` | `(value: boolean) => void` | ✅ | - | Toggle confirm password visibility |
| `setShowForgotPassword` | `(value: boolean) => void` | ✅ | - | Control forgot password view |
| `setResetSent` | `(value: boolean) => void` | ✅ | - | Control reset sent state |
| `handleForgotPassword` | `(e: React.FormEvent) => void` | ✅ | - | Handle forgot password form submission |
| `handleResetPassword` | `(e: React.FormEvent) => void` | ✅ | - | Handle password reset form submission |

### Styling
- **CSS File**: `ForgotPassword.css`
- **Layout**: Uses Bootstrap `Container` and `Col` with responsive sizing
- **Main Classes**: `login-container` with flexbox centering
- **Two-Phase UI**: Conditional rendering based on `resetSent` state
- **Dependencies**: Uses multiple components (`AuthHeader`, `EmailInput`, `PasswordInput`, etc.)

### Usage Example
```tsx
<ForgotPassword 
  t={t}
  loading={loading}
  error={error}
  resetSent={resetSent}
  resetEmail={resetEmail}
  // ... other props
  handleForgotPassword={handleForgotPassword}
  handleResetPassword={handleResetPassword}
/>
```

---

## FormLabel Component

### Purpose
The `FormLabel` component provides a consistent label styling across all form inputs. It ensures uniform appearance and typography for form field labels.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | ✅ | - | Text content for the label |

### Styling
- **CSS File**: `FormLabel.css`
- **Bootstrap Component**: Uses `Form.Label`
- **Main Class**: `form-label-bold` for consistent bold styling
- **Purpose**: Centralizes label styling for reusability

### Usage Example
```tsx
<FormLabel label="Email Address" />
```

---

## LoginMethodToggle Component

### Purpose
The `LoginMethodToggle` component provides a toggle between mobile (SMS) and email login methods. It displays two buttons in a group format where one is active and the other is outlined.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `showMobileLogin` | `boolean` | ✅ | - | Current login method state (true for mobile, false for email) |
| `onMobileLoginClick` | `() => void` | ✅ | - | Callback when mobile login button is clicked |
| `onEmailLoginClick` | `() => void` | ✅ | - | Callback when email login button is clicked |
| `mobileLoginText` | `string` | ✅ | - | Text displayed on mobile login button |
| `emailLoginText` | `string` | ✅ | - | Text displayed on email login button |

### Styling
- **CSS File**: `LoginMethodToggle.css`
- **Bootstrap Classes**: `btn-group` for grouped button layout
- **Main Classes**: `login-method-toggle-container`, `button-text`
- **Button Variants**: Toggles between `primary` and `outline-primary`
- **Layout**: Grid layout with gap spacing

### Usage Example
```tsx
<LoginMethodToggle 
  showMobileLogin={showMobileLogin}
  onMobileLoginClick={() => setShowMobileLogin(true)}
  onEmailLoginClick={() => setShowMobileLogin(false)}
  mobileLoginText="Mobile Number"
  emailLoginText="Email Address"
/>
```

---

## LanguageDropdown Component

### Purpose
The `LanguageDropdown` component provides a dropdown menu for language selection in the authentication flow. It displays the current language and allows users to switch between supported languages.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `language` | `string` | ✅ | - | Current selected language code |
| `languageOptions` | `LanguageOption[]` | ✅ | - | Array of available language options |
| `onLanguageChange` | `(lang: SupportedLanguage) => void` | ✅ | - | Callback when language is changed |

### Interfaces
```tsx
interface LanguageOption {
  value: string;
  label: string;
}
```

### Styling
- **CSS File**: `LanguageDropdown.css`
- **Bootstrap Component**: Uses `Dropdown` with `outline-secondary` variant
- **Main Classes**: `language-login-dropdown`
- **Layout**: Right-aligned with small size button
- **States**: Highlights active language option

### Usage Example
```tsx
<LanguageDropdown 
  language="en"
  languageOptions={[
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' }
  ]}
  onLanguageChange={handleLanguageChange}
/>
```

---

## PasswordRequirements Component

### Purpose
The `PasswordRequirements` component displays password policy requirements in a visually distinct container. It helps users understand password complexity requirements during registration or password reset.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | ✅ | - | Main title for the requirements section |
| `firstRequirement` | `string` | ✅ | - | First password requirement |
| `secondRequirement` | `string` | ✅ | - | Second password requirement |

### Styling
- **No dedicated CSS file**
- **Bootstrap Classes**: `mt-3 mb-3 p-3 border rounded bg-light`
- **Container**: Uses Bootstrap `Container` with light background
- **Typography**: `text-muted` for Form.Text styling
- **Layout**: Unordered list format for requirements

### Usage Example
```tsx
<PasswordRequirements 
  title="Password must contain:"
  firstRequirement="At least 8 characters"
  secondRequirement="At least one number and one special character"
/>
```

---

## VerificationCodeInput Component

### Purpose
The `VerificationCodeInput` component provides a specialized input for SMS/email verification codes. It includes automatic sanitization to accept only digits and limits input to 6 characters.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | ✅ | - | Label text displayed above the input |
| `placeholder` | `string` | ✅ | - | Placeholder text for the input field |
| `value` | `string` | ✅ | - | Current verification code value |
| `onChange` | `(value: string) => void` | ✅ | - | Callback when input changes (receives sanitized value) |
| `required` | `boolean` | ❌ | `true` | Whether the field is required |
| `autoFocus` | `boolean` | ❌ | `true` | Whether to auto-focus the input on render |

### Styling
- **CSS File**: `VerificationCodeInput.css`
- **Main Class**: `sms-code-input`
- **Input Sanitization**: Automatically removes non-digits and limits to 6 characters
- **Max Length**: HTML maxLength attribute set to 6
- **Dependencies**: Uses `FormLabel` component

### Usage Example
```tsx
<VerificationCodeInput 
  label="Verification Code"
  placeholder="Enter 6-digit code"
  value={verificationCode}
  onChange={setVerificationCode}
  autoFocus={true}
/>
```

---

## PasswordInput Component

### Purpose
The `PasswordInput` component provides a password input field with show/hide functionality. It includes an eye icon button to toggle password visibility and uses consistent label styling.

### Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | ✅ | - | Label text displayed above the input |
| `placeholder` | `string` | ✅ | - | Placeholder text for the input field |
| `value` | `string` | ✅ | - | Current password value |
| `onChange` | `(value: string) => void` | ✅ | - | Callback when input value changes |
| `showPassword` | `boolean` | ✅ | - | Whether password should be visible |
| `onToggleVisibility` | `() => void` | ✅ | - | Callback to toggle password visibility |
| `required` | `boolean` | ❌ | `false` | Whether the field is required |

### Styling
- **CSS File**: `PasswordInput.css`
- **Bootstrap Components**: `InputGroup` with `Form.Control` and `Button`
- **Main Classes**: `password-input-container`, `password-input-control`
- **Icons**: Uses Bootstrap Icons (`bi-eye`, `bi-eye-slash`)
- **Button**: `outline-secondary` variant for visibility toggle
- **Dependencies**: Uses `FormLabel` component

### Usage Example
```tsx
<PasswordInput 
  label="Password"
  placeholder="Enter your password"
  value={password}
  onChange={setPassword}
  showPassword={showPassword}
  onToggleVisibility={() => setShowPassword(!showPassword)}
  required={true}
/>
```

---

## Component Dependencies

All components utilize:
- **React Bootstrap**: For base styling and components
- **CSS Modules**: For component-specific styling
- **TypeScript**: For type safety and prop validation

## Best Practices

1. **Consistency**: Use these components consistently across authentication flows
2. **Accessibility**: All components include proper accessibility attributes
3. **Responsive**: Components are designed to work across different screen sizes
4. **Theming**: Follow the established CSS class naming conventions
5. **Props**: Always provide required props and utilize TypeScript for type checking
