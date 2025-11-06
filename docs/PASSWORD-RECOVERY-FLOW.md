# Password Recovery Flow - Rota Mestre

## Overview
Complete password recovery implementation with professional UI for both mobile and desktop.

## Flow Diagram

```
User clicks "Esqueci minha senha"
           ↓
[forgot-password.tsx] - User enters email
           ↓
Supabase sends email with recovery link
           ↓
User clicks link: rotamestre://reset-password
           ↓
[reset-password.tsx] - User enters new password
           ↓
Password updated → Redirect to login
```

## Files Involved

### 1. `/app/auth/forgot-password.tsx`
- **Purpose**: User enters email to request password reset
- **Layout**: Responsive (desktop split-screen, mobile logo-top)
- **API Call**: `authService.resetPassword(email)`
- **Redirect**: Back to login after email sent

### 2. `/app/auth/reset-password.tsx`
- **Purpose**: User enters new password after clicking email link
- **Layout**: Responsive (desktop split-screen, mobile logo-top)
- **Validation**:
  - Minimum 8 characters
  - Password confirmation match
  - Non-empty fields
- **API Call**: `authService.updatePassword(newPassword)`
- **Redirect**: Login screen after success

### 3. `/src/lib/auth.ts`
Two new methods added:

```typescript
// Send recovery email
async resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'rotamestre://reset-password',
  });
  if (error) throw error;
}

// Update password
async updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}
```

## Deep Link Configuration

### app.config.js
```javascript
scheme: "rotamestre",
```

This enables the deep link: `rotamestre://reset-password`

When user clicks the link in the email, the app opens to the reset-password screen.

## Email Configuration (Supabase)

### Required Settings in Supabase Dashboard:
1. **Authentication → Email Templates → Reset Password**
   - Use the template from `docs/email-templates.html`
   - Set "Site URL": `https://app.rotamestre.tec.br`
   - Set "Redirect URLs": Add `rotamestre://reset-password`

2. **Authentication → URL Configuration**
   - Add redirect URL: `rotamestre://reset-password`
   - Add redirect URL: `https://app.rotamestre.tec.br/auth/reset-password` (for web)

3. **SMTP Settings** (if using custom email server)
   - See `docs/supabase-email-vps.md` for VPS setup
   - See `docs/QUICK-START-EMAIL.md` for Resend/SendGrid setup

## Testing

### Test on Web (Development)
```bash
# Start dev server
npm start

# Navigate to:
# http://localhost:8083/auth/forgot-password
# http://localhost:8083/auth/reset-password
```

### Test on Android
```bash
# Build APK with EAS
eas build --platform android --profile preview

# Or test deep link directly
adb shell am start -W -a android.intent.action.VIEW -d "rotamestre://reset-password"
```

### Test Email Flow (Full Integration)
1. Go to forgot-password screen
2. Enter valid email
3. Check inbox (or Supabase logs if testing)
4. Click link in email
5. Should open reset-password screen
6. Enter new password
7. Should redirect to login

## UI Features

Both screens share the same design pattern:

### Desktop Layout
- **Left Panel**: Blue branding (#004E89) with "Rota Mestre" logo text
- **Right Panel**: White form panel with centered content
- **Max Width**: 480px for form container
- **Padding**: 60px on right panel

### Mobile Layout
- **Header**: Logo horizontal (logo-horizontal1.png)
- **Form**: Centered with 24px padding
- **Colors**:
  - Primary button: `theme.colors.secondary` (orange #f7a02a)
  - Back link: `theme.colors.primary` (blue)

## Password Validation Rules

Implemented in `reset-password.tsx`:

1. **Non-empty**: Password cannot be blank
2. **Minimum length**: 8 characters
3. **Confirmation match**: Password and confirm password must match

## Error Handling

All errors are displayed using React Native `Alert.alert()`:

- Email not provided
- Password validation failures
- Network errors from Supabase
- Invalid tokens (expired links)

## Security Considerations

1. **Token expiration**: Supabase tokens expire after 1 hour by default
2. **HTTPS only**: Email links should use HTTPS in production
3. **Password strength**: Enforce minimum 8 characters (can be increased)
4. **Rate limiting**: Supabase has built-in rate limiting for password reset requests
5. **Email verification**: Ensure SMTP is properly configured to prevent spoofing

## Next Steps (Optional Enhancements)

1. **Password strength indicator**: Visual feedback (weak/medium/strong)
2. **Show/hide password toggle**: Eye icon to reveal password
3. **Success animation**: Celebrate successful password reset
4. **Link expiration handling**: Better error message for expired tokens
5. **Rate limit feedback**: Show user if they've requested too many resets

## Related Documentation

- `docs/QUICK-START-EMAIL.md` - Email setup guide (30 minutes)
- `docs/supabase-email-vps.md` - VPS SMTP configuration
- `docs/email-templates.html` - Professional email templates
- `app.config.js` - Deep link configuration
