/**
 * PSAContactsScreen — Personal Safety Alerts
 *
 * Manage emergency contacts, view usage stats, and navigate to SOS trigger.
 * Rich content with disclaimer, how-it-works, usage dashboard.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
  Dimensions,
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import * as psaService from '../services/psaService';

// ── Colors ──
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  success: '#16A34A',
  successLight: '#F0FDF4',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  divider: '#E2E8F0',
  inputBg: '#F8FAFC',
  white: '#FFFFFF',
};

const SHADOWS = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20 },
  android: { elevation: 5 },
});

const MAX_CONTACTS = 4;
const MONTHLY_LIMIT = 7;

// ── Animated Pressable ──
const AnimatedPressable = ({ children, onPress, style, disabled }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

// ── Main Screen ──
const PSAContactsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, userType } = useApp();
  const { showDestructive, showInfo } = useDialog();

  const [contacts, setContacts] = useState([]);
  const [usage, setUsage] = useState({ monthlyTriggered: 0, monthlyRemaining: MONTHLY_LIMIT, totalTriggered: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [howItWorksExpanded, setHowItWorksExpanded] = useState(false);

  // ── Data loading ──
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [contactsRes, usageRes] = await Promise.all([
        psaService.getContacts(),
        psaService.getUsage(),
      ]);
      if (contactsRes.success) setContacts(contactsRes.contacts || []);
      if (usageRes.success) setUsage(usageRes.usage);
    } catch (e) {
      console.error('[PSA] loadData error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');
      loadData();
    }, [loadData])
  );

  // ── Handlers ──
  const handleDeleteContact = (contact) => {
    showDestructive(
      'Remove Contact',
      `Remove ${contact.name} from your emergency contacts?`,
      async () => {
        const res = await psaService.deleteContact(contact._id);
        if (res.success) {
          setContacts(prev => prev.filter(c => c._id !== contact._id));
        } else {
          showInfo('Error', res.message || 'Could not remove contact');
        }
      },
      'Remove',
    );
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setShowAddModal(true);
  };

  const handleAddNew = () => {
    setEditingContact(null);
    setShowAddModal(true);
  };

  const handleContactSaved = (savedContact, isEdit) => {
    if (isEdit) {
      setContacts(prev => prev.map(c => c._id === savedContact._id ? savedContact : c));
    } else {
      setContacts(prev => [...prev, savedContact]);
    }
    // Modal handles its own animated close — just reset parent state
    setShowAddModal(false);
    setEditingContact(null);
  };

  const handleSendAlert = () => {
    if (contacts.length === 0) {
      showInfo('No Contacts', 'Please add at least one emergency contact before sending an alert.');
      return;
    }
    if (usage.monthlyRemaining <= 0) {
      showInfo('Monthly Limit Reached', `You've used all ${MONTHLY_LIMIT} safety alerts for this month. Your limit resets at the start of next month.`);
      return;
    }
    navigation.navigate('PSATrigger', { contacts, usage });
  };

  // ── Usage ring ──
  const usedPercent = Math.min(1, usage.monthlyTriggered / MONTHLY_LIMIT);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcon name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Safety</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcon name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Safety</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        >
          {/* Disclaimer */}
          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerIconCircle}>
              <MaterialIcon name="shield" size={18} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.disclaimerTitle}>Important</Text>
              <Text style={styles.disclaimerText}>
                This feature alerts your personal contacts — it is <Text style={{ fontWeight: '700' }}>not a substitute</Text> for emergency services. In a life-threatening situation, always call <Text style={{ fontWeight: '700', color: COLORS.danger }}>112</Text> first.
              </Text>
            </View>
          </View>

          {/* Usage Dashboard */}
          <View style={[styles.section, styles.usageCard]}>
            <View style={styles.usageHeader}>
              <View style={styles.usageIconCircle}>
                <MaterialIcon name="notifications-active" size={18} color={COLORS.secondary} />
              </View>
              <Text style={styles.usageTitle}>Monthly Alerts</Text>
            </View>
            <View style={styles.usageTop}>
              <View style={styles.usageRingContainer}>
                <View style={styles.usageRingOuter}>
                  <View style={styles.usageRingInner}>
                    <Text style={styles.usageRingNumber}>{usage.monthlyRemaining}</Text>
                    <Text style={styles.usageRingLabel}>left</Text>
                  </View>
                </View>
              </View>
              <View style={styles.usageDetails}>
                <Text style={styles.usageSubtitle}>
                  {usage.monthlyTriggered} of {MONTHLY_LIMIT} used this month
                </Text>
                {usage.totalTriggered > 0 && (
                  <Text style={styles.usageTotalText}>
                    {usage.totalTriggered} total alert{usage.totalTriggered !== 1 ? 's' : ''} sent
                  </Text>
                )}
              </View>
            </View>
            {usage.monthlyRemaining <= 2 && usage.monthlyRemaining > 0 && (
              <View style={styles.usageWarning}>
                <MaterialIcon name="warning-amber" size={16} color={COLORS.warning} />
                <Text style={styles.usageWarningText}>Only {usage.monthlyRemaining} alert{usage.monthlyRemaining !== 1 ? 's' : ''} remaining this month</Text>
              </View>
            )}
          </View>

          {/* Contacts Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderContainer}>
                <View style={styles.sectionAccentBar} />
                <Text style={styles.sectionHeader}>Emergency Contacts</Text>
              </View>
              <Text style={styles.contactCount}>{contacts.length}/{MAX_CONTACTS}</Text>
            </View>

            {contacts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <MaterialIcon name="people-outline" size={36} color={COLORS.muted} />
                </View>
                <Text style={styles.emptyTitle}>No contacts added yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add up to {MAX_CONTACTS} trusted people who will receive your location and an alert message when you trigger SOS.
                </Text>
              </View>
            ) : (
              contacts.map((contact) => (
                <View key={contact._id} style={styles.contactCard}>
                  <View style={styles.contactLeft}>
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>{(contact.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      {contact.relationship ? (
                        <View style={styles.relationshipBadge}>
                          <Text style={styles.relationshipText}>{contact.relationship}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.contactPhone}>{contact.phone}</Text>
                      {contact.email ? <Text style={styles.contactEmail}>{contact.email}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.contactActions}>
                    <TouchableOpacity style={styles.contactActionBtn} onPress={() => handleEditContact(contact)}>
                      <MaterialIcon name="edit" size={18} color={COLORS.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.contactActionBtn, styles.contactDeleteBtn]} onPress={() => handleDeleteContact(contact)}>
                      <MaterialIcon name="delete-outline" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {contacts.length < MAX_CONTACTS && (
              <AnimatedPressable onPress={handleAddNew} style={styles.addContactButton}>
                <MaterialIcon name="person-add" size={20} color={COLORS.secondary} />
                <Text style={styles.addContactText}>Add Emergency Contact</Text>
              </AnimatedPressable>
            )}
          </View>

          {/* How It Works */}
          <TouchableOpacity
            style={styles.section}
            activeOpacity={0.8}
            onPress={() => setHowItWorksExpanded(!howItWorksExpanded)}
          >
            <View style={styles.howItWorksHeader}>
              <View style={styles.sectionHeaderContainer}>
                <View style={[styles.sectionAccentBar, { backgroundColor: COLORS.secondary }]} />
                <Text style={styles.sectionHeader}>How It Works</Text>
              </View>
              <MaterialIcon name={howItWorksExpanded ? 'expand-less' : 'expand-more'} size={24} color={COLORS.muted} />
            </View>
            {howItWorksExpanded && (
              <View style={styles.howItWorksContent}>
                {[
                  { icon: 'people', title: 'Add Your Contacts', desc: 'Save up to 4 trusted people — family, friends, or anyone you trust.' },
                  { icon: 'touch-app', title: 'Trigger an Alert', desc: 'Slide to confirm, then a 5-second countdown gives you time to cancel if triggered accidentally.' },
                  { icon: 'email', title: 'Contacts Get Notified', desc: 'Each contact receives an email with your live GPS location as a Google Maps link.' },
                  { icon: 'sms', title: 'SMS Alerts', desc: 'Contacts can also receive an SMS alert with your location when available.' },
                  { icon: 'event-repeat', title: 'Monthly Limit', desc: `You can send up to ${MONTHLY_LIMIT} alerts per month. This resets automatically on the 1st.` },
                ].map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepIconCircle}>
                      <MaterialIcon name={step.icon} size={20} color={COLORS.secondary} />
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

          {/* Emergency Numbers Reminder */}
          <View style={[styles.section, styles.emergencyReminder]}>
            <View style={styles.emergencyReminderIconCircle}>
              <MaterialIcon name="call" size={20} color={COLORS.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyReminderTitle}>Emergency Services</Text>
              <Text style={styles.emergencyReminderText}>
                For life-threatening emergencies, call <Text style={{ fontWeight: '700' }}>112</Text> (India) or your local emergency number immediately.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating SOS Button */}
      <View style={[styles.floatingButtonContainer, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedPressable
          onPress={handleSendAlert}
          style={[
            styles.sosButton,
            contacts.length === 0 && styles.sosButtonDisabled,
          ]}
          disabled={contacts.length === 0}
        >
          <MaterialIcon name="sos" size={22} color={COLORS.white} />
          <Text style={styles.sosButtonText}>Send Safety Alert</Text>
        </AnimatedPressable>
      </View>

      {/* Add/Edit Contact Modal */}
      <ContactFormModal
        visible={showAddModal}
        contact={editingContact}
        onClose={() => setShowAddModal(false)}
        onSave={handleContactSaved}
      />
    </View>
  );
};

// ── Contact Form Modal (smooth animated backdrop) ──

const ContactFormModal = ({ visible, contact, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const isEdit = !!contact;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const screenHeight = Dimensions.get('window').height;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  const RELATIONSHIPS = ['Mother', 'Father', 'Spouse', 'Sibling', 'Friend', 'Other'];

  // Keyboard listeners — shift sheet up when keyboard opens
  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      // On iOS, subtract the bottom inset since it's already accounted for in paddingBottom
      const kbHeight = e.endCoordinates.height;
      const offset = Platform.OS === 'ios' ? -(kbHeight - insets.bottom) : -kbHeight;
      Animated.timing(keyboardOffset, {
        toValue: offset,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: true,
      }).start();
    };
    const onHide = () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 200,
        useNativeDriver: true,
      }).start();
    };

    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => { sub1.remove(); sub2.remove(); };
  }, [keyboardOffset, insets.bottom]);

  // When parent sets visible=false, ensure modal is hidden
  React.useEffect(() => {
    if (!visible && modalVisible) {
      setModalVisible(false);
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(screenHeight);
    }
  }, [visible]);

  // Animate in
  React.useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      setModalVisible(true);
      sheetTranslateY.setValue(screenHeight);
      overlayOpacity.setValue(0);
      keyboardOffset.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      if (contact) {
        setName(contact.name || '');
        setPhone(contact.phone || '');
        setEmail(contact.email || '');
        setRelationship(contact.relationship || '');
      } else {
        setName(''); setPhone(''); setEmail(''); setRelationship('');
      }
      setError('');
    }
  }, [visible, contact]);

  // Animate out
  const dismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Keyboard.dismiss();
    const h = Dimensions.get('window').height;
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: h, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

  const handleSave = async () => {
    Keyboard.dismiss();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { setError('Please enter a name'); return; }
    if (!trimmedPhone) { setError('Please enter a phone number'); return; }
    if (trimmedPhone.replace(/[^0-9]/g, '').length < 10) { setError('Please enter a valid phone number'); return; }

    setSaving(true);
    setError('');

    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      email: email.trim(),
      relationship: relationship.trim(),
    };

    const res = isEdit
      ? await psaService.updateContact(contact._id, payload)
      : await psaService.addContact(payload);

    setSaving(false);

    if (res.success) {
      // Update parent state first, then animate the modal closed
      onSave(res.contact, isEdit);
      // Animated dismiss — onClose will fire after animation completes
      if (!isDismissing.current) {
        isDismissing.current = true;
        Keyboard.dismiss();
        Animated.parallel([
          Animated.spring(sheetTranslateY, { toValue: Dimensions.get('window').height, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
          Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => {
          setModalVisible(false);
        });
      }
    } else {
      setError(res.message || res.error || 'Something went wrong');
    }
  };

  return (
    <Modal visible={modalVisible} animationType="none" transparent statusBarTranslucent onRequestClose={dismiss}>
      <View style={{ flex: 1 }}>
        {/* Animated backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
        </Animated.View>

        {/* Animated sheet — keyboardOffset shifts entire sheet up when keyboard opens */}
        <Animated.View style={[styles.modalSheetContainer, { transform: [{ translateY: Animated.add(sheetTranslateY, keyboardOffset) }] }]}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              {/* Drag handle */}
              <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
              </View>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isEdit ? 'Edit Contact' : 'Add Emergency Contact'}</Text>
                <TouchableOpacity onPress={dismiss} style={styles.modalCloseBtn}>
                  <MaterialIcon name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Mom, Dad, John"
                  placeholderTextColor={COLORS.muted}
                  maxLength={100}
                  autoCapitalize="words"
                />

                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g., 9876543210"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="phone-pad"
                  maxLength={15}
                />

                <Text style={styles.inputLabel}>Email (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g., mom@email.com"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                />

                <Text style={styles.inputLabel}>Relationship</Text>
                <View style={styles.relationshipChips}>
                  {RELATIONSHIPS.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.chip, relationship === r && styles.chipActive]}
                      onPress={() => setRelationship(relationship === r ? '' : r)}
                    >
                      <Text style={[styles.chipText, relationship === r && styles.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? (
                  <View style={styles.errorRow}>
                    <MaterialIcon name="error-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Extra padding so content scrolls above keyboard */}
                <View style={{ height: 20 }} />
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>{isEdit ? 'Save Changes' : 'Add Contact'}</Text>
                )}
              </TouchableOpacity>
            </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.darkHero,
  },
  backButton: {
    width: 44, height: 44, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },

  // Disclaimer
  disclaimerCard: {
    flexDirection: 'row', backgroundColor: COLORS.warningLight, borderRadius: 16,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.warningBorder,
  },
  disclaimerIconCircle: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(217,119,6,0.12)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  disclaimerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  disclaimerText: { fontSize: 13, color: '#78350F', lineHeight: 19 },

  // Section
  section: {
    backgroundColor: COLORS.cardWhite, borderRadius: 22, padding: 20, marginBottom: 16, ...SHADOWS,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center' },
  sectionAccentBar: { width: 4, height: 18, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 10 },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8 },
  contactCount: { fontSize: 13, fontWeight: '600', color: COLORS.muted },

  // Usage Card
  usageCard: {},
  usageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  usageIconCircle: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  usageTop: { flexDirection: 'row', alignItems: 'center' },
  usageRingContainer: { marginRight: 20 },
  usageRingOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 6, borderColor: COLORS.divider, alignItems: 'center', justifyContent: 'center',
  },
  usageRingInner: { alignItems: 'center' },
  usageRingNumber: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  usageRingLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginTop: -2 },
  usageDetails: { flex: 1 },
  usageTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  usageSubtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  usageTotalText: { fontSize: 12, color: COLORS.muted, marginTop: 4 },
  usageWarning: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningLight,
    borderRadius: 8, padding: 10, marginTop: 14,
  },
  usageWarningText: { fontSize: 13, color: COLORS.warning, fontWeight: '600', marginLeft: 8 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 10 },

  // Contact Card
  contactCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  contactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  contactAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  contactAvatarText: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  relationshipBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginTop: 3, marginBottom: 2,
  },
  relationshipText: { fontSize: 11, fontWeight: '600', color: COLORS.secondary },
  contactPhone: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  contactEmail: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  contactActions: { flexDirection: 'row', marginLeft: 8 },
  contactActionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginLeft: 6,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  contactDeleteBtn: { backgroundColor: COLORS.dangerLight },

  // Add Contact Button
  addContactButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.secondary, borderStyle: 'dashed',
    borderRadius: 14, padding: 14, marginTop: 6,
  },
  addContactText: { fontSize: 15, fontWeight: '600', color: COLORS.secondary, marginLeft: 8 },

  // How It Works
  howItWorksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  howItWorksContent: { marginTop: 16 },
  stepRow: { flexDirection: 'row', marginBottom: 16 },
  stepIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  stepDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Emergency Reminder
  emergencyReminder: { flexDirection: 'row', alignItems: 'flex-start' },
  emergencyReminderIconCircle: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.dangerLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  emergencyReminderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  emergencyReminderText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Floating SOS Button
  floatingButtonContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: 'rgba(241,245,249,0.95)',
    borderTopWidth: 1, borderTopColor: COLORS.divider,
  },
  sosButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.danger, borderRadius: 16, paddingVertical: 16,
  },
  sosButtonDisabled: { backgroundColor: COLORS.muted },
  sosButtonText: { fontSize: 17, fontWeight: '800', color: COLORS.white, marginLeft: 10, letterSpacing: 0.5 },

  // Modal
  modalSheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  textInput: {
    backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.divider,
  },
  relationshipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.divider,
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.secondary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.secondary, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  errorText: { fontSize: 13, color: COLORS.danger, marginLeft: 6 },
  saveButton: {
    backgroundColor: COLORS.secondary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});

export default PSAContactsScreen;
