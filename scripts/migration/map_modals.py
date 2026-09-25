"""Map the ten modals reachable from themed screens onto tokens.

These share one gray-ramp palette, so the mapping is keyed by (property, literal)
rather than per-site. That handles the multi-role literals -- #FFFFFF is a fill in
one place and ink in another -- without hand-listing 300 sites.

Ink that sits ON a coloured fill cannot be decided by value, so those are listed
per file in INK. Anything left over is reported rather than guessed.
"""
import re
import sys

sys.path.insert(0, '/private/tmp/claude-501/-Users-shreyashsureshborkar-AXXXSXX-AXXASXX-App-FIXORA-FIXORA-APP-renfi-renfi/4425de67-bc5f-4576-afd7-10d95db36403/scratchpad')
import migrate as M

FILES = [
    'LocationPicker', 'ProviderDetailsModal', 'CancellationReasonModal', 'MapPickerModal',
    'RatingModal', 'AadhaarVerificationModal', 'AddressAutocomplete', 'PhoneChangeModal',
    'DateTimePicker', 'SavedAddresses',
]

# (property, literal) -> token. `?` matches a literal in any other position
# (a JSX prop, a ternary branch, an array entry).
BY_PROP = {
    # ── surfaces ──
    ('backgroundColor', '#FFFFFF'): 'C.white',
    ('backgroundColor', '#FFF'): 'C.white',
    ('backgroundColor', '#F9FAFB'): 'C.sunken',
    ('backgroundColor', '#F3F4F6'): 'C.sunken',
    ('backgroundColor', '#F8FAFC'): 'C.sunken',
    ('backgroundColor', '#FAFBFC'): 'C.sunken',
    ('backgroundColor', '#faf7f7'): 'C.bg',
    ('backgroundColor', '#F1F5F9'): 'C.hairline',
    ('backgroundColor', '#E5E7EB'): 'C.line',
    ('backgroundColor', '#E2E8F0'): 'C.line',
    ('backgroundColor', '#D1D5DB'): 'C.borderMedium',
    ('backgroundColor', '#9CA3AF'): 'C.muted',
    # ── hairlines ──
    ('borderColor', '#E5E7EB'): 'C.line',
    ('borderColor', '#E2E8F0'): 'C.line',
    ('borderColor', '#D1D5DB'): 'C.borderMedium',
    ('borderColor', '#F3F4F6'): 'C.sunken',
    ('borderBottomColor', '#F3F4F6'): 'C.sunken',
    ('borderBottomColor', '#E5E7EB'): 'C.line',
    ('borderTopColor', '#E5E7EB'): 'C.line',
    ('borderTopColor', '#F1F5F9'): 'C.hairline',
    ('borderTopColor', '#F3F4F6'): 'C.sunken',
    # ── ink ──
    ('color', '#1F2937'): 'C.text',
    ('color', '#111827'): 'C.text',
    ('color', '#0F172A'): 'C.text',
    ('color', '#1E293B'): 'C.textStrong',
    ('color', '#374151'): 'C.textBody',
    ('color', '#6B7280'): 'C.textSecondary',
    ('color', '#64748B'): 'C.textSecondary',
    ('color', '#9CA3AF'): 'C.muted',
    ('color', '#94A3B8'): 'C.muted',
    ('color', '#D1D5DB'): 'C.muted',
    ('color', '#CBD5E1'): 'C.borderMedium',
    # ── semantic ──
    ('color', '#EF4444'): 'C.danger',
    ('color', '#DC2626'): 'C.danger',
    ('color', '#991B1B'): 'C.danger',
    ('color', '#10B981'): 'C.success',
    ('color', '#16A34A'): 'C.success',
    ('color', '#B45309'): 'C.warning',
    ('color', '#92400E'): 'C.warning',
    ('color', '#2b76bc'): 'C.info',
    ('color', '#2563EB'): 'C.indigo',
    ('color', '#1D4ED8'): 'C.info',
    ('color', '#3B82F6'): 'C.accentSky',
    ('color', '#7C3AED'): 'C.purple',
    ('color', '#8B5CF6'): 'C.purple',
    ('backgroundColor', '#FEF2F2'): 'C.dangerBg',
    ('backgroundColor', '#FEE2E2'): 'C.dangerFill',
    ('backgroundColor', '#FCA5A5'): 'C.dangerLine',
    ('borderColor', '#FECACA'): 'C.dangerLine',
    ('borderColor', '#FCA5A5'): 'C.dangerLine',
    ('borderColor', '#EF4444'): 'C.danger',
    ('borderColor', '#DC2626'): 'C.danger',
    ('backgroundColor', '#DC2626'): 'C.danger',
    ('backgroundColor', '#FFFBEB'): 'C.warningBg',
    ('backgroundColor', '#FEF3C7'): 'C.warningBg',
    ('borderColor', '#FDE68A'): 'C.warningLine',
    ('backgroundColor', '#ECFDF5'): 'C.successBg',
    ('backgroundColor', '#DCFCE7'): 'C.successFill',
    ('backgroundColor', '#D1FAE5'): 'C.successFill',
    ('backgroundColor', '#EFF6FF'): 'C.infoBg',
    ('backgroundColor', '#DBEAFE'): 'C.infoFill',
    ('backgroundColor', '#EAF2FB'): 'C.infoBg',
    ('backgroundColor', '#B7CDE6'): 'C.infoFill',
    ('backgroundColor', '#F3E8FF'): 'C.purpleBg',
    ('backgroundColor', '#2b76bc'): 'C.secondary',
    ('backgroundColor', '#2563EB'): 'C.indigo',
    ('borderColor', '#2563EB'): 'C.indigo',
    ('backgroundColor', '#3B82F6'): 'C.accentSky',
    # ── platform tints (see PortfolioEditScreen: the identity colour at 10%) ──
    ('backgroundColor', '#E0F2FE'): "iconAccent.website + '1A'",
    ('backgroundColor', '#FCE7F3'): "iconAccent.instagram + '1A'",
    ('backgroundColor', '#E0F7FA'): "iconAccent.twitter + '1A'",
    # ── scrims + shadows ──
    ('backgroundColor', 'rgba(15, 23, 42, 0.6)'): 'C.overlay',
    ('backgroundColor', 'rgba(15, 23, 42, 0.55)'): 'C.overlay',
    ('backgroundColor', 'rgba(15,23,42,0.45)'): 'C.overlay',
    ('backgroundColor', 'rgba(0, 0, 0, 0.5)'): 'C.overlay',
    ('backgroundColor', 'rgba(0,0,0,0.2)'): 'C.overlay',
    ('shadowColor', '#000'): 'C.shadow',
    ('shadowColor', '#0F172A'): 'C.shadow',
}

# Bare literals (JSX props, ternary branches). Same value, no property context.
BARE = {
    '#1F2937': 'C.text', '#111827': 'C.text', '#0F172A': 'C.text', '#1E293B': 'C.textStrong',
    '#374151': 'C.textBody', '#6B7280': 'C.textSecondary', '#64748B': 'C.textSecondary',
    '#9CA3AF': 'C.muted', '#94A3B8': 'C.muted', '#D1D5DB': 'C.muted', '#CBD5E1': 'C.borderMedium',
    '#E5E7EB': 'C.line', '#E2E8F0': 'C.line', '#F1F5F9': 'C.hairline', '#F9FAFB': 'C.sunken',
    '#F8FAFC': 'C.sunken', '#faf7f7': 'C.bg',
    '#EF4444': 'C.danger', '#DC2626': 'C.danger', '#991B1B': 'C.danger',
    '#10B981': 'C.success', '#16A34A': 'C.success',
    '#F59E0B': 'C.warning', '#B45309': 'C.warning', '#FF6B00': 'C.primary',
    '#f67c16': 'C.primary', '#2b76bc': 'C.info', '#2563EB': 'C.indigo',
    '#1D4ED8': 'C.info', '#3B82F6': 'C.accentSky', '#7C3AED': 'C.purple', '#8B5CF6': 'C.purple',
    '#ECFDF5': 'C.successBg', '#FFFBEB': 'C.warningBg', '#EFF6FF': 'C.infoBg',
    '#DBEAFE': 'C.infoFill', '#FDE68A': 'C.warningLine',
    '#0284C7': 'iconAccent.website', '#DB2777': 'iconAccent.instagram',
    '#0EA5E9': 'iconAccent.twitter',
    'rgba(0, 0, 0, 0.6)': 'mapOverlay.hint',
}

# Ink on a coloured fill — cannot be decided by value.
INK = {
    'LocationPicker': {"color: '#FFFFFF'": 'color: C.onSecondary', '"#FFFFFF"': '{C.onSecondary}'},
    'ProviderDetailsModal': {"color: '#FFFFFF'": 'color: C.onPrimary', '"#FFFFFF"': '{C.onPrimary}',
                             "color: '#FFF'": 'color: C.onPrimary', '"#FFF"': '{C.onPrimary}'},
    'CancellationReasonModal': {"color: '#FFFFFF'": 'color: C.onDanger', '"#FFFFFF"': '{C.onDanger}'},
    'MapPickerModal': {"color: '#FFFFFF'": 'color: C.onSecondary', '"#FFFFFF"': '{C.onSecondary}'},
    'RatingModal': {"color: '#FFFFFF'": 'color: C.onPrimary', '"#FFFFFF"': '{C.onPrimary}'},
    'AadhaarVerificationModal': {"color: '#FFFFFF'": 'color: C.onPrimary', '"#FFFFFF"': '{C.onPrimary}'},
    'AddressAutocomplete': {"color: '#FFFFFF'": 'color: C.onSecondary', '"#FFFFFF"': '{C.onSecondary}'},
    'PhoneChangeModal': {"color: '#FFFFFF'": 'color: C.onPrimary', '"#FFFFFF"': '{C.onPrimary}'},
    'DateTimePicker': {"color: '#FFFFFF'": 'color: C.onSecondary', '"#FFFFFF"': '{C.onSecondary}',
                       "color: '#FFF'": 'color: C.onSecondary', '"#FFF"': '{C.onSecondary}'},
    'SavedAddresses': {"color: '#FFFFFF'": 'color: C.onPrimary', '"#FFFFFF"': '{C.onPrimary}'},
}

FACTORY = """const makeC = (c) => ({
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  onSecondary: c.onBrandBlue,
  onSuccess: c.onSuccess,
  white: c.surface,
  bg: c.bg,
  sunken: c.surfaceSunken,
  // The shipped neutral hairline was #F1F5F9 -- exactly `bg` in light, a recessed
  // seam on a dark surface.
  hairline: c.bg,
  line: c.borderNeutral,
  borderMedium: c.borderMediumNeutral,
  text: c.textStrongNeutral,
  textStrong: c.textStrong,
  textBody: c.textBodyNeutral,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  info: c.info,
  infoBg: c.infoContainer,
  infoFill: c.infoFill,
  indigo: c.altBlueIndigo,
  accentSky: c.altBlueSky,
  purple: c.accentViolet,
  purpleBg: c.accentVioletContainer,
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
  warningLine: c.warningBorder,
  overlay: c.overlay,
  shadow: c.shadow,
});"""

PROP_RE = re.compile(r'([A-Za-z]*[Cc]olor)\s*:\s*$')
Q = re.compile(r"'(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))'|\"(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\"")

# The palette block must be replaced BEFORE scanning, or its own entries
# (`white: '#FFFFFF'`) get mapped circularly.
PALETTE = {
    'LocationPicker': 'BRAND', 'ProviderDetailsModal': 'BRAND', 'MapPickerModal': 'BRAND',
    'RatingModal': 'BRAND', 'AadhaarVerificationModal': 'COLORS', 'DateTimePicker': 'COLORS',
    'SavedAddresses': 'COLORS',
}

# Ink on a SELECTED (filled) chip — the value alone cannot tell you the fill.
SELECTED = {
    'LocationPicker': {
        "color={selected ? '#FFFFFF' : '#3B82F6'}": 'color={selected ? C.onSecondary : C.accentSky}',
        "color={selected ? '#FFFFFF' : '#374151'}": 'color={selected ? C.onSecondary : C.textBody}',
    },
    'AadhaarVerificationModal': {
        '<ActivityIndicator color="#FFF" size="small" />': '<ActivityIndicator color={C.onPrimary} size="small" />',
        '<MaterialIcon name="verified-user" size={20} color="#FFF" />': '<MaterialIcon name="verified-user" size={20} color={C.onPrimary} />',
        '<MaterialIcon name="check-circle-outline" size={20} color="#FFF" />': '<MaterialIcon name="check-circle-outline" size={20} color={C.onPrimary} />',
        '<MaterialIcon name="refresh" size={20} color="#FFF" />': '<MaterialIcon name="refresh" size={20} color={C.onPrimary} />',
        '<MaterialIcon name="check" size={44} color="#FFF" />': '<MaterialIcon name="check" size={44} color={C.onSuccess} />',
        "color: '#FFF',": 'color: C.onPrimary,',
    },
    'DateTimePicker': {
        "const textColor = selected ? '#FFFFFF' : (isInstant ? '#B45309' : COLORS.text);":
            'const textColor = selected ? C.onSecondary : (isInstant ? C.warning : C.text);',
        "color={selected ? '#FFF' : '#F59E0B'}": 'color={selected ? C.onSecondary : C.warning}',
    },
}

report = {}
for name in FILES:
    p = f'src/components/{name}.jsx'
    src = M.read(p)

    # longest/most-specific first, so these win over the generic tables
    src, _ = M.apply_rules(src, SELECTED.get(name, {}), require_all=False)
    src, _ = M.apply_rules(src, INK.get(name, {}), require_all=False)

    blk = PALETTE.get(name)
    if blk:
        src = M.replace_block(src, f'const {blk} = {{', FACTORY)
    else:
        i = src.index('const styles = StyleSheet.create({')
        src = src[:i] + FACTORY + '\n\n' + src[i:]

    lines = src.split('\n')
    unmapped = []
    for i, line in enumerate(lines):
        while True:
            mm = Q.search(lines[i])
            if not mm:
                break
            lit = mm.group(0).strip('\'"')
            pm = PROP_RE.search(lines[i][:mm.start()])
            prop = pm.group(1) if pm else None
            tok = BY_PROP.get((prop, lit)) if prop else None
            if tok is None:
                tok = BARE.get(lit)
            if tok is None:
                unmapped.append(f"{name} L{i+1} {prop or '?'} = {lit}")
                break
            # a bare literal in JSX needs brace form
            quoted = mm.group(0)
            if quoted.startswith('"') and not prop and not tok.startswith('{'):
                tok = '{' + tok + '}'
            lines[i] = lines[i][:mm.start()] + tok + lines[i][mm.end():]
    report[name] = unmapped
    if not unmapped:
        M.write(p, '\n'.join(lines))

bad = {k: v for k, v in report.items() if v}
if bad:
    print('UNMAPPED — nothing written for these files:')
    for k, v in bad.items():
        for u in v[:6]:
            print('  ' + u)
    sys.exit(1)
print(f'all {len(FILES)} files: every literal mapped')
