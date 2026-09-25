"""Map the 14 remaining screens (auth + verification + insurance) onto tokens.

Same shape as the modal batch: one shared (property, literal) table, because these
screens share one slate ramp. Vendor brand colours go to `vendor`, brand tints to
`brandTint`, and ink-on-a-coloured-fill is listed per file because value alone cannot
tell you what it sits on.
"""
import re
import sys

sys.path.insert(0, '/private/tmp/claude-501/-Users-shreyashsureshborkar-AXXXSXX-AXXASXX-App-FIXORA-FIXORA-APP-renfi-renfi/4425de67-bc5f-4576-afd7-10d95db36403/scratchpad')
import migrate as M

FILES = [
    'RegisterScreen', 'LoginScreen', 'InsuranceScreen', 'VerificationScreen',
    'UnifiedUserAuthScreen', 'OTPVerifyScreen', 'UserTypeScreen',
    'VerificationDashboardScreen', 'ForgotPasswordScreen', 'OTPLoginScreen',
    'PhoneSignupScreen', 'PhoneNumberScreen', 'UserAuthScreen', 'ProviderAuthScreen',
]

FACTORY = """const makeC = (c) => ({
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  onSecondary: c.onBrandBlue,
  white: c.surface,
  bg: c.bg,
  sunken: c.surfaceSunken,
  // The shipped neutral hairline was #F1F5F9 -- exactly `bg` in light, and a recessed
  // seam on a dark surface.
  hairline: c.bg,
  line: c.border,
  borderMedium: c.borderMedium,
  text: c.textStrong,
  textDark: c.textPrimary,
  textBody: c.textBody,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  info: c.info,
  infoBg: c.infoContainer,
  infoFill: c.infoFill,
  indigo: c.altBlueIndigo,
  success: c.success,
  successBg: c.successContainer,
  successFill: c.successFill,
  danger: c.danger,
  onDanger: c.onDanger,
  dangerBg: c.dangerContainer,
  dangerFill: c.dangerFill,
  dangerLine: c.dangerBorder,
  warning: c.warning,
  warningBg: c.warningContainer,
  overlay: c.overlay,
  shadow: c.shadow,
});"""

BY_PROP = {
    # surfaces
    ('backgroundColor', '#FFFFFF'): 'C.white',
    ('backgroundColor', '#FFF'): 'C.white',
    ('backgroundColor', '#fff'): 'C.white',
    ('backgroundColor', '#F8FAFC'): 'C.sunken',
    ('backgroundColor', '#FAFBFC'): 'C.sunken',
    ('backgroundColor', '#F1F5F9'): 'C.hairline',
    ('backgroundColor', '#E2E8F0'): 'C.line',
    ('backgroundColor', '#CBD5E1'): 'C.borderMedium',
    # hairlines
    ('borderColor', '#E2E8F0'): 'C.line',
    ('borderColor', '#CBD5E1'): 'C.borderMedium',
    # ink
    ('color', '#1E293B'): 'C.text',
    ('color', '#0F172A'): 'C.textDark',
    ('color', '#475569'): 'C.textBody',
    ('color', '#64748B'): 'C.textSecondary',
    ('color', '#94A3B8'): 'C.muted',
    # brand
    ('backgroundColor', '#f67c16'): 'C.primary',
    ('borderColor', '#f67c16'): 'C.primary',
    ('shadowColor', '#f67c16'): 'C.primary',
    ('color', '#f67c16'): 'C.warning',  # brand orange as TEXT is 2.7:1 on white
    ('color', '#2b76bc'): 'C.info',
    ('backgroundColor', '#2b76bc'): 'C.secondary',
    ('borderColor', '#2563EB'): 'C.indigo',
    ('color', '#2563EB'): 'C.indigo',
    # vendor sign-in buttons: fixed by Google's and Apple's guidelines
    ('backgroundColor', '#4285F4'): 'vendor.googleBlue',
    ('backgroundColor', '#000000'): 'vendor.appleBlack',
    ('borderColor', '#000000'): 'vendor.appleBlack',
    # semantic
    ('backgroundColor', '#FEF2F2'): 'C.dangerBg',
    ('backgroundColor', '#FEE2E2'): 'C.dangerFill',
    ('borderColor', '#FCA5A5'): 'C.dangerLine',
    ('borderColor', '#FECACA'): 'C.dangerLine',
    ('color', '#EF4444'): 'C.danger',
    ('color', '#DC2626'): 'C.danger',
    ('color', '#991B1B'): 'C.danger',
    ('backgroundColor', '#FEF3C7'): 'C.warningBg',
    ('backgroundColor', '#FFF7ED'): 'C.warningBg',
    ('backgroundColor', '#FFFBEB'): 'C.warningBg',
    ('backgroundColor', '#FFFBF5'): 'C.warningBg',
    ('backgroundColor', '#FFF1E5'): 'C.warningBg',
    ('color', '#92400E'): 'C.warning',
    ('color', '#D97706'): 'C.warning',
    ('color', '#F59E0B'): 'C.warning',
    ('backgroundColor', '#ECFDF5'): 'C.successBg',
    ('backgroundColor', '#D1FAE5'): 'C.successFill',
    ('backgroundColor', 'rgba(16,185,129,0.08)'): 'C.successFill',
    ('color', '#10B981'): 'C.success',
    ('color', '#059669'): 'C.success',
    ('color', '#065F46'): 'C.success',
    ('backgroundColor', '#EFF6FF'): 'C.infoBg',
    ('backgroundColor', '#E9F1FA'): 'C.infoBg',
    ('backgroundColor', '#DBEAFE'): 'C.infoFill',
    # brand tints
    ('backgroundColor', 'rgba(246,124,22,0.04)'): 'brandTint.orange04',
    ('backgroundColor', 'rgba(246,124,22,0.06)'): 'brandTint.orange06',
    ('backgroundColor', 'rgba(246,124,22,0.07)'): 'brandTint.orange06',
    ('backgroundColor', 'rgba(246,124,22,0.08)'): 'brandTint.orange10',
    ('borderColor', 'rgba(246,124,22,0.2)'): 'stableDark.brandOrangeLine',
    ('borderColor', 'rgba(246,124,22,0.25)'): 'stableDark.brandOrangeLine',
    ('borderColor', 'rgba(246,124,22,0.3)'): 'stableDark.brandOrangeLine',
    ('backgroundColor', 'rgba(43,118,188,0.06)'): 'brandTint.blue06',
    ('backgroundColor', 'rgba(43,118,188,0.07)'): 'brandTint.blue06',
    ('backgroundColor', 'rgba(43,118,188,0.08)'): 'brandTint.blue08',
    ('borderColor', 'rgba(43,118,188,0.2)'): 'stableDark.brandBlueLine',
    # scrims, shadows, and ink on the brand-coloured hero
    ('backgroundColor', 'rgba(15, 23, 42, 0.5)'): 'C.overlay',
    ('backgroundColor', 'rgba(15,23,42,0.6)'): 'C.overlay',
    ('shadowColor', '#000'): 'C.shadow',
    ('shadowColor', '#0F172A'): 'C.shadow',
    ('backgroundColor', 'rgba(255,255,255,0.1)'): 'stableDark.heroDivider',
    ('backgroundColor', 'rgba(255,255,255,0.12)'): 'stableDark.fillChip',
    ('backgroundColor', 'rgba(255,255,255,0.15)'): 'stableDark.fill',
    ('color', 'rgba(255,255,255,0.7)'): 'stableDark.inkMuted',
    ('color', 'rgba(255,255,255,0.6)'): 'stableDark.inkDim',
}

BARE = {
    '#1E293B': 'C.text', '#0F172A': 'C.textDark', '#475569': 'C.textBody',
    '#64748B': 'C.textSecondary', '#94A3B8': 'C.muted', '#E2E8F0': 'C.line',
    '#F1F5F9': 'C.hairline', '#F8FAFC': 'C.sunken', '#FAFBFC': 'C.sunken',
    '#EF4444': 'C.danger', '#DC2626': 'C.danger', '#10B981': 'C.success',
    '#059669': 'C.success', '#F59E0B': 'C.warning', '#D97706': 'C.warning',
    '#92400E': 'C.warning', '#2b76bc': 'C.info', '#2563EB': 'C.indigo',
    '#ECFDF5': 'C.successBg', '#D1FAE5': 'C.successFill', '#EFF6FF': 'C.infoBg',
    '#DBEAFE': 'C.infoFill', '#FEF3C7': 'C.warningBg', '#FFF7ED': 'C.warningBg',
    '#FFFBEB': 'C.warningBg', '#FEE2E2': 'C.dangerFill', '#FFF1E5': 'C.warningBg',
    '#E9F1FA': 'C.infoBg',
    # brand orange as a bare value is nearly always an ICON; 2.7:1 as text on white
    '#f67c16': 'C.warning',
    # vendor
    '#4285F4': 'vendor.googleBlue', '#EA4335': 'vendor.googleRed',
    '#FBBC05': 'vendor.googleYellow', '#34A853': 'vendor.googleGreen',
    'rgba(255,255,255,0.55)': 'stableDark.inkSoft',
    'rgba(255,255,255,0)': 'stableDark.inkSoftFade',
    'rgba(246,124,22,0.06)': 'brandTint.orange06',
}

# Ink on a coloured fill — per file, because value alone cannot decide it.
INK = {
    'RegisterScreen':              {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'LoginScreen':                 {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'InsuranceScreen':             {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'VerificationScreen':          {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'UnifiedUserAuthScreen':       {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'OTPVerifyScreen':             {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'UserTypeScreen':              {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'VerificationDashboardScreen': {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'ForgotPasswordScreen':        {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'OTPLoginScreen':              {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'PhoneSignupScreen':           {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'PhoneNumberScreen':           {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'UserAuthScreen':              {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
    'ProviderAuthScreen':          {'#FFFFFF': 'C.onPrimary', '#FFF': 'C.onPrimary', '#fff': 'C.onPrimary'},
}

PROP_RE = re.compile(r'([A-Za-z]*[Cc]olor)\s*:\s*$')
Q = re.compile(r"'(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))'|\"(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\"")

report = {}
for name in FILES:
    p = f'src/screens/{name}.jsx'
    src = M.read(p)

    # Five of these DO have a module-level palette block, and two of them are already
    # named `C` — mapping literals to `C.x` while leaving the old block in place
    # collided on the identifier. Replace the block with the factory where one exists,
    # and only fall back to inserting above the sheet where there is none.
    PALETTE = {
        'InsuranceScreen': 'C', 'VerificationScreen': 'BRAND', 'UserTypeScreen': 'COLORS',
        'VerificationDashboardScreen': 'BRAND', 'ForgotPasswordScreen': 'COLORS',
    }
    blk = PALETTE.get(name)
    if blk:
        src = M.replace_block(src, f'const {blk} = {{', FACTORY)
        src = re.sub(r'\b' + blk + r'\.', 'C.', src)
    else:
        head = 'const styles = StyleSheet.create({'
        if head not in src:
            head = 'const s = StyleSheet.create({'
        i = src.index(head)
        src = src[:i] + FACTORY + '\n\n' + src[i:]

    lines = src.split('\n')
    unmapped = []
    ink = INK.get(name, {})
    for i, _ in enumerate(lines):
        while True:
            mm = Q.search(lines[i])
            if not mm:
                break
            raw = mm.group(0)
            lit = raw.strip('\'"')
            pm = PROP_RE.search(lines[i][:mm.start()])
            prop = pm.group(1) if pm else None
            tok = BY_PROP.get((prop, lit)) if prop else None
            if tok is None and prop == 'color' and lit in ink:
                tok = ink[lit]          # white ink sits on the brand fill
            if tok is None:
                tok = BARE.get(lit)
            if tok is None and lit in ink:
                tok = ink[lit]
            if tok is None:
                unmapped.append(f'{name} L{i+1} {prop or "?"} = {lit}')
                break
            if raw.startswith('"') and not prop:
                tok = '{' + tok + '}'
            lines[i] = lines[i][:mm.start()] + tok + lines[i][mm.end():]
    report[name] = unmapped
    if not unmapped:
        M.write(p, '\n'.join(lines))

bad = {k: v for k, v in report.items() if v}
if bad:
    print('UNMAPPED — nothing written for these:')
    for k, v in bad.items():
        for u in v[:5]:
            print('  ' + u)
    sys.exit(1)
print(f'all {len(FILES)} screens: every literal mapped')
