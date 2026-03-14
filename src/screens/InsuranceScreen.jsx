/**
 * Insurance Document Screen
 *
 * Provider-only screen for uploading mandatory insurance documents:
 * - PAN Card (compulsory)
 * - Driving License (optional, front side)
 * - E-Shram Card — Front & Back (optional)
 * - Address Proof: Electricity Bill OR Bank Passbook (compulsory — one of two)
 *
 * Aadhaar & Skill Certificate are already collected elsewhere.
 *
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  Linking,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { requestCameraPermission, requestGalleryPermission } from '../utils/permissions';
import { pick, types } from '@react-native-documents/picker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon, ImageViewerModal } from '../components';
import { NODE_BASE_URL } from '../config/api';
import {
  getInsuranceRequirements,
  getInsuranceStatus,
  submitInsuranceDocuments,
  resubmitInsuranceDocuments,
  deleteInsuranceDocument,
} from '../services/insuranceService';

// ─── Cloudinary ────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dj1aytbae';
const CLOUDINARY_UPLOAD_PRESET = 'fixhomi_documents';

// ─── Design Tokens ─────────────────────────────────────────────
const C = {
  dark: '#0F172A',
  bg: '#F1F5F9',
  card: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  muted: '#94A3B8',
  text: '#1E293B',
  textSec: '#64748B',
  border: '#E2E8F0',
  iconBg: '#F1F5F9',
};

// ─── Insurance Document Config ─────────────────────────────────
const INSURANCE_DOCS = [
  {
    key: 'pan_card',
    label: 'PAN Card',
    required: true,
    icon: 'credit-card',
    description: 'Upload a clear photo of your PAN card (front side)',
  },
  {
    key: 'driving_license',
    label: 'Driving License',
    required: false,
    icon: 'directions-car',
    description: 'Upload front side of your driving license (optional)',
  },
  {
    key: 'e_shram_card_front',
    label: 'E-Shram Card (Front)',
    required: false,
    icon: 'badge',
    description: 'Upload front side of your E-Shram card (optional)',
    eShramGroup: true,
  },
  {
    key: 'e_shram_card_back',
    label: 'E-Shram Card (Back)',
    required: false,
    icon: 'badge',
    description: 'Upload back side of your E-Shram card (optional)',
    eShramGroup: true,
  },
  {
    key: 'address_proof_electricity_bill',
    label: 'Electricity Bill',
    required: false,
    icon: 'bolt',
    description: 'Upload electricity bill (if self-owned house)',
    addressProof: true,
  },
  {
    key: 'address_proof_bank_passbook',
    label: 'Bank Passbook (1st Page)',
    required: false,
    icon: 'account-balance',
    description: 'Upload 1st page of bank passbook',
    addressProof: true,
  },
];

// ─── Status Config ─────────────────────────────────────────────
const STATUS_MAP = {
  not_started: { color: C.muted, icon: 'help-outline', label: 'Not Submitted', bg: '#F1F5F9' },
  pending: { color: C.warning, icon: 'schedule', label: 'Pending Review', bg: '#FEF3C7' },
  under_review: { color: C.secondary, icon: 'visibility', label: 'Under Review', bg: '#DBEAFE' },
  approved: { color: C.success, icon: 'check-circle', label: 'Approved', bg: '#D1FAE5' },
  rejected: { color: C.danger, icon: 'cancel', label: 'Rejected', bg: '#FEE2E2' },
};

/* ═══════════════════════════════════════════════════════════════
   PulsingDot
   ═══════════════════════════════════════════════════════════════ */
const PulsingDot = ({ color = C.success, size = 8 }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: size * 2.5, height: size * 2.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size * 2.5, height: size * 2.5, borderRadius: size * 1.25, backgroundColor: color + '30', transform: [{ scale: anim }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DocumentCard — individual document upload/status card
   ═══════════════════════════════════════════════════════════════ */
const DocumentCard = ({ config, document, onUpload, onRemove, onView, isRejected, isLocked }) => {
  const hasDoc = !!(document?.localUri || document?.fileUrl);
  const isStaged = document?.isStaged && !document?.fileUrl;
  const docStatus = document?.status || (hasDoc ? (isStaged ? 'staged' : 'pending') : 'none');
  const imageUri = document?.localUri || document?.fileUrl;
  const isImage = document?.fileType ? ['jpg', 'jpeg', 'png', 'webp', 'image/jpeg', 'image/png', 'image/webp'].some(t => document.fileType.includes(t)) : false;

  const pressAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.docCard, { transform: [{ scale: pressAnim }] }]}>
      {/* Header row */}
      <View style={s.docCardHeader}>
        <View style={[s.docIconCircle, hasDoc && s.docIconCircleActive]}>
          <MaterialIcon name={config.icon} size={20} color={hasDoc ? C.success : C.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.docTitleRow}>
            <Text style={s.docTitle}>{config.label}</Text>
            {config.required && <View style={s.requiredBadge}><Text style={s.requiredBadgeText}>Required</Text></View>}
            {!config.required && config.addressProof && <View style={s.optionalBadge}><Text style={s.optionalBadgeText}>Option</Text></View>}
            {!config.required && !config.addressProof && <View style={s.optionalBadge}><Text style={s.optionalBadgeText}>Optional</Text></View>}
          </View>
          <Text style={s.docDesc}>{config.description}</Text>
        </View>
      </View>

      {/* Document status / rejection reason */}
      {document?.status === 'rejected' && document?.rejectionReason && (
        <View style={s.rejectionStrip}>
          <MaterialIcon name="error-outline" size={14} color={C.danger} />
          <Text style={s.rejectionText}>{document.rejectionReason}</Text>
        </View>
      )}

      {/* Preview or upload */}
      {hasDoc ? (
        <View style={s.docPreview}>
          <TouchableOpacity
            style={s.docPreviewImage}
            onPress={() => isImage && imageUri && onView(imageUri)}
            activeOpacity={isImage ? 0.7 : 1}
          >
            {isImage ? (
              <Image source={{ uri: imageUri }} style={s.docThumb} />
            ) : (
              <View style={s.pdfThumb}>
                <MaterialIcon name="picture-as-pdf" size={28} color={C.danger} />
                <Text style={s.pdfName} numberOfLines={1}>{document.fileName || 'Document.pdf'}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={s.docPreviewMeta}>
            {isStaged ? (
              <View style={[s.statusPill, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcon name="cloud-upload" size={13} color={C.warning} />
                <Text style={[s.statusPillText, { color: C.warning }]}>Ready to submit</Text>
              </View>
            ) : document?.status === 'approved' ? (
              <View style={[s.statusPill, { backgroundColor: '#D1FAE5' }]}>
                <MaterialIcon name="check-circle" size={13} color={C.success} />
                <Text style={[s.statusPillText, { color: C.success }]}>Approved</Text>
              </View>
            ) : document?.status === 'rejected' ? (
              <View style={[s.statusPill, { backgroundColor: '#FEE2E2' }]}>
                <MaterialIcon name="cancel" size={13} color={C.danger} />
                <Text style={[s.statusPillText, { color: C.danger }]}>Rejected</Text>
              </View>
            ) : (
              <View style={[s.statusPill, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcon name="schedule" size={13} color={C.warning} />
                <Text style={[s.statusPillText, { color: C.warning }]}>Pending Review</Text>
              </View>
            )}
            {isStaged && (
              <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
                <MaterialIcon name="delete-outline" size={18} color={C.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : isLocked ? (
        <View style={[s.uploadBtn, { borderColor: C.muted + '25', opacity: 0.5 }]}>
          <MaterialIcon name="lock" size={20} color={C.muted} />
          <View>
            <Text style={[s.uploadBtnText, { color: C.muted }]}>Under Review</Text>
            <Text style={s.uploadBtnHint}>Documents are being verified</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.uploadBtn}
          onPress={onUpload}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.8}
        >
          <MaterialIcon name="add-a-photo" size={22} color={C.secondary} />
          <View>
            <Text style={s.uploadBtnText}>Upload Document</Text>
            <Text style={s.uploadBtnHint}>Camera, Gallery or PDF • Max 2.5MB</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════ */
const InsuranceScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState({}); // { [docType]: docData }
  const [insuranceStatus, setInsuranceStatus] = useState(null); // full status object
  const [overallStatus, setOverallStatus] = useState('not_started');

  // Image viewer
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ─── Fetch status ──────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!providerId) return;
    try {
      const result = await getInsuranceStatus(providerId);
      if (result.success && result.insuranceVerification) {
        setInsuranceStatus(result.insuranceVerification);
        setOverallStatus(result.insuranceVerification.overallStatus || 'not_started');
        // Restore documents from backend
        const docMap = {};
        (result.insuranceVerification.documents || []).forEach(doc => {
          docMap[doc.documentType] = doc;
        });
        setDocuments(prev => {
          // Keep staged docs, overlay backend docs
          const merged = { ...prev };
          Object.keys(docMap).forEach(key => {
            if (!merged[key]?.isStaged) {
              merged[key] = docMap[key];
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.warn('[Insurance] fetch status error:', err);
    }
  }, [providerId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchStatus();
      setLoading(false);
    })();
  }, [fetchStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, [fetchStatus]);

  // ─── Image viewer ──────────────────────────────────────────────
  const openViewer = (uri) => {
    setViewerImages([uri]);
    setViewerIndex(0);
    setViewerVisible(true);
  };

  // ─── Pick document ─────────────────────────────────────────────
  const pickDocument = (docType) => {
    dialog(t('insurance.uploadDocument'), t('insurance.chooseUpload'), [
      { text: t('insurance.camera'), onPress: () => captureCamera(docType) },
      { text: t('insurance.gallery'), onPress: () => pickGallery(docType) },
      { text: t('insurance.pdfFile'), onPress: () => pickPDF(docType) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const captureCamera = async (docType) => {
    const granted = await requestCameraPermission(dialog);
    if (!granted) return;

    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 });
      if (!result.didCancel && result.assets?.[0]) stageDoc(docType, result.assets[0]);
    } catch (err) {
      dialog(t('common.error'), t('insurance.captureImageFailed'));
    }
  };

  const pickGallery = async (docType) => {
    const granted = await requestGalleryPermission(dialog);
    if (!granted) return;

    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 });
      if (!result.didCancel && result.assets?.[0]) stageDoc(docType, result.assets[0]);
    } catch (err) {
      dialog(t('common.error'), t('insurance.pickImageFailed'));
    }
  };

  const pickPDF = async (docType) => {
    try {
      const result = await pick({ type: [types.pdf] });
      if (result?.[0]) {
        stageDoc(docType, {
          uri: result[0].uri,
          fileName: result[0].name,
          type: result[0].type,
          fileSize: result[0].size,
        });
      }
    } catch (err) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED' && !err?.message?.includes('cancel')) {
        dialog(t('common.error'), t('insurance.pickDocFailed'));
      }
    }
  };

  const stageDoc = (docType, file) => {
    // Validate file size (2.5MB)
    if (file.fileSize && file.fileSize > 2.5 * 1024 * 1024) {
      dialog(t('insurance.fileTooLarge'), t('insurance.fileTooLargeMsg'));
      return;
    }
    setDocuments(prev => ({
      ...prev,
      [docType]: {
        documentType: docType,
        localUri: file.uri,
        fileName: file.fileName || file.name || 'document',
        fileType: file.type || 'image/jpeg',
        fileSize: file.fileSize || file.size,
        isStaged: true,
      },
    }));
  };

  const removeDoc = (docType) => {
    dialog(t('insurance.removeDocumentTitle'), t('insurance.removeDocumentMsg'), [
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          setDocuments(prev => {
            const next = { ...prev };
            delete next[docType];
            return next;
          });
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  // ─── Upload to Cloudinary ──────────────────────────────────────
  const uploadToCloudinary = async (docType, doc) => {
    const formData = new FormData();
    formData.append('file', {
      uri: doc.localUri,
      type: doc.fileType || 'image/jpeg',
      name: doc.fileName || 'document.jpg',
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `fixhomi/insurance/${providerId}`);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: formData, signal: controller.signal },
    );
    clearTimeout(tid);
    const data = await res.json();

    if (data.secure_url) {
      return {
        documentType: docType,
        fileUrl: data.secure_url,
        publicId: data.public_id,
        fileName: doc.fileName || data.original_filename,
        fileType: data.format || doc.fileType?.split('/')[1],
        fileSize: doc.fileSize || data.bytes,
      };
    }
    throw new Error(data.error?.message || 'Upload failed');
  };

  // ─── Validate & Submit ─────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate PAN card
    if (!documents.pan_card) {
      dialog(t('insurance.panRequiredTitle'), t('insurance.panRequiredMsg'));
      return;
    }
    // Validate address proof (at least one)
    const hasElectricity = !!documents.address_proof_electricity_bill;
    const hasPassbook = !!documents.address_proof_bank_passbook;
    if (!hasElectricity && !hasPassbook) {
      dialog(t('insurance.addressProofRequiredTitle'), t('insurance.addressProofRequiredMsg'));
      return;
    }

    dialog(t('insurance.submitDocuments'), t('insurance.submitDocumentsMsg'), [
      {
        text: t('common.submit'),
        onPress: () => executeSubmit(),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const executeSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload staged documents to Cloudinary first
      const uploadedDocs = [];
      for (const [docType, doc] of Object.entries(documents)) {
        if (doc.isStaged && doc.localUri) {
          const uploaded = await uploadToCloudinary(docType, doc);
          uploadedDocs.push(uploaded);
        } else if (doc.fileUrl) {
          // Already uploaded, include as-is
          uploadedDocs.push({
            documentType: doc.documentType,
            fileUrl: doc.fileUrl,
            publicId: doc.publicId,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
          });
        }
      }

      if (uploadedDocs.length === 0) {
        dialog(t('insurance.noDocuments'), t('insurance.noDocumentsMsg'));
        setSubmitting(false);
        return;
      }

      // Submit to backend
      const isResubmit = overallStatus === 'rejected';
      const result = isResubmit
        ? await resubmitInsuranceDocuments(providerId, uploadedDocs)
        : await submitInsuranceDocuments(providerId, uploadedDocs);

      if (result.success) {
        dialog(t('insurance.documentsSubmitted'), result.message || t('insurance.documentsSubmittedMsg'));
        await fetchStatus();
      } else {
        dialog(t('insurance.submissionFailed'), result.error || t('insurance.submissionFailedMsg'));
      }
    } catch (err) {
      console.error('[Insurance] submit error:', err);
      dialog(t('insurance.uploadError'), t('insurance.uploadErrorMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived state ─────────────────────────────────────────────
  const statusConfig = STATUS_MAP[overallStatus] || STATUS_MAP.not_started;
  const isSubmitted = ['pending', 'under_review', 'approved'].includes(overallStatus);
  const isApproved = overallStatus === 'approved';
  const isRejected = overallStatus === 'rejected';
  const canSubmit = !isSubmitted || isRejected;

  // Count staged docs
  const stagedCount = Object.values(documents).filter(d => d?.isStaged).length;
  const totalDocs = Object.keys(documents).length;

  // Check if ready to submit
  const hasPAN = !!documents.pan_card;
  const hasAddressProof = !!documents.address_proof_electricity_bill || !!documents.address_proof_bank_passbook;
  const isReadyToSubmit = hasPAN && hasAddressProof && stagedCount > 0;

  // ─── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={s.heroHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="back" size={22} color={C.card} />
          </TouchableOpacity>
          <Text style={s.heroTitle}>{t('insurance.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={C.secondary} />
          <Text style={s.loadingText}>{t('insurance.loadingStatus')}</Text>
        </View>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* ── Dark Hero Header ──────────────────────────────────── */}
      <View style={s.heroHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="back" size={22} color={C.card} />
        </TouchableOpacity>
        <Text style={s.heroTitle}>{t('insurance.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.secondary} />}
      >
        {/* ── Status Banner ─────────────────────────────────── */}
        <View style={[s.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <View style={s.statusBannerLeft}>
            {isApproved ? (
              <View style={[s.statusIconCircle, { backgroundColor: C.success + '20' }]}>
                <MaterialIcon name="verified" size={24} color={C.success} />
              </View>
            ) : isSubmitted ? (
              <View style={[s.statusIconCircle, { backgroundColor: C.warning + '20' }]}>
                <PulsingDot color={C.warning} size={8} />
              </View>
            ) : isRejected ? (
              <View style={[s.statusIconCircle, { backgroundColor: C.danger + '20' }]}>
                <MaterialIcon name="error-outline" size={24} color={C.danger} />
              </View>
            ) : (
              <View style={[s.statusIconCircle, { backgroundColor: C.secondary + '20' }]}>
                <MaterialIcon name="shield" size={24} color={C.secondary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.statusTitle, { color: statusConfig.color }]}>
                {isApproved ? t('insurance.insuranceActive') : isSubmitted ? t('insurance.underVerification') : isRejected ? t('insurance.documentsRejected') : t('insurance.insuranceDocuments')}
              </Text>
              <Text style={s.statusSubtitle}>
                {isApproved
                  ? t('insurance.insuranceActiveMsg')
                  : isSubmitted
                  ? t('insurance.underVerificationMsg')
                  : isRejected
                  ? insuranceStatus?.rejectionReason || t('insurance.documentsRejectedMsg')
                  : t('insurance.uploadRequiredMsg')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Already Covered Note ─────────────────────────── */}
        <View style={s.infoBanner}>
          <MaterialIcon name="info-outline" size={16} color={C.secondary} />
          <Text style={s.infoBannerText}>
            {t('insurance.aadhaarNote')}
          </Text>
        </View>

        {/* ── Address Proof Note ───────────────────────────── */}
        <View style={s.addressProofNote}>
          <View style={s.addressProofNoteHeader}>
            <MaterialIcon name="home" size={16} color={C.primary} />
            <Text style={s.addressProofNoteTitle}>{t('insurance.addressProof')}</Text>
            <View style={s.requiredBadge}><Text style={s.requiredBadgeText}>{t('common.required')}</Text></View>
          </View>
          <Text style={s.addressProofNoteText}>
            {t('insurance.addressProofNote')}
          </Text>
        </View>

        {/* ── Document Cards ──────────────────────────────── */}
        {INSURANCE_DOCS.map(config => (
          <DocumentCard
            key={config.key}
            config={config}
            document={documents[config.key]}
            onUpload={isSubmitted ? undefined : () => pickDocument(config.key)}
            onRemove={isSubmitted ? undefined : () => removeDoc(config.key)}
            onView={(uri) => openViewer(uri)}
            isRejected={isRejected}
            isLocked={isSubmitted}
          />
        ))}

        {/* ── T&C Note ─────────────────────────────────────── */}
        <View style={s.tcNote}>
          <MaterialIcon name="gavel" size={16} color={C.muted} />
          <Text style={s.tcText}>
            {t('insurance.termsNote')}
            <Text
              style={s.tcLink}
              onPress={() => Linking.openURL('https://fixhomi.com/insurance')}
            >
              {t('insurance.termsLink')}
            </Text>
          </Text>
        </View>

        {/* ── Insurance Benefits ───────────────────────────── */}
        <View style={s.benefitsCard}>
          <Text style={s.benefitsTitle}>{t('insurance.benefitsTitle')}</Text>
          <View style={s.benefitRow}>
            <MaterialIcon name="health-and-safety" size={18} color={C.success} />
            <Text style={s.benefitText}>{t('insurance.benefit1')}</Text>
          </View>
          <View style={s.benefitRow}>
            <MaterialIcon name="medical-services" size={18} color={C.success} />
            <Text style={s.benefitText}>{t('insurance.benefit2')}</Text>
          </View>
          <View style={s.benefitRow}>
            <MaterialIcon name="verified-user" size={18} color={C.success} />
            <Text style={s.benefitText}>{t('insurance.benefit3')}</Text>
          </View>
          <TouchableOpacity
            style={s.learnMoreBtn}
            onPress={() => Linking.openURL('https://fixhomi.com/insurance')}
            activeOpacity={0.7}
          >
            <Text style={s.learnMoreText}>{t('insurance.learnMore')}</Text>
            <MaterialIcon name="open-in-new" size={14} color={C.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Sticky Submit Button ──────────────────────────── */}
      {canSubmit && (
        <View style={[s.stickyFooter, { bottom: insets.bottom, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[s.submitBtn, (!hasPAN || !hasAddressProof) && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting || (!hasPAN || !hasAddressProof)}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcon name="cloud-upload" size={20} color="#fff" />
                <Text style={s.submitBtnText}>
                  {isRejected ? t('insurance.resubmitDocuments') : t('insurance.submitForVerification')}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {(!hasPAN || !hasAddressProof) && (
            <Text style={s.submitHint}>
              {!hasPAN ? t('insurance.panRequired') : t('insurance.addressProofRequired')}
            </Text>
          )}
        </View>
      )}

      {/* ── Submission Overlay ──────────────────────────── */}
      {submitting && (
        <View style={s.submittingOverlay}>
          <View style={s.submittingCard}>
            <ActivityIndicator size="large" color={C.secondary} />
            <Text style={s.submittingTitle}>{t('insurance.uploadingDocuments')}</Text>
            <Text style={s.submittingSubtitle}>{t('insurance.uploadingDocumentsMsg')}</Text>
          </View>
        </View>
      )}

      {/* ── Image Viewer Modal ────────────────────────────── */}
      <ImageViewerModal
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Hero Header
  heroHeader: {
    backgroundColor: C.dark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: C.card, letterSpacing: -0.3 },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: C.textSec },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Status Banner
  statusBanner: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  statusBannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  statusSubtitle: { fontSize: 13, color: C.textSec, lineHeight: 19 },

  // Info Banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.secondary + '15' },
  infoBannerText: { flex: 1, fontSize: 12, color: C.secondary, lineHeight: 17 },

  // Address Proof Note
  addressProofNote: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  addressProofNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  addressProofNoteTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  addressProofNoteText: { fontSize: 12, color: C.textSec, lineHeight: 19 },

  // Document Card
  docCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
  docCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  docIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.iconBg, alignItems: 'center', justifyContent: 'center' },
  docIconCircleActive: { backgroundColor: '#D1FAE5' },
  docTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  docTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  docDesc: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },

  // Badges
  requiredBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  requiredBadgeText: { fontSize: 10, fontWeight: '700', color: C.danger },
  optionalBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  optionalBadgeText: { fontSize: 10, fontWeight: '700', color: C.secondary },

  // Rejection
  rejectionStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#FECACA' },
  rejectionText: { flex: 1, fontSize: 12, color: '#991B1B', lineHeight: 17 },

  // Document Preview
  docPreview: { backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden' },
  docPreviewImage: { width: '100%', height: 160, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  docThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
  pdfThumb: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', gap: 6 },
  pdfName: { fontSize: 12, color: C.textSec, maxWidth: '80%' },
  docPreviewMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },

  // Upload Button
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: C.secondary + '25', borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 14, fontWeight: '700', color: C.secondary },
  uploadBtnHint: { fontSize: 11, color: C.muted, marginTop: 1 },

  // T&C
  tcNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  tcText: { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18 },
  tcLink: { color: C.secondary, fontWeight: '600', textDecorationLine: 'underline' },

  // Benefits
  benefitsCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  benefitsTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12, letterSpacing: -0.2 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  benefitText: { fontSize: 13, color: C.textSec, flex: 1 },
  learnMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  learnMoreText: { fontSize: 13, fontWeight: '700', color: C.secondary },

  // Sticky Footer
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingTop: 12, ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 8 } }) },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.secondary, borderRadius: 14, paddingVertical: 15, minHeight: 52 },
  submitBtnDisabled: { backgroundColor: C.muted, opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  submitHint: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 6 },

  // Submission overlay
  submittingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 100, alignItems: 'center', justifyContent: 'center' },
  submittingCard: { backgroundColor: C.card, borderRadius: 20, padding: 32, alignItems: 'center', marginHorizontal: 40, gap: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 }, android: { elevation: 12 } }) },
  submittingTitle: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  submittingSubtitle: { fontSize: 13, color: C.textSec, textAlign: 'center', lineHeight: 19 },
});

export default InsuranceScreen;
