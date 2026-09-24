# Phase 5a — Settings theme control

**Goal:** give the user a Light / Dark / System Default control in Settings, wired to the
existing `ThemeProvider`, for both User and Provider.

**Base:** `feature/theme-v2`. **Scope:** 2 files + 3 locale files. **No new dependencies.**

## Global constraints

- **Exactly 7 new i18n keys**, `settings.theme*`, taking en/hi/mr from **2067 → 2074**.
  The remaining sanctioned key, `profile.emailPending`, belongs to Phase 5b.
- **Mirror the existing language picker** (`SettingsScreen.jsx:1204` row,
  `:1366` modal, `settingsLangStyles` at `:2100`). Same `ActionRow`, same `Modal`, same
  styles object. Consistency with its neighbour beats novelty.
- **Do not theme `SettingsScreen` in this phase.** It is 47 colour literals and belongs to
  Phase 6. A half-themed screen is worse than an unthemed one.
- Never stage `.vscode/settings.json` or `android/clean.log`.
- Gates: `npm run verify` (includes the owner's 86 Working Hours tests).
- Syntax check `.jsx` with **eslint**, not the babel CLI.

## Known consequence — state it plainly when reporting

Selecting **Dark** will change **only the status bar** until Phases 6–9 migrate the screens.
The engine, persistence and system-following all work; nothing consumes the tokens yet.
This is expected, not a defect. Do not "fix" it by theming one screen early.

---

### Task 1: i18n keys

**Files:** `src/i18n/en.js`, `hi.js`, `mr.js` — add to the `settings` namespace, beside
`language` / `languageSub`.

- [ ] **Step 1: add the 7 keys to all three locales**

`en.js`:
```js
    theme: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System Default',
    themeLightSub: 'Always use the light appearance',
    themeDarkSub: 'Always use the dark appearance',
    themeSystemSub: 'Match your device setting',
```

`hi.js`:
```js
    theme: 'रूप',
    themeLight: 'लाइट',
    themeDark: 'डार्क',
    themeSystem: 'सिस्टम डिफ़ॉल्ट',
    themeLightSub: 'हमेशा लाइट रूप का उपयोग करें',
    themeDarkSub: 'हमेशा डार्क रूप का उपयोग करें',
    themeSystemSub: 'अपने डिवाइस की सेटिंग के अनुसार',
```

`mr.js`:
```js
    theme: 'स्वरूप',
    themeLight: 'लाइट',
    themeDark: 'डार्क',
    themeSystem: 'सिस्टम डीफॉल्ट',
    themeLightSub: 'नेहमी लाइट स्वरूप वापरा',
    themeDarkSub: 'नेहमी डार्क स्वरूप वापरा',
    themeSystemSub: 'तुमच्या डिव्हाइसच्या सेटिंगनुसार',
```

- [ ] **Step 2: verify parity**

Run: `npm run check:i18n`
Expected: `en=2074  hi=2074  mr=2074` then `check:i18n OK`.
No `%{var}` placeholders in any of these, so the placeholder check is trivially satisfied.

---

### Task 2: the picker

**File:** `src/screens/SettingsScreen.jsx`

**Interfaces consumed:** `useTheme()` → `{ mode, setMode }` and `THEME_MODES` from
`../theme`. `mode` is `'light' | 'dark' | 'system'`; `setMode` persists to AsyncStorage.

- [ ] **Step 1: import**

Beside the existing `useLanguage` import:
```js
import { useTheme, THEME_MODES } from '../theme';
```

- [ ] **Step 2: hook + state**

Beside `const [showLangModal, setShowLangModal] = React.useState(false);`:
```js
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [showThemeModal, setShowThemeModal] = React.useState(false);
```

- [ ] **Step 3: label map at module scope**

`makeStyles`-style module constant so it is not rebuilt per render:
```js
// Keyed by the mode values THEME_MODES exposes, so the two cannot drift apart.
const THEME_LABEL_KEYS = {
  light: { label: 'settings.themeLight', sub: 'settings.themeLightSub' },
  dark: { label: 'settings.themeDark', sub: 'settings.themeDarkSub' },
  system: { label: 'settings.themeSystem', sub: 'settings.themeSystemSub' },
};
```

- [ ] **Step 4: the row, directly after the language `ActionRow`**

```jsx
          <ActionRow
            iconName="settings"
            title={t('settings.theme')}
            subtitle={t(THEME_LABEL_KEYS[themeMode]?.label || 'settings.themeSystem')}
            onPress={() => setShowThemeModal(true)}
          />
```

- [ ] **Step 5: the modal, directly after the language `Modal`**

Reuses `settingsLangStyles` deliberately — same visual language as its neighbour.
```jsx
      {/* Appearance Picker Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <TouchableOpacity
          style={settingsLangStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowThemeModal(false)}
        >
          <View style={settingsLangStyles.modal}>
            <Text style={settingsLangStyles.title}>{t('settings.theme')}</Text>
            {THEME_MODES.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  settingsLangStyles.option,
                  themeMode === m && settingsLangStyles.optionActive,
                ]}
                onPress={() => {
                  setThemeMode(m);
                  setShowThemeModal(false);
                }}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: themeMode === m }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    settingsLangStyles.optionText,
                    themeMode === m && settingsLangStyles.optionTextActive,
                  ]}>
                    {t(THEME_LABEL_KEYS[m].label)}
                  </Text>
                  <Text style={settingsLangStyles.optionSub}>
                    {t(THEME_LABEL_KEYS[m].sub)}
                  </Text>
                </View>
                {themeMode === m && (
                  <Icon name="check" size={20} color={COLORS.secondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
```

- [ ] **Step 6: syntax check**

Run: `npx eslint src/screens/SettingsScreen.jsx -f unix | tail -1`
Compare against the v1.0.9 baseline for the same file. Must not increase.

- [ ] **Step 7: full gates**

Run: `npm run verify`
Expected: exit 0, `en=2074 hi=2074 mr=2074`, 21 + 86 tests pass.

- [ ] **Step 8: commit**

```bash
git add src/i18n src/screens/SettingsScreen.jsx
git commit -m "feat(settings): Light, Dark and System Default appearance control"
```

---

## What this does NOT do

- Does not theme `SettingsScreen` or any other screen — Phase 6 onward.
- Does not add `profile.emailPending` — Phase 5b.
- Not device-verified; this environment cannot run the app.
