# Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `ProfileScreen.jsx` (User + Provider) into a flat, LinkedIn-style, sectioned layout with an immersive gradient header and per-section inline editing — using only existing data, no backend changes.

**Architecture:** Single file `src/screens/ProfileScreen.jsx` refactored in place. The one global `isEditing` boolean becomes `editingSection` (`null | 'identity' | 'contact' | 'experience' | 'about'`). A shared `saveProfileFields(fields)` helper wraps the existing `performSave` logic to submit partial updates. View mode renders flat sections separated by grey bands instead of shadowed cards. Header uses `react-native-linear-gradient` bleeding under the status bar via safe-area insets.

**Tech Stack:** React Native 0.81, `react-native-linear-gradient` (installed), `react-native-svg` (installed), `react-native-safe-area-context`, i18n (`src/i18n/{en,hi,mr}.js`). No new dependencies.

## Global Constraints

- **No new data fields, no backend/DB/API changes.** Presentation + edit-routing only. Every value already exists in the fetched profile.
- **No new npm dependencies.** Gradient = `react-native-linear-gradient` (`import LinearGradient from 'react-native-linear-gradient'`, the app's existing convention). Art = `react-native-svg`.
- **Preserve every route target verbatim:** `DocumentVerification`, `PortfolioEdit`, `Subscription`, `Favorites`, `Verification` ({ verificationType:'email' }), the Saved Addresses modal, the Aadhaar modal, `navigation.goBack()`.
- **Preserve iOS behaviors:** swipe-back gesture (no full-screen blocking modals for editors — use in-place Views), `KeyboardAvoidingView` (iOS `padding`), `useSafeAreaInsets`, `DateTimePicker` iOS spinner + Done button, image-picker, SMS OTP autofill props, status-bar handling.
- **Brand colors:** User blue `#2b76bc` (dark `#1e5f9e`); Provider orange `#f67c16` (dark `#EA580C`). Ink `#0F172A`, muted `#64748B`, faint `#94A3B8`, divider `#EDF1F6`, band `#F4F6FA`, green `#16A34A`.
- **Do NOT show User ID** anywhere. Footer = "Member since" only.
- **i18n:** every user-visible string via `t(...)`; add new keys to all three locales (`en.js`, `hi.js`, `mr.js`).
- **Verification per task:** `npm run lint` must pass; then the task's manual-QA items from the spec §8. Commit after each task.
- Reference spec: `docs/superpowers/specs/2026-07-09-profile-redesign-design.md`.

---

### Task 1: i18n keys for the new sections

**Files:**
- Modify: `src/i18n/en.js` (`profile` + `experience` objects)
- Modify: `src/i18n/hi.js` (same keys, Hindi)
- Modify: `src/i18n/mr.js` (same keys, Marathi)

**Interfaces:**
- Produces (new `profile.*` keys used by later tasks): `about`, `aboutEmptyPrompt`, `addAbout`, `services`, `experienceSection`, `contactLocation`, `statJobs`, `statRating`, `statExperience`, `statReviews`, `ratingReviews` (`"{{rating}} · {{count}} reviews"`), `jobsCompleted` (`"{{count}} jobs completed"`), `memberSince` (`"Member since {{date}}"`), `newProvider`, `saveSection`, `cancelEdit`, `bioPlaceholderProfile`.

- [ ] **Step 1: Add English keys.** In `src/i18n/en.js`, inside the `profile: { ... }` object add:

```js
about: 'About',
aboutEmptyPrompt: 'Add a short intro about your work — helps customers choose you.',
addAbout: 'Add about',
services: 'Services',
experienceSection: 'Experience',
contactLocation: 'Contact & location',
statJobs: 'Jobs done',
statRating: 'Rating',
statExperience: 'Experience',
statReviews: 'Reviews',
ratingReviews: '{{rating}} rating · {{count}} reviews',
jobsCompleted: '{{count}} jobs completed',
memberSince: 'Member since {{date}}',
newProvider: 'New',
saveSection: 'Save',
cancelEdit: 'Cancel',
bioPlaceholderProfile: 'Tell customers about your work, skills and experience…',
```

- [ ] **Step 2: Add Hindi keys** to `src/i18n/hi.js` `profile` object (translated):

```js
about: 'परिचय',
aboutEmptyPrompt: 'अपने काम के बारे में एक छोटा परिचय जोड़ें — ग्राहकों को चुनने में मदद करता है।',
addAbout: 'परिचय जोड़ें',
services: 'सेवाएँ',
experienceSection: 'अनुभव',
contactLocation: 'संपर्क और स्थान',
statJobs: 'पूर्ण कार्य',
statRating: 'रेटिंग',
statExperience: 'अनुभव',
statReviews: 'समीक्षाएँ',
ratingReviews: '{{rating}} रेटिंग · {{count}} समीक्षाएँ',
jobsCompleted: '{{count}} कार्य पूर्ण',
memberSince: '{{date}} से सदस्य',
newProvider: 'नया',
saveSection: 'सहेजें',
cancelEdit: 'रद्द करें',
bioPlaceholderProfile: 'ग्राहकों को अपने काम, कौशल और अनुभव के बारे में बताएं…',
```

- [ ] **Step 3: Add Marathi keys** to `src/i18n/mr.js` `profile` object (translated):

```js
about: 'परिचय',
aboutEmptyPrompt: 'तुमच्या कामाबद्दल थोडक्यात माहिती जोडा — ग्राहकांना निवडण्यास मदत होते.',
addAbout: 'परिचय जोडा',
services: 'सेवा',
experienceSection: 'अनुभव',
contactLocation: 'संपर्क आणि स्थान',
statJobs: 'पूर्ण कामे',
statRating: 'रेटिंग',
statExperience: 'अनुभव',
statReviews: 'पुनरावलोकने',
ratingReviews: '{{rating}} रेटिंग · {{count}} पुनरावलोकने',
jobsCompleted: '{{count}} कामे पूर्ण',
memberSince: '{{date}} पासून सदस्य',
newProvider: 'नवीन',
saveSection: 'जतन करा',
cancelEdit: 'रद्द करा',
bioPlaceholderProfile: 'ग्राहकांना तुमचे काम, कौशल्ये आणि अनुभव सांगा…',
```

- [ ] **Step 4: Verify interpolation matches the app's i18n.** Confirm existing keys use `{{var}}` (double-brace) by grepping: `grep -n "ratingValue" src/i18n/en.js`. If the app uses `%{var}` style instead, convert the new keys to match. Fix before commit.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/i18n/en.js src/i18n/hi.js src/i18n/mr.js
git commit -m "i18n(profile): add keys for redesigned profile sections"
```

---

### Task 2: Edit-state refactor + shared partial-save helper (behavior-preserving)

Refactor the single edit flow into per-section state and a shared save helper, **without changing the current UI yet** — the existing form keeps working, just driven by the new plumbing. This isolates the risky logic change so it can be verified before any visual change.

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (state near line 296–299; `handleSave`/`performSave` around 694–863)

**Interfaces:**
- Produces:
  - `editingSection` state: `const [editingSection, setEditingSection] = useState(null)` — values `null | 'identity' | 'contact' | 'experience' | 'about'`.
  - `const isEditing = editingSection !== null` (keeps existing `isEditing` reads working during migration).
  - `saveProfileFields(fields: object): Promise<boolean>` — takes **semantic** fields (`fullName`, `phone` raw-10-digit, `address`, `city`, `pincode`, `bio`, `experienceStartDate` ISO|null), maps them to the role-specific payload exactly like `performSave` (provider uses `name`; phone gets `'+91'` prefix), submits a **partial** update, refreshes profile (+ verification when name/phone changed), closes the section on success, returns success boolean.
  - `bio` added to `formData` initial state and prefill (from `displayData?.bio`).

- [ ] **Step 1:** Replace `const [isEditing, setIsEditing] = useState(false);` with:

```js
const [editingSection, setEditingSection] = useState(null); // null | 'identity' | 'contact' | 'experience' | 'about'
const isEditing = editingSection !== null;
```

- [ ] **Step 2:** Update all existing `setIsEditing(true)` → `setEditingSection('identity')` and `setIsEditing(false)` → `setEditingSection(null)` (there are calls in the header edit/cancel buttons and after save). Grep to find them: `grep -n "setIsEditing" src/screens/ProfileScreen.jsx`.

- [ ] **Step 3:** Add `bio: displayData?.bio || ''` to the `formData` initial object (line ~302) and to the prefill `initial` object (line ~566) and its dependency array; add `bio: '',` to the reset shape.

- [ ] **Step 4:** Add the shared helper (place after `performSave`, ~line 863). It reuses `performSave`'s update call shape but sends only `fields`:

```js
/**
 * Save a section's fields as a partial update.
 * Takes SEMANTIC fields and maps them to the role-specific payload exactly
 * like performSave (provider name key = 'name'; phone gets '+91'). Only the
 * provided fields are sent, so Java-Auth sync only fires for name/phone.
 * Returns true on success.
 */
const saveProfileFields = useCallback(async (fields) => {
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  if (!userId) {
    dialog(t('profile.couldntSave'), t('profile.couldntSaveMsg'));
    return false;
  }
  setSaving(true);
  try {
    const payload = {};
    if (fields.fullName !== undefined) payload[isProvider ? 'name' : 'fullName'] = fields.fullName;
    if (fields.phone !== undefined) payload.phone = '+91' + fields.phone;
    if (fields.address !== undefined) payload.address = fields.address;
    if (fields.city !== undefined) payload.city = fields.city;
    if (fields.pincode !== undefined) payload.pincode = fields.pincode;
    if (fields.bio !== undefined) payload.bio = fields.bio;
    if (fields.experienceStartDate !== undefined) payload.experienceStartDate = fields.experienceStartDate;

    const updateFn = isProvider ? updateProviderProfile : updateUserProfile;
    const result = await updateFn(userId, payload);
    if (!result?.success) {
      const code = result?.error?.code || result?.error?.response?.data?.code;
      if (code === 'PHONE_ALREADY_EXISTS' || result?.error?.status === 409) {
        dialog(t('profile.phoneConflict'), t('profile.phoneConflictMsg'));
      } else if (code === 'PROFILE_CONFLICT' || code === 'NAME_LOCKED') {
        dialog(t('profile.nameLocked'), t('profile.nameLockedMsg'));
      } else {
        dialog(t('profile.couldntSave'), getErrorMessage(result?.error, t('profile.couldntSaveMsg')));
      }
      return false;
    }
    await refreshProfile(userType, userId, { force: true });
    if (fields.phone !== undefined || fields.fullName !== undefined) await refreshVerificationStatus?.();
    setEditingSection(null);
    return true;
  } catch (e) {
    dialog(t('profile.connectionIssue'), t('profile.connectionIssueMsg'));
    return false;
  } finally {
    setSaving(false);
  }
}, [user, profile, isProvider, userType, refreshProfile, refreshVerificationStatus, dialog, t]);
```

- [ ] **Step 5: Lint.** `npm run lint` — fix any unused-var or missing-dep warnings introduced.

- [ ] **Step 6: Manual smoke (existing UI still works).** Run the app (`npm run ios` or `npm run android`). Open Profile → tap the existing top Edit → change name → Save. Confirm it still saves and exits edit (behavior unchanged). This proves the state/helper refactor is sound before the visual rewrite.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "refactor(profile): per-section edit state + shared partial-save helper"
```

---

### Task 3: Presentational building blocks + styles (SectionBand, ProfileSection, DetailRow, StatStrip)

Add reusable flat-section components and their styles. They are consumed starting Task 4, so add them together with a temporary render of `StatStrip`/`ProfileSection` is not needed — instead define them now and Task 4+ use them (define-then-use across tasks is acceptable per plan; eslint won't flag module-scope components as unused only if referenced — so we add them in the same commit as Task 4's first use is NOT required because they're top-level `const` components referenced later in the file… but eslint `no-unused-vars` WILL flag an unused top-level const). **Therefore:** implement Task 3 and Task 4 as one commit boundary is avoided by having Task 3 wire `StatStrip` into the header is premature. To keep lint green, Task 3 adds the components AND immediately uses them in Task 4; commit at end of Task 4. Task 3 below only adds styles + component definitions and is committed together with Task 4.**

> Note: Task 3 has no standalone commit — its deliverable lands with Task 4 to keep lint green (no unused components). Do Task 3 steps, then continue into Task 4, then commit once.

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (add components after `EditableField` ~line 220; add styles in the `StyleSheet.create` block)

**Interfaces:**
- Produces:
  - `<SectionBand />` — the 9px grey separator between sections.
  - `<ProfileSection title icon? action? onAction? editable? onEdit? children />` — flat white section with bold title + optional right affordance (edit pencil when `editable`, or a text `action` link).
  - `<DetailRow icon label value right? muted? />` — light label→value row (reuses `Icon`/`MaterialIcon`).
  - `<StatStrip items />` where `items: {value:string, label:string, star?:boolean}[]` — the provider hero stat strip.

- [ ] **Step 1: Add components** after `EditableField` (~line 220):

```jsx
const SectionBand = React.memo(() => <View style={styles.sectionBand} />);

const ProfileSection = React.memo(({ title, action, onAction, editable, onEdit, children, actionColor }) => (
  <View style={styles.profileSection}>
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {editable ? (
        <TouchableOpacity style={styles.sectionEditBtn} onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcon name="edit" size={16} color="#64748B" />
        </TouchableOpacity>
      ) : action ? (
        <TouchableOpacity style={styles.sectionActionLink} onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.sectionActionText, actionColor && { color: actionColor }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {children}
  </View>
));

const DetailRow = React.memo(({ iconName, materialIcon, label, value, right, muted }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      {materialIcon
        ? <MaterialIcon name={materialIcon} size={18} color="#64748B" />
        : <Icon name={iconName} size={18} color="#64748B" />}
    </View>
    <View style={styles.detailText}>
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detailValue, muted && styles.detailValueMuted]} numberOfLines={2}>{value}</Text>
    </View>
    {right}
  </View>
));

const StatStrip = React.memo(({ items }) => (
  <View style={styles.statStrip}>
    {items.map((it, i) => (
      <React.Fragment key={it.label}>
        {i > 0 && <View style={styles.statDivider} />}
        <View style={styles.statCell}>
          <Text style={[styles.statValue, it.star && styles.statValueStar]}>
            {it.value}{it.sub ? <Text style={styles.statSub}> {it.sub}</Text> : null}
          </Text>
          <Text style={styles.statLabel}>{it.label}</Text>
        </View>
      </React.Fragment>
    ))}
  </View>
));
```

- [ ] **Step 2: Add styles** into `StyleSheet.create` (append near related styles):

```js
sectionBand: { height: 9, backgroundColor: '#F4F6FA', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EDF1F6' },
profileSection: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
sectionTitleText: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
sectionEditBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
sectionActionLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
sectionActionText: { fontSize: 13, fontWeight: '700', color: '#2b76bc' },
detailRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EDF1F6' },
detailIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
detailText: { flex: 1, minWidth: 0 },
detailLabel: { fontSize: 10.5, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
detailValue: { fontSize: 15, fontWeight: '600', color: '#0F172A', lineHeight: 20 },
detailValueMuted: { color: '#94A3B8', fontWeight: '500' },
statStrip: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 2, borderWidth: 1, borderColor: '#EDF1F6', borderRadius: 16, backgroundColor: '#FCFDFE', overflow: 'hidden' },
statCell: { flex: 1, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 4 },
statDivider: { width: 1, backgroundColor: '#EDF1F6' },
statValue: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
statValueStar: { color: '#F59E0B' },
statSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
statLabel: { fontSize: 10.5, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 3 },
```

- [ ] **Step 3:** Detail note — `detailRow`'s first child gets a top border via `borderTopWidth`; to drop the border on the first row in a section, later tasks pass rows as an array and this is acceptable visually (thin hairline). If a seamless first row is required, add `firstRow` prop toggling `borderTopWidth:0`; not required for MVP.

(No commit — continues into Task 4.)

---

### Task 4: Immersive gradient header + hero body (both roles)

Replace the current white app-bar (`header` ~line 1192) and hero `profileCard` (~1229–1375) with the gradient-bleed header + flat hero body. Removes the top-right global Edit button; adds the hero edit pencil (opens `identity` editor). Commits Task 3 + Task 4 together.

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (imports; render header+hero; styles)

**Interfaces:**
- Consumes: `StatStrip`, `editingSection`, `setEditingSection`, `displayData`, `insets`, `formatExperience`.
- Produces: header markup with `LinearGradient`; hero body with avatar (existing upload handlers), name/headline/location, `StatStrip` (provider), verification chips, warning.

- [ ] **Step 1: Add import** at top with other imports:

```js
import LinearGradient from 'react-native-linear-gradient';
```

- [ ] **Step 2: Compute headline + stat items** just before `return (` (~line 1186):

```js
const headline = isProvider
  ? ((displayData?.verifiedServiceCategories || displayData?.serviceCategories || []).slice(0, 2).map(formatServiceName).join(' · ') || t('profile.serviceProvider'))
  : t('profile.user');
const expText = formatExperience(displayData?.experienceStartDate, displayData?.experience, t);
const completedJobs = displayData?.stats?.completedRequests || 0;
const reviewCount = displayData?.ratings?.total || 0;
const ratingAvg = displayData?.ratings?.average || displayData?.rating || 0;
const statItems = [
  { value: String(completedJobs), label: t('profile.statJobs') },
  ratingAvg > 0
    ? { value: Number(ratingAvg).toFixed(1), sub: reviewCount > 0 ? `(${reviewCount})` : undefined, label: t('profile.statRating'), star: true }
    : { value: t('profile.newProvider'), label: t('profile.statRating'), star: true },
  { value: expText || t('profile.newProvider'), label: t('profile.statExperience') },
];
const headerColors = isProvider
  ? ['#FFF3EA', '#FBDDC5', '#f6851f', '#EA580C']
  : ['#E9F2FB', '#CBE1F5', '#3a86cf', '#1e5f9e'];
```

- [ ] **Step 3: Replace** the existing `<View style={[styles.header ...]}>...</View>` block AND the `<View style={styles.profileCard}>...</View>` block with the new header+hero. Set `StatusBar` to `dark-content` (already done in `useFocusEffect`). New markup:

```jsx
{/* Immersive gradient header (bleeds under the status bar) */}
<LinearGradient
  colors={headerColors}
  locations={[0, 0.15, 0.56, 1]}
  style={styles.gHeader}
>
  <View style={{ height: insets.top }} />
  <View style={styles.gNav}>
    <TouchableOpacity style={styles.gBackBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Icon name="arrow_back" size={22} color="#0F172A" />
    </TouchableOpacity>
    <Text style={styles.gNavTitle}>{t('profile.title')}</Text>
    <View style={{ width: 40 }} />
  </View>
  <View style={styles.gBand}>
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 400 70" preserveAspectRatio="xMidYMid slice">
        <Path d="M0 55 Q60 25 130 45 T260 32 T400 48" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" fill="none" />
        <Path d="M0 64 Q80 36 170 54 T340 40 T400 60" stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
        <Circle cx="342" cy="12" r="40" fill="rgba(255,255,255,0.06)" />
        <Circle cx="60" cy="8" r="26" fill="rgba(255,255,255,0.05)" />
      </Svg>
    </View>
    <View style={styles.gTypeBadge}>
      <Icon name={isProvider ? 'provider' : 'user'} size={12} color="#FFFFFF" />
      <Text style={styles.gTypeBadgeText}>{isProvider ? t('profile.serviceProvider') : t('profile.user')}</Text>
    </View>
  </View>
</LinearGradient>

{/* Hero body (white) */}
<View style={styles.heroBody}>
  <View style={styles.heroTopRow}>
    <TouchableOpacity style={styles.heroAvatarWrap} onPress={() => setShowImagePickerModal(true)} disabled={uploadingPicture}>
      <View style={[styles.avatarRing, isProvider && styles.avatarRingProvider]}>
        {displayData?.profilePicture?.url ? (
          <Image source={{ uri: autoOrient(displayData.profilePicture.url) }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, isProvider && styles.avatarProvider]}>
            <Text style={styles.avatarText}>
              {displayData?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.cameraIconOverlay, isProvider && styles.cameraIconOverlayProvider]}>
        {uploadingPicture ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcon name="camera-alt" size={14} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
    <TouchableOpacity style={styles.heroEditBtn} onPress={() => setEditingSection('identity')} activeOpacity={0.8}>
      <MaterialIcon name="edit" size={15} color="#0F172A" />
      <Text style={styles.heroEditText}>{t('profile.edit')}</Text>
    </TouchableOpacity>
  </View>

  <View style={styles.heroIdBlock}>
    <View style={styles.heroNameRow}>
      <Text style={styles.heroName} numberOfLines={2}>{displayData?.fullName || t('profile.userFallback')}</Text>
      {isProvider && premiumLoaded && isPremiumActive && (
        <View style={styles.proBadge}>
          <MaterialIcon name="workspace-premium" size={13} color="#D97706" />
          <Text style={styles.proBadgeText}>{t('profile.proBadge')}</Text>
        </View>
      )}
    </View>
    <Text style={[styles.heroHeadline, isProvider ? styles.heroHeadlineProvider : styles.heroHeadlineUser]} numberOfLines={1}>{headline}</Text>
    {!!displayData?.city && (
      <View style={styles.heroLocRow}>
        <MaterialIcon name="location-on" size={14} color="#64748B" />
        <Text style={styles.heroLocText} numberOfLines={1}>{displayData.city}</Text>
      </View>
    )}
  </View>

  {isProvider && (premiumLoaded ? <StatStrip items={statItems} /> : null)}

  <View style={styles.verificationSummary}>
    {/* keep the existing three verification pills exactly (phone/email + provider KYC) */}
  </View>
  {!isVerified && (
    <View style={styles.verifyWarning}>
      <Icon name="warning" size={15} color="#f67c16" />
      <Text style={styles.verifyWarningText} numberOfLines={2}>{t('profile.verifyWarning')}</Text>
    </View>
  )}
</View>
```

> Port the existing verification-pills JSX (current lines ~1321–1364) into the `verificationSummary` View unchanged.

- [ ] **Step 4: Add styles:**

```js
gHeader: { width: '100%' },
gNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 2 },
gBackBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
gNavTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
gBand: { height: 56, position: 'relative', justifyContent: 'flex-end' },
gTypeBadge: { position: 'absolute', right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.24)', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
gTypeBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
heroBody: { backgroundColor: '#FFFFFF' },
heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16 },
heroAvatarWrap: { marginTop: -44 },
heroEditBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
heroEditText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
heroIdBlock: { paddingHorizontal: 16, paddingTop: 8 },
heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
heroName: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
heroHeadline: { fontSize: 14.5, fontWeight: '700', marginTop: 4 },
heroHeadlineProvider: { color: '#EA580C' },
heroHeadlineUser: { color: '#2b76bc' },
heroLocRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
heroLocText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
```

Reuse existing `avatarRing`, `avatar*`, `cameraIconOverlay*`, `avatarText`, `proBadge*`, `verificationSummary`, `verifyWarning*` styles (already present). Adjust `verificationSummary` to left-align: set `justifyContent: 'flex-start'` and `paddingHorizontal: 16`, `paddingTop: 14`, `paddingBottom: 16`.

- [ ] **Step 5:** Remove now-dead styles later (Task 8). For now leave old `header`, `profileCard*`, `profileCardHeader*`, `profileBannerBadge*`, `profileAvatarWrap`, `profileCardBody`, `profileName*`, `profileContactRow*` in place (unused styles don't break lint).

- [ ] **Step 6: Lint + manual QA.** `npm run lint`. Run app both roles: header gradient bleeds under status bar; clock readable; back + title visible; type badge icon aligned; avatar overlaps; provider stat strip shows jobs/rating/exp; user has no strip; verification pills + warning correct; tap hero Edit → `editingSection==='identity'` (identity editor comes in Task 5, so for now it may show nothing below — acceptable mid-build).

- [ ] **Step 7: Commit (Tasks 3+4)**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "feat(profile): immersive gradient header + flat hero + stat strip"
```

---

### Task 5: Identity inline editor + Provider view sections (About/Services/Experience/Portfolio) with editors

Replace the provider branch of the old `isEditing ? (form) : (Personal Info)` block with: (a) an **identity editor** shown in the hero area when `editingSection==='identity'`, and (b) flat provider sections. Also implement the **about** and **experience** inline editors.

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (render body ~1502–2018; styles)

**Interfaces:**
- Consumes: `ProfileSection`, `SectionBand`, `DetailRow`, `saveProfileFields`, `editingSection`, `formData`, `experienceStartDate`, existing services/portfolio JSX + styles.
- Produces: provider view sections + identity/about/experience editors.

- [ ] **Step 1: Identity editor.** Directly under the hero `heroIdBlock` (Task 4), render an inline editor when active. Insert after `heroIdBlock` View:

```jsx
{editingSection === 'identity' && (
  <View style={styles.inlineEditor}>
    <EditableField
      label={t('profile.fullNameLabel')}
      value={formData.fullName}
      onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
      placeholder={t('profile.fullNamePlaceholder')}
      locked={isProvider && isNameLocked}
      lockedLabel={t('profile.locked')}
      lockMessage={isNameLocked ? `Verified as "${aadhaarName || formData.fullName}" via Aadhaar` : undefined}
    />
    <PhoneInput label={t('profile.phoneLabel')} value={formData.phone} onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))} />
    {isProvider && formData.phone !== originalPhone && originalPhone.length > 0 && (
      <View style={styles.phoneChangeWarning}>
        <MaterialIcon name="warning" size={16} color="#F59E0B" />
        <Text style={styles.phoneChangeWarningText}>{t('profile.phoneChangeWarning')}</Text>
      </View>
    )}
    <SectionEditorActions
      onCancel={() => { setFormData(prev => ({ ...prev, fullName: originalFormData.current.fullName, phone: originalFormData.current.phone })); setEditingSection(null); }}
      onSave={() => saveProfileFields({ fullName: formData.fullName.trim(), phone: formData.phone }, 'identity')}
      saving={saving}
    />
  </View>
)}
```

- [ ] **Step 2: Add `SectionEditorActions`** component (after `StatStrip`, Task 3 area):

```jsx
const SectionEditorActions = React.memo(({ onCancel, onSave, saving, saveLabel }) => (
  <View style={styles.editorActions}>
    <TouchableOpacity style={styles.editorCancel} onPress={onCancel} disabled={saving}>
      <Text style={styles.editorCancelText}>{saveLabel ? saveLabel.cancel : null}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.editorSave} onPress={onSave} disabled={saving}>
      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editorSaveText}>{saveLabel ? saveLabel.save : null}</Text>}
    </TouchableOpacity>
  </View>
));
```

To avoid threading labels, pass them at call sites via a small wrapper, OR simpler: hardcode with `t` by making this NOT memoized and reading `t` — but `t` isn't in scope in a top-level component. **Decision:** define `SectionEditorActions` *inside* `ProfileScreen` (so it closes over `t`) as a `const` before `return`, not at module scope. Replace Step 2 with an in-component definition:

```jsx
const SectionEditorActions = ({ onCancel, onSave }) => (
  <View style={styles.editorActions}>
    <TouchableOpacity style={styles.editorCancel} onPress={onCancel} disabled={saving}>
      <Text style={styles.editorCancelText}>{t('profile.cancelEdit')}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.editorSave} onPress={onSave} disabled={saving}>
      {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editorSaveText}>{t('profile.saveSection')}</Text>}
    </TouchableOpacity>
  </View>
);
```

- [ ] **Step 3: Provider sections.** Replace the provider portion of the old view branch (the `isProvider && (<> … </>)` inside the non-editing block, ~1784–2016) — and remove the old global `isEditing ? editForm : viewList` structure for provider — with flat sections after the hero. Render (provider only):

```jsx
{isProvider && (
  <>
    <SectionBand />
    {/* About */}
    <ProfileSection title={t('profile.about')} editable={editingSection !== 'about'} onEdit={() => setEditingSection('about')}>
      {editingSection === 'about' ? (
        <View>
          <TextInput
            style={styles.aboutInput}
            value={formData.bio}
            onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
            placeholder={t('profile.bioPlaceholderProfile')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{(formData.bio || '').length}/1000</Text>
          <SectionEditorActions onCancel={() => { setFormData(prev => ({ ...prev, bio: originalFormData.current.bio || '' })); setEditingSection(null); }} onSave={() => saveProfileFields({ bio: (formData.bio || '').trim() }, 'about')} />
        </View>
      ) : displayData?.bio ? (
        <Text style={styles.aboutText}>{displayData.bio}</Text>
      ) : (
        <TouchableOpacity style={styles.aboutEmpty} onPress={() => setEditingSection('about')} activeOpacity={0.7}>
          <View style={styles.aboutEmptyPlus}><MaterialIcon name="add" size={18} color="#2b76bc" /></View>
          <Text style={styles.aboutEmptyText}>{t('profile.aboutEmptyPrompt')}</Text>
        </TouchableOpacity>
      )}
    </ProfileSection>

    <SectionBand />
    {/* Services — port existing verified/pending chips JSX into here */}
    <ProfileSection title={t('profile.services')} action={t('profile.addMoreServices')} actionColor="#EA580C" onAction={() => navigation.navigate('DocumentVerification')}>
      {/* MOVE the existing verified/pending chips + empty-state JSX (old ~1795–1861) here, unchanged */}
    </ProfileSection>

    <SectionBand />
    {/* Experience — surfaces Working Since without Edit */}
    <ProfileSection title={t('profile.experienceSection')} editable={editingSection !== 'experience'} onEdit={() => setEditingSection('experience')}>
      {editingSection === 'experience' ? (
        <View>
          {/* MOVE the existing "Working since" picker JSX (old ~1652–1718) here */}
          <SectionEditorActions
            onCancel={() => { setExperienceStartDate(originalExperienceStartDate.current ? new Date(originalExperienceStartDate.current) : null); setEditingSection(null); }}
            onSave={() => saveProfileFields({ experienceStartDate: experienceStartDate ? experienceStartDate.toISOString() : null }, 'experience')}
          />
        </View>
      ) : (
        <>
          <View style={styles.expRow}>
            <View style={[styles.expIcon, { backgroundColor: '#ECFEFF' }]}><MaterialIcon name="work-history" size={20} color="#0891B2" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expTitle}>
                {displayData?.experienceStartDate ? `${t('experience.workingSince')} ${formatMonthYear(new Date(displayData.experienceStartDate))}` : (expText || t('experience.selectStartMonth'))}
              </Text>
              {!!expText && <Text style={styles.expSub}>{t('experience.experiencePreview', { exp: expText })}</Text>}
            </View>
          </View>
          {ratingAvg > 0 && (
            <View style={styles.expRow}>
              <View style={[styles.expIcon, { backgroundColor: '#FFFBEB' }]}><MaterialIcon name="star" size={20} color="#F59E0B" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expTitle}>{t('profile.ratingReviews', { rating: Number(ratingAvg).toFixed(1), count: reviewCount })}</Text>
                <Text style={styles.expSub}>{t('profile.jobsCompleted', { count: completedJobs })}</Text>
              </View>
            </View>
          )}
        </>
      )}
    </ProfileSection>

    {/* Portfolio — only photographer/influencer; MOVE existing portfolio block into a ProfileSection */}
    {(displayData?.verifiedServiceCategories?.includes('photographer') || displayData?.verifiedServiceCategories?.includes('influencer')) && (
      <>
        <SectionBand />
        <ProfileSection title={t('profile.portfolioTitle')} action={t('profile.editLinks')} actionColor="#7C3AED" onAction={() => navigation.navigate('PortfolioEdit')}>
          {/* MOVE existing portfolio links/specializations/gallery JSX (old ~1909–2012) here, minus its own header */}
        </ProfileSection>
      </>
    )}
  </>
)}
```

- [ ] **Step 4: Add styles** (identity/about/experience editors + rows):

```js
inlineEditor: { paddingHorizontal: 16, paddingTop: 12 },
editorActions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 4 },
editorCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
editorCancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
editorSave: { flex: 1.4, paddingVertical: 13, borderRadius: 12, backgroundColor: '#2b76bc', alignItems: 'center' },
editorSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
aboutText: { fontSize: 14, lineHeight: 22, color: '#334155', paddingBottom: 8 },
aboutInput: { minHeight: 96, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#0F172A', backgroundColor: '#FAFBFC', lineHeight: 20 },
charCount: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 6 },
aboutEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5, borderColor: '#D6DEE8', borderStyle: 'dashed', borderRadius: 14, marginBottom: 6 },
aboutEmptyPlus: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
aboutEmptyText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#64748B', lineHeight: 19 },
expRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EDF1F6' },
expIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
expTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
expSub: { fontSize: 12.5, color: '#64748B', marginTop: 2, fontWeight: '500' },
```

> RESOLVED: `saveProfileFields` already maps semantic fields → payload internally (provider `name`, user `fullName`, phone → `'+91'+raw`), matching `performSave` lines 785–805. Editors just pass semantic fields (`{ fullName, phone }` with raw 10-digit phone). Do **not** pre-format at the call site. The `section` second argument shown in some call sites is unused — the signature is `saveProfileFields(fields)`.

- [ ] **Step 5: Lint + manual QA (provider).** `npm run lint`. Provider profile: About shows bio / empty prompt / editor with counter + save; Services chips + Add more → DocumentVerification; Experience shows Working since date **without Edit** + rating/jobs; edit pencil → experience editor (picker, iOS Done, save); Portfolio only for photographer/influencer → PortfolioEdit; identity editor name/phone save + Aadhaar lock + phone-change warning; Cancel restores values.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "feat(profile): provider sections (About/Services/Experience/Portfolio) + inline editors"
```

---

### Task 6: User view sections (Contact & location editor) + shared Verification/Addresses/Favorites as flat sections

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (user branch + verification/addresses/favorites blocks ~2020–2352; styles)

**Interfaces:**
- Consumes: `ProfileSection`, `SectionBand`, `DetailRow`, `saveProfileFields`, existing AddressAutocomplete/CityAutocomplete/detect-location, existing verification InfoRow + OTP JSX.
- Produces: user Contact & location section + editor; verification/addresses/favorites re-wrapped as flat sections.

- [ ] **Step 1: User Contact & location section** (render when `!isProvider`), replacing the old user "Personal Info" InfoRows:

```jsx
{!isProvider && (
  <>
    <SectionBand />
    <ProfileSection title={t('profile.contactLocation')} editable={editingSection !== 'contact'} onEdit={() => setEditingSection('contact')}>
      {editingSection === 'contact' ? (
        <View>
          {/* MOVE the existing Detect-location header + AddressAutocomplete + City/Pincode row JSX (old ~1533–1597) here */}
          <SectionEditorActions
            onCancel={() => { setFormData(prev => ({ ...prev, address: originalFormData.current.address, city: originalFormData.current.city, pincode: originalFormData.current.pincode })); setEditingSection(null); }}
            onSave={() => saveProfileFields({ address: formData.address, city: formData.city, pincode: formData.pincode }, 'contact')}
          />
        </View>
      ) : (
        <>
          <DetailRow iconName="phone" label={t('profile.phoneLabel')} value={displayData?.phone || t('profile.notSet')} />
          <DetailRow iconName="email" label={t('profile.emailLabel')} value={displayData?.email || t('profile.notSet')} />
          <DetailRow iconName="location" label={t('profile.addressInfo')} value={displayData?.address || t('profile.notSet')} />
          <DetailRow iconName="location" label={t('profile.cityInfo')} value={displayData?.city || t('profile.notSet')} />
          <DetailRow iconName="location" label={t('profile.pincodeInfo')} value={displayData?.pincode || t('profile.notSet')} />
        </>
      )}
    </ProfileSection>
  </>
)}
```

- [ ] **Step 2: Verification as a flat section.** Wrap both the user (~2021) and provider (~2143) Verification blocks: replace `<View style={styles.section}><SectionHeader .../> … </View>` with `<SectionBand /><ProfileSection title={t('profile.verification')}> … </ProfileSection>`. Keep every `InfoRow`, the OTP box JSX, Aadhaar rows, notices **unchanged** inside.

- [ ] **Step 3: Addresses + Favorites as flat sections** (user). Replace their `styles.section` wrappers with `<SectionBand /><ProfileSection title={...}>` and keep the existing `addressesCard` TouchableOpacity content (→ addresses modal / → `Favorites`).

- [ ] **Step 4: Lint + manual QA (user).** Contact & location shows phone/email/address/city/pincode; edit → autocomplete + detect + save (partial); verification phone OTP + email verify → Verification screen; addresses modal (incl. `scrollToAddresses` deep link); favorites → Favorites.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "feat(profile): user contact/location editor + flat verification/addresses/favorites"
```

---

### Task 7: Premium as flat dark strip, Footer (member since, no User ID), remove old top edit/discard logic

**Files:**
- Modify: `src/screens/ProfileScreen.jsx` (premium ~2354–2438; account ~2440–2459; styles)

- [ ] **Step 1: Premium.** Keep the existing premium `TouchableOpacity` content but wrap with `<SectionBand />` and ensure it sits flush (remove outer `premiumSection` horizontal margins so it's full-bleed like other sections; keep the dark gradient look). No logic change.

- [ ] **Step 2: Footer.** Replace the "Account" `section` (User ID + Member Since InfoRows) with a minimal footer — **remove the User ID row entirely**:

```jsx
<SectionBand />
<View style={styles.profileFooter}>
  <Text style={styles.footerText}>
    {t('profile.memberSince', { date: displayData?.createdAt ? new Date(displayData.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A' })}
  </Text>
</View>
```

Styles:

```js
profileFooter: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
footerText: { fontSize: 12.5, color: '#94A3B8', fontWeight: '600' },
```

- [ ] **Step 3:** Verify the old top-bar Edit/Discard button block was fully removed in Task 4 (grep `editButton` usages in JSX). Ensure `contentContainer` padding no longer adds a top white gap — the gradient header now provides the top; set `styles.contentContainer` `paddingTop: 0` and remove outer horizontal padding so sections are full-bleed (`padding: 0`), since each `ProfileSection` has its own `paddingHorizontal`. The `ScrollView` should no longer be wrapped by the old white header.

- [ ] **Step 4: Lint + manual QA.** Premium active/inactive → Subscription; footer shows Member since; **no User ID visible anywhere**; sections are full-bleed with grey bands; no leftover top white gap.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "feat(profile): flat premium strip + minimal footer (drop User ID)"
```

---

### Task 8: Cleanup, dead-style removal, and full QA pass

**Files:**
- Modify: `src/screens/ProfileScreen.jsx`

- [ ] **Step 1:** Remove now-unused styles and JSX: old `header`, `editButton*`, `cancelButtonText`, `profileCard*`, `profileCardHeader*`, `profileBannerBadge*`, `profileAvatarWrap`, `profileCardBody`, `profileContactRow*`, `profileNameRow`(if replaced), `sectionHeader`/`section` (if no longer referenced), `serviceCategoriesDisplay`, `saveButton*` and the monolithic edit-form JSX block that is no longer reachable. Grep each style name for references before deleting: `grep -n "styles.NAME" src/screens/ProfileScreen.jsx`.

- [ ] **Step 2:** Remove the now-unused `EditableField` big-form usages if the identity editor replaced them; keep `EditableField` if still used by identity editor.

- [ ] **Step 3:** Remove any remaining `SectionHeader` usages if all sections now use `ProfileSection`; delete the `SectionHeader` component if unused.

- [ ] **Step 4: Lint (zero warnings for unused vars/styles in this file).** `npm run lint`.

- [ ] **Step 5: Full manual QA** — run the entire spec §8 checklist on **both** iOS and Android:
  - Provider view/edit, User view/edit, per-section editors, partial-save network check (only changed fields; Java-Auth not called for about/experience), iOS swipe-back (incl. while a section editor is open), Android back, keyboard avoidance, safe-area on notch + short-status-bar devices, image upload, pull-to-refresh, hi/mr/en with no raw keys/overflow, backward-compat empty-bio user.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ProfileScreen.jsx
git commit -m "chore(profile): remove dead card styles + monolithic edit form"
```

- [ ] **Step 7:** Update spec's test plan checkboxes as items pass; note any deferred item.

---

## Self-Review

**Spec coverage:** Hero/header (Task 4) ✓; flat sections (Tasks 4–7) ✓; data segregation — rating/jobs/experience in Experience & stat strip (Tasks 4–5) ✓; per-section editors identity/contact/experience/about (Tasks 5–6) ✓; About + backward-compat empty state (Task 5) ✓; About schema (no code — verified in spec) ✓; Services/Portfolio routes (Task 5) ✓; Verification preserved (Task 6) ✓; Premium dark strip (Task 7) ✓; no User ID (Task 7) ✓; i18n (Task 1) ✓; iOS gestures/routes (Global Constraints + Task 8 QA) ✓; performance/partial save (Task 2) ✓.

**Placeholder scan:** Code steps contain concrete code. "MOVE the existing … JSX" steps reference exact current line ranges to relocate verbatim — these are relocations of already-written, working JSX, not new code to invent; each names the source range.

**Type consistency:** `saveProfileFields(fields)` (semantic fields, maps internally), `editingSection` values, `StatStrip` `items` shape (`{value,label,star?,sub?}`), `ProfileSection` props (`title/action/onAction/actionColor/editable/onEdit`), `DetailRow` props (`iconName/materialIcon/label/value/right/muted`), `SectionEditorActions` props (`onCancel/onSave`) are consistent across tasks. **Resolved:** provider payload key = `name`, user = `fullName`, phone = `'+91'+raw` — centralized in `saveProfileFields` (verified against `performSave` 785–805).
