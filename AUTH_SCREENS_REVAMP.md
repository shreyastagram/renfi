# Auth Screens CSS Revamp — Implementation Guide

## Purpose

Modernize all pre-login auth screens to match the premium design language used in SettingsScreen and post-login screens. CSS-only changes — no logic changes.

## Design Language (from SettingsScreen)

```javascript
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',      // Light slate background (NOT white)
  cardWhite: '#FFFFFF',
  primary: '#f67c16',          // Brand orange
  secondary: '#2b76bc',        // Brand blue
  muted: '#94A3B8',
  textPrimary: '#1E293B',      // Slate 800
  textSecondary: '#64748B',    // Slate 500
  danger: '#EF4444',
  iconBg: '#F1F5F9',
  divider: '#F1F5F9',
};
const CARD_RADIUS = 22;
```

## Standards for ALL Auth Screens

### Colors
- Background: `#FFFFFF` (keep white for auth, clean look)
- Text primary: `#1E293B` (not #111827)
- Text secondary: `#64748B` (not #6B7280)
- Text muted: `#94A3B8` (not #9CA3AF)
- Primary button: `#f67c16` (user) / `#2b76bc` (provider)
- Link color: `#2b76bc` (not #2563EB — match brand)
- Checkbox: `#f67c16` (not #2563EB)
- Borders: `#E2E8F0` (not #E5E7EB / #D1D5DB)

### Logo
- Container: `72x72`, `borderRadius: 18`
- Shadow: brand orange tint, subtle
- Brand name: `fontSize: 18`, `fontWeight: '800'`

### Typography
- Page title: `fontSize: 26`, `fontWeight: '800'`, `#1E293B`
- Subtitle: `fontSize: 15`, `#64748B`, `lineHeight: 22`
- Input labels: via Input component (unchanged)
- Button text: `fontSize: 16`, `fontWeight: '700'`
- Small text: `fontSize: 12`, `#94A3B8`

### Buttons
- Primary: `borderRadius: 14`, `paddingVertical: 15`
- Google: `borderRadius: 14`, `borderColor: '#E2E8F0'`
- Apple: `borderRadius: 14`
- All: consistent `paddingVertical: 15`

### Back Button
- Use Ionicons `arrow-back` icon (not text `←` or `<`)
- Size: 22, color: `#1E293B`
- Container: `width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9'`

### Location Box (Provider Register)
- Compact design: single row with icon + text + action
- Background: `#F8FAFC` (very subtle, not bright green)
- Border: `#E2E8F0` (not bright green)
- "Detect Location" as a compact pill button, not full-width

### Info Boxes
- Background: `#F8FAFC`
- Border: `#E2E8F0`
- Icon: vector icon (not emoji)
- Text: `#64748B`

### Modals
- Primary button: `#f67c16` (consistent, not green #059669)
- Border radius: `20` (not 16)
- Overlay: `rgba(15, 23, 42, 0.5)` (dark slate, not pure black)
- No emoji icons — use MaterialIcons

### Dividers ("or" separator)
- Line: `#E2E8F0`
- Text: `#94A3B8`, `fontSize: 13`

### Terms Checkbox
- Checkbox color: `#f67c16` (brand orange)
- Border radius: `6`

### OTP Input (OTPVerifyScreen)
- Single cursor visible (hide the default TextInput cursor when using custom boxes)
- `caretHidden: true` on the hidden input
- Box border: `#E2E8F0` default, `#f67c16` active/focused
- Clean animation on focus

## Screens to Revamp (in order)

| # | Screen | Priority | Notes |
|---|--------|----------|-------|
| 1 | ProviderRegisterScreen | HIGH | Location box too big, modal button wrong color |
| 2 | RegisterScreen | HIGH | Match provider screen design |
| 3 | UserTypeScreen | HIGH | First screen users see |
| 4 | OTPVerifyScreen | HIGH | Double cursor bug, box styling |
| 5 | OTPLoginScreen | MEDIUM | Tab styling, input styling |
| 6 | ForgotPasswordScreen | MEDIUM | Two-step flow styling |
| 7 | LoginScreen (inside UserAuth/ProviderAuth) | MEDIUM | Form styling |

## Progress

| # | Screen | Status | Notes |
|---|--------|--------|-------|
| 1 | ProviderRegisterScreen | DONE | Full CSS rewrite, emojis→icons, location box compact, modal orange, auto-scroll on error |
| 2 | RegisterScreen | DONE | Full CSS rewrite matching ProviderRegister, emojis→icons, auto-scroll on error |
| 3 | UserTypeScreen | DONE | Logo 80px, cards with subtle borders, chevron pills, modern lang picker |
| 4 | OTPVerifyScreen | DONE | Double cursor fixed (caretHidden+selectionColor), back button icon, brand orange OTP boxes |
| 5 | OTPLoginScreen | DONE | Logo fixed, tabs with brand orange active, unified palette |
| 6 | ForgotPasswordScreen | DONE | Colors unified, OTP cursor fix, back links with icons, success emoji→MaterialIcons |
| 7 | LoginScreen | DONE | Logo fixed, emoji→MaterialIcons, unified colors, modal modern |

## Changes Made

### ProviderRegisterScreen (v2.0 design)
- **Back button**: Text `←` → Ionicons `arrow-back` in `38x38` rounded `#F1F5F9` pill
- **Logo**: 68→64px, tighter shadow
- **Info box**: Bright blue `#EFF6FF` → subtle `#F8FAFC` with `borderRadius: 12`, emoji→MaterialIcons
- **Location box**: Bright green `#F0FDF4` → subtle `#F8FAFC`, compact detect button (pill, not full-width)
- **Location status**: Text ✓/⚠ → Ionicons checkmark-circle/warning
- **Modals**: Green `#059669` → brand orange `#f67c16`, emoji→MaterialIcons in tinted circles, overlay dark slate
- **Checkbox**: Blue `#2563EB` → brand orange `#f67c16`
- **Google/Apple buttons**: `borderRadius: 14`
- **Terms link**: `#2563EB` → brand blue `#2b76bc`
- **Auto-scroll**: `showAlert()` scrolls to top so errors visible after Google/Apple auth

### RegisterScreen (partial)
- **Auto-scroll**: `showAlert()` scrolls to top on error
- **useEffect import**: Fixed (was missing)
- CSS revamp pending

## Key Issues to Fix
- ProviderRegister: location box is too large, bright green, uses emoji
- ProviderRegister: modal primary button is green (#059669), should be orange (#f67c16)
- RegisterScreen: useEffect import was missing (FIXED)
- OTPVerifyScreen: double cursor (blinker + TextInput cursor both visible)
- Back buttons inconsistent across screens (text vs icon, different colors)
- Info boxes use emoji instead of icons
- No consistent design tokens file (each screen defines own colors)
