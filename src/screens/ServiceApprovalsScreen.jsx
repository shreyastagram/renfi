/**
 * Service Approvals Screen (RSAS - Request Service Approvals Section)
 * 
 * Production-grade screen for providers to:
 * - Request approval for new services
 * - View verification status with filtering/sorting
 * - See rejection reasons and resubmit
 * - Preview uploaded documents
 * 
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
  RefreshControl,
  Animated,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { pick, types, keepLocalCopy } from '@react-native-documents/picker';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { NODE_BASE_URL as API_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';
import { requestCameraPermission, requestGalleryPermission } from '../utils/permissions';
import ScreenShimmer from '../components/ShimmerLoader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

import { uploadDocument } from '../services/cloudinaryService';

/**
 * Document type labels
 */
const DOCUMENT_LABELS = {
  // Current document types
  skill_certificate: 'Skill Certificate (ITI / Vocational / Diploma / Contractor Auth)',
  driving_license: 'Driving License (Valid)',
  commercial_driving_license: 'Commercial Driving License (Transport / LMV-TR)',
  salon_license: 'Salon License',
  beauty_certificate: 'Beauty Course Certificate',
  social_media_verification: 'Social Media Verification',
  business_registration: 'Business Registration Certificate',
  gst_certificate: 'GST Certificate',
  trade_license: 'Municipal Trade License',
  portfolio_proof: 'Portfolio Proof (Website / Social Media / Studio)',
  wildlife_rescue_certificate: 'Wildlife Rescue Authorization Certificate',
  pan_card: 'PAN Card',
  voter_id: 'Voter ID',
  vehicle_photo: 'Vehicle Photo with Number Plate',
  vehicle_rc: 'Vehicle RC',
  staff_id_proof: 'Staff ID Proof',
  bls_als_certificate: 'BLS/ALS Certificate',
  mortuary_certificate: 'Mortuary Services Certificate',
  e_shram_card: 'E-Shram Card',
  // Legacy labels (for viewing old submissions)
  experience_proof: 'Experience Proof',
  iti_diploma: 'ITI/Diploma Certificate',
  trade_certificate: 'Trade Training Certificate',
  shop_license: 'Shop License',
  gst_registration: 'GST Registration',
  vehicle_insurance: 'Vehicle Insurance',
  commercial_badge: 'Commercial Badge',
  id_proof: 'ID Proof',
  forest_department_certificate: 'Forest Dept. Certificate',
  firefighting_certificate: 'Firefighting Certificate',
};

/**
 * Service category labels
 */
const SERVICE_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  carpenter: 'Carpenter',
  painter: 'Painter',
  welder: 'Welder',
  electronics_technician: 'Electronics Technician (AC/Fridge/TV)',
  solar_repairing: 'Solar Installer/Repairer',
  salon: 'Salon/Beautician',
  driver: 'Driver (Car/Taxi/Auto)',
  mason_tiler: 'Mason/Tiler',
  influencer: 'Influencer',
  vehicle_cleaning: 'Vehicle Cleaning',
  snake_catcher: 'Snake Catcher / Wildlife Rescuer',
  ambulance_services: 'Private Ambulance Service',
  fire_brigade: 'Fire Brigade/Services',
  mortuary_van: 'Mortuary Van Service',
  photographer: 'Photographer',
  ac_repair: 'AC Repair',
  cleaning: 'Cleaning Services',
};

/**
 * Status configuration with colors, icons, and labels
 * UNIFIED COLOR PALETTE: Brand Orange, Grey tones
 */
const STATUS_CONFIG = {
  not_submitted: {
    color: '#9CA3AF',
    bgColor: '#F5F5F7',
    icon: 'add-circle-outline',
    label: 'Not Applied',
    description: 'Apply for this service',
  },
  pending: {
    color: '#f67c16',
    bgColor: '#FFF7ED',
    icon: 'hourglass-empty',
    label: 'Pending',
    description: 'Awaiting admin review',
  },
  under_review: {
    color: '#2b76bc',
    bgColor: '#EFF6FF',
    icon: 'visibility',
    label: 'Under Review',
    description: 'Documents being verified',
  },
  approved: {
    color: '#2b76bc',
    bgColor: '#EFF6FF',
    icon: 'verified',
    label: 'Approved',
    description: 'You can receive requests',
  },
  rejected: {
    color: '#6B7280',
    bgColor: '#F5F5F7',
    icon: 'error',
    label: 'Rejected',
    description: 'Please resubmit documents',
  },
};

/**
 * Filter tabs for status - Brand colors only
 */
const FILTER_TABS = [
  { key: 'all', label: 'All', color: '#374151' },
  { key: 'approved', label: 'Approved', color: '#2b76bc' },
  { key: 'pending', label: 'Pending', color: '#f67c16' },
  { key: 'rejected', label: 'Rejected', color: '#6B7280' },
];

// Brand colors
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue
  background: '#faf7f7',
  white: '#FFFFFF',
};

// ============================================
// COMPONENTS
// ============================================

/**
 * Filter Tab Component - Compact chip style
 */
const FilterTab = ({ tab, isActive, onPress, count }) => (
  <TouchableOpacity
    style={[
      styles.filterTab,
      isActive && { backgroundColor: tab.color, borderColor: tab.color },
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
      {tab.label}
    </Text>
    {count > 0 && (
      <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
        <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

/**
 * Service Request Card - Expandable
 */
const ServiceRequestCard = ({
  service,
  status,
  documents,
  rejectionReason,
  submittedAt,
  reviewedAt,
  onViewDetails,
  onResubmit,
  onCancel,
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_submitted;
  const hasDocuments = documents && documents.length > 0;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <TouchableOpacity
      style={styles.serviceRequestCard}
      onPress={onViewDetails}
      activeOpacity={0.7}
    >
      {/* Status Indicator Bar */}
      <View style={[styles.statusBar, { backgroundColor: config.color }]} />

      <View style={styles.serviceRequestContent}>
        {/* Header */}
        <View style={styles.serviceRequestHeader}>
          <View style={styles.serviceRequestHeaderLeft}>
            <View style={[styles.serviceIconContainer, { backgroundColor: config.bgColor }]}>
              <MaterialIcon name={config.icon} size={24} color={config.color} />
            </View>
            <View style={styles.serviceRequestInfo}>
              <Text style={styles.serviceRequestTitle}>
                {SERVICE_LABELS[service] || service}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: config.bgColor }]}>
                  <MaterialIcon name={config.icon} size={12} color={config.color} />
                  <Text style={[styles.statusPillText, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>
                {submittedAt && (
                  <Text style={styles.dateText}>
                    Applied: {formatDate(submittedAt)}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <MaterialIcon name="chevron-right" size={24} color="#9CA3AF" />
        </View>

        {/* Rejection Reason Alert */}
        {status === 'rejected' && rejectionReason && (
          <View style={styles.rejectionAlert}>
            <View style={styles.rejectionAlertHeader}>
              <MaterialIcon name="info" size={18} color="#DC2626" />
              <Text style={styles.rejectionAlertTitle}>Rejection Reason</Text>
            </View>
            <Text style={styles.rejectionAlertText}>{rejectionReason}</Text>
            {reviewedAt && (
              <Text style={styles.reviewedAtText}>
                Reviewed on {formatDate(reviewedAt)}
              </Text>
            )}
          </View>
        )}

        {/* Document Count */}
        {hasDocuments && (
          <View style={styles.documentCountRow}>
            <MaterialIcon name="folder" size={16} color="#6B7280" />
            <Text style={styles.documentCountText}>
              {documents.length} document{documents.length > 1 ? 's' : ''} uploaded
            </Text>
            <MaterialIcon name="visibility" size={16} color={BRAND.secondary} />
            <Text style={styles.viewDocsText}>View</Text>
          </View>
        )}

        {/* Action Buttons */}
        {(status === 'rejected' || status === 'pending' || status === 'under_review') && (
          <View style={styles.actionButtonsRow}>
            {status === 'rejected' && (
              <TouchableOpacity
                style={styles.resubmitButton}
                onPress={onResubmit}
              >
                <MaterialIcon name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.resubmitButtonText}>Resubmit</Text>
              </TouchableOpacity>
            )}
            {(status === 'pending' || status === 'under_review') && (
              <TouchableOpacity
                style={styles.cancelRequestButton}
                onPress={onCancel}
              >
                <MaterialIcon name="close" size={16} color="#EF4444" />
                <Text style={styles.cancelRequestButtonText}>Cancel Request</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

/**
 * Zoomable Image Component with pinch-to-zoom and pan gestures
 */
const ZoomableImage = ({ uri, onClose }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  const baseScale = useRef(1);
  const pinchScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });
  const panEnabled = useRef(false);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const newScale = baseScale.current * event.nativeEvent.scale;
      const clampedScale = Math.min(Math.max(newScale, 1), 5);
      baseScale.current = clampedScale;
      pinchScale.current = clampedScale;
      panEnabled.current = clampedScale > 1;
      
      // Reset to bounds if zoomed out
      if (clampedScale <= 1) {
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
        baseScale.current = 1;
        lastOffset.current = { x: 0, y: 0 };
      } else {
        scale.setValue(clampedScale);
      }
    }
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const maxOffsetX = (SCREEN_WIDTH * (pinchScale.current - 1)) / 2;
      const maxOffsetY = (SCREEN_HEIGHT * (pinchScale.current - 1)) / 3;
      
      const newX = lastOffset.current.x + event.nativeEvent.translationX;
      const newY = lastOffset.current.y + event.nativeEvent.translationY;
      
      const clampedX = Math.min(Math.max(newX, -maxOffsetX), maxOffsetX);
      const clampedY = Math.min(Math.max(newY, -maxOffsetY), maxOffsetY);
      
      lastOffset.current = { x: clampedX, y: clampedY };
      translateX.setOffset(clampedX);
      translateX.setValue(0);
      translateY.setOffset(clampedY);
      translateY.setValue(0);
    }
  };

  const onDoubleTap = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (baseScale.current > 1) {
        // Zoom out
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
        baseScale.current = 1;
        pinchScale.current = 1;
        lastOffset.current = { x: 0, y: 0 };
        translateX.setOffset(0);
        translateY.setOffset(0);
        panEnabled.current = false;
      } else {
        // Zoom in to 2.5x
        Animated.spring(scale, { toValue: 2.5, useNativeDriver: true }).start();
        baseScale.current = 2.5;
        pinchScale.current = 2.5;
        panEnabled.current = true;
      }
    }
  };

  const panRef = useRef();
  const pinchRef = useRef();
  const doubleTapRef = useRef();

  return (
    <GestureHandlerRootView style={styles.zoomableContainer}>
      <TapGestureHandler
        ref={doubleTapRef}
        onHandlerStateChange={onDoubleTap}
        numberOfTaps={2}
      >
        <Animated.View style={styles.zoomableContainer}>
          <PinchGestureHandler
            ref={pinchRef}
            simultaneousHandlers={panRef}
            onGestureEvent={onPinchGestureEvent}
            onHandlerStateChange={onPinchHandlerStateChange}
          >
            <Animated.View style={styles.zoomableContainer}>
              <PanGestureHandler
                ref={panRef}
                simultaneousHandlers={pinchRef}
                onGestureEvent={onPanGestureEvent}
                onHandlerStateChange={onPanHandlerStateChange}
                minPointers={1}
                maxPointers={2}
              >
                <Animated.Image
                  source={{ uri }}
                  style={[
                    styles.zoomableImage,
                    {
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
              </PanGestureHandler>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
};

/**
 * Document Preview Modal - Full Gallery Experience
 */
const DocumentPreviewModal = ({ visible, service, documents, status, rejectionReason, onClose }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_submitted;

  if (!documents || documents.length === 0) return null;

  const currentDoc = documents[selectedDocIndex];
  const isImage = currentDoc?.fileType?.includes('image') ||
    ['jpg', 'jpeg', 'png', 'webp'].some(t => currentDoc?.fileType?.includes(t));

  const openPdfExternally = () => {
    if (currentDoc?.fileUrl) {
      Linking.openURL(currentDoc.fileUrl).catch(() => {
        dialog('Error', 'Unable to open PDF');
      });
    }
  };

  const goToPrevious = () => {
    if (selectedDocIndex > 0) {
      setSelectedDocIndex(selectedDocIndex - 1);
      setImageLoading(true);
    }
  };

  const goToNext = () => {
    if (selectedDocIndex < documents.length - 1) {
      setSelectedDocIndex(selectedDocIndex + 1);
      setImageLoading(true);
    }
  };

  // Fullscreen image viewer
  if (isFullscreen && isImage) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
        statusBarTranslucent
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />
          
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.fullscreenCloseButton, { top: insets.top + 10 }]}
            onPress={() => setIsFullscreen(false)}
          >
            <MaterialIcon name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Image Counter */}
          <View style={[styles.imageCounter, { top: insets.top + 16 }]}>
            <Text style={styles.imageCounterText}>
              {selectedDocIndex + 1} / {documents.length}
            </Text>
          </View>

          {/* Zoomable Image */}
          <ZoomableImage uri={currentDoc.fileUrl} />

          {/* Navigation Arrows */}
          {documents.length > 1 && (
            <>
              {selectedDocIndex > 0 && (
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowLeft]}
                  onPress={goToPrevious}
                >
                  <MaterialIcon name="chevron-left" size={40} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {selectedDocIndex < documents.length - 1 && (
                <TouchableOpacity
                  style={[styles.navArrow, styles.navArrowRight]}
                  onPress={goToNext}
                >
                  <MaterialIcon name="chevron-right" size={40} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Bottom Info Bar */}
          <View style={[styles.fullscreenInfoBar, { bottom: 0, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
            <Text style={styles.fullscreenDocName} numberOfLines={1}>
              {DOCUMENT_LABELS[currentDoc.documentType] || currentDoc.documentType}
            </Text>
            <Text style={styles.fullscreenHint}>Double-tap to zoom • Pinch to adjust</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <MaterialIcon name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {SERVICE_LABELS[service] || service}
            </Text>
            <View style={[styles.modalStatusBadge, { backgroundColor: config.bgColor }]}>
              <MaterialIcon name={config.icon} size={14} color={config.color} />
              <Text style={[styles.modalStatusText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Rejection Banner */}
        {status === 'rejected' && rejectionReason && (
          <View style={styles.modalRejectionBanner}>
            <MaterialIcon name="warning" size={20} color="#FFFFFF" />
            <View style={styles.modalRejectionContent}>
              <Text style={styles.modalRejectionTitle}>Application Rejected</Text>
              <Text style={styles.modalRejectionText}>{rejectionReason}</Text>
            </View>
          </View>
        )}

        {/* Document Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.documentTabs}
          contentContainerStyle={styles.documentTabsContent}
        >
          {documents.map((doc, index) => (
            <TouchableOpacity
              key={doc._id || index}
              style={[
                styles.documentTab,
                selectedDocIndex === index && styles.documentTabActive,
              ]}
              onPress={() => {
                setSelectedDocIndex(index);
                setImageLoading(true);
              }}
            >
              <MaterialIcon
                name={doc.fileType?.includes('pdf') ? 'picture-as-pdf' : 'image'}
                size={16}
                color={selectedDocIndex === index ? BRAND.secondary : '#6B7280'}
              />
              <Text
                style={[
                  styles.documentTabText,
                  selectedDocIndex === index && styles.documentTabTextActive,
                ]}
                numberOfLines={1}
              >
                {DOCUMENT_LABELS[doc.documentType] || doc.documentType}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Document Preview */}
        <TouchableOpacity
          style={styles.documentPreviewContainer}
          activeOpacity={isImage ? 0.9 : 1}
          onPress={() => isImage && setIsFullscreen(true)}
        >
          {isImage ? (
            <>
              {imageLoading && (
                <View style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="large" color={BRAND.primary} />
                  <Text style={styles.imageLoadingText}>Loading image...</Text>
                </View>
              )}
              <Image
                source={{ uri: currentDoc.fileUrl }}
                style={[styles.documentPreviewImage, imageLoading && { opacity: 0 }]}
                resizeMode="contain"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
              {!imageLoading && (
                <View style={styles.tapToZoomHint}>
                  <MaterialIcon name="zoom-in" size={18} color="#FFFFFF" />
                  <Text style={styles.tapToZoomText}>Tap to view full size</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.pdfPreviewContainer}>
              <MaterialIcon name="picture-as-pdf" size={64} color="#EF4444" />
              <Text style={styles.pdfFileName}>{currentDoc.fileName}</Text>
              <Text style={styles.pdfHint}>PDF Preview not available in-app</Text>
              <TouchableOpacity style={styles.openPdfButton} onPress={openPdfExternally}>
                <MaterialIcon name="open-in-new" size={16} color={BRAND.secondary} />
                <Text style={styles.openPdfButtonText}>Open PDF Externally</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* Document Info */}
        <View style={[styles.documentInfoBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.documentInfoItem}>
            <MaterialIcon name="insert-drive-file" size={16} color="#6B7280" />
            <Text style={styles.documentInfoText} numberOfLines={1}>{currentDoc.fileName}</Text>
          </View>
          <View style={styles.documentInfoItem}>
            <MaterialIcon name="cloud-done" size={16} color="#22C55E" />
            <Text style={styles.documentInfoText}>
              {new Date(currentDoc.uploadedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Empty State Component
 */
const EmptyState = ({ filter, onAddService }) => {
  const messages = {
    all: {
      title: 'No Service Requests Yet',
      description: 'Start by requesting approval for services you want to offer to customers.',
      buttonText: 'Request Service Approval',
    },
    approved: {
      title: 'No Approved Services',
      description: 'Your approved services will appear here once verified by our team.',
      buttonText: null,
    },
    pending: {
      title: 'No Pending Requests',
      description: 'You don\'t have any requests awaiting review.',
      buttonText: 'Request New Service',
    },
    rejected: {
      title: 'No Rejected Requests',
      description: 'Great! None of your requests have been rejected.',
      buttonText: null,
    },
  };

  const content = messages[filter] || messages.all;

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIconContainer}>
        <MaterialIcon name="assignment" size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyStateTitle}>{content.title}</Text>
      <Text style={styles.emptyStateDescription}>{content.description}</Text>
      {content.buttonText && (
        <TouchableOpacity style={styles.emptyStateButton} onPress={onAddService}>
          <MaterialIcon name="add" size={20} color="#FFFFFF" />
          <Text style={styles.emptyStateButtonText}>{content.buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Statistics Banner - Unified brand colors
 */
const StatsBanner = ({ approved, pending, rejected }) => (
  <View style={styles.statsBanner}>
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
        <MaterialIcon name="verified" size={14} color={BRAND.secondary} />
      </View>
      <View>
        <Text style={styles.statValue}>{approved}</Text>
        <Text style={styles.statLabel}>Approved</Text>
      </View>
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: '#FFF7ED' }]}>
        <MaterialIcon name="schedule" size={14} color={BRAND.primary} />
      </View>
      <View>
        <Text style={styles.statValue}>{pending}</Text>
        <Text style={styles.statLabel}>Pending</Text>
      </View>
    </View>
    <View style={styles.statDivider} />
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: '#F5F5F7' }]}>
        <MaterialIcon name="cancel" size={14} color="#6B7280" />
      </View>
      <View>
        <Text style={styles.statValue}>{rejected}</Text>
        <Text style={styles.statLabel}>Rejected</Text>
      </View>
    </View>
  </View>
);

// ============================================
// MAIN SCREEN
// ============================================

const ServiceApprovalsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, userType, refreshProfile } = useApp();
  const { dialog } = useDialog();

  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]); // Full service data with documents
  const [activeFilter, setActiveFilter] = useState('all');
  const [step, setStep] = useState('list'); // 'list' | 'select' | 'upload'
  const [selectedServices, setSelectedServices] = useState([]);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [submittedServices, setSubmittedServices] = useState(new Set()); // Services successfully submitted this session

  // Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedServiceForModal, setSelectedServiceForModal] = useState(null);

  /**
   * Fetch with timeout and retry
   */
  const fetchWithRetry = async (url, options = {}, retries = 2, timeout = 10000) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (attempt === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  };

  /**
   * Fetch all data
   */
  const fetchData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      // Fetch categories
      const categoriesResponse = await fetchWithRetry(`${API_BASE_URL}/api/verification/categories`);
      const categoriesData = await categoriesResponse.json();

      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      }

      // Fetch provider's verification status
      if (providerId) {
        const tokens = await getTokens();
        const statusResponse = await fetchWithRetry(
          `${API_BASE_URL}/api/verification/${providerId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${tokens?.accessToken}`,
            },
          }
        );
        const statusData = await statusResponse.json();

        if (statusData.success && statusData.verification?.services) {
          setServices(statusData.verification.services);
        }
      }
    } catch (error) {
      console.error('[ServiceApprovals] Error fetching data:', error);
      if (!refreshing) {
        dialog(
          'Connection Issue',
          'Couldn\'t load approvals. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => fetchData() },
          ]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [providerId]);

  // Refresh profile when screen focuses to get latest verification status
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (providerId && userType) {
        refreshProfile(userType, providerId, { force: true });
      }
    });
    return unsubscribe;
  }, [navigation, providerId, userType, refreshProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  /**
   * Filter services based on active filter
   */
  const filteredServices = useMemo(() => {
    if (activeFilter === 'all') return services;
    if (activeFilter === 'pending') {
      return services.filter(s => s.status === 'pending' || s.status === 'under_review');
    }
    return services.filter(s => s.status === activeFilter);
  }, [services, activeFilter]);

  /**
   * Calculate stats
   */
  const stats = useMemo(() => ({
    approved: services.filter(s => s.status === 'approved').length,
    pending: services.filter(s => s.status === 'pending' || s.status === 'under_review').length,
    rejected: services.filter(s => s.status === 'rejected').length,
  }), [services]);

  /**
   * Get count for filter tab
   */
  const getFilterCount = (filterKey) => {
    if (filterKey === 'all') return services.length;
    if (filterKey === 'pending') {
      return services.filter(s => s.status === 'pending' || s.status === 'under_review').length;
    }
    return services.filter(s => s.status === filterKey).length;
  };

  /**
   * Handle view service details
   */
  const handleViewDetails = (service) => {
    setSelectedServiceForModal(service);
    setDetailModalVisible(true);
  };

  /**
   * Handle resubmit
   */
  const handleResubmit = (service) => {
    setSelectedServices([service.serviceCategory]);
    setDocuments({});
    setCurrentServiceIndex(0);
    setSubmittedServices(new Set());
    setStep('upload');
  };

  /**
   * Handle cancel request
   */
  const handleCancelRequest = (serviceCategory) => {
    dialog(
      'Cancel Request',
      `Are you sure you want to cancel your ${SERVICE_LABELS[serviceCategory]} approval request? You can reapply later.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const tokens = await getTokens();

              const response = await fetchWithRetry(
                `${API_BASE_URL}/api/verification/${providerId}/service/${serviceCategory}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${tokens?.accessToken}`,
                  },
                },
                2,
                15000
              );

              const result = await response.json();

              if (result.success) {
                dialog('Success', 'Request cancelled successfully.');
                refreshProfile?.();
                fetchData();
              } else {
                throw new Error(result.error || 'Failed to cancel request');
              }
            } catch (error) {
              dialog('Error', error.message || 'Failed to cancel. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Start new service request
   * Gate: Provider must have phone, email, and Aadhaar verified before submitting
   */
  const startNewRequest = () => {
    const isIdentityVerified = profile?.phoneVerified && profile?.emailVerified && profile?.aadhaarVerification?.isVerified;
    if (!isIdentityVerified) {
      dialog(
        'Verification Required',
        'Complete phone, email, and Aadhaar verification before submitting documents for service approval.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedServices([]);
    setDocuments({});
    setCurrentServiceIndex(0);
    setSubmittedServices(new Set());
    setStep('select');
  };

  /**
   * Toggle service selection
   */
  const toggleService = (serviceKey) => {
    const existingService = services.find(s => s.serviceCategory === serviceKey);

    if (existingService) {
      if (existingService.status === 'pending' || existingService.status === 'under_review') {
        dialog('Under Review', 'This service is currently under review.');
        return;
      }
      if (existingService.status === 'approved') {
        dialog('Already Approved', 'This service is already approved.');
        return;
      }
    }

    setSelectedServices(prev => {
      if (prev.includes(serviceKey)) {
        return prev.filter(s => s !== serviceKey);
      }
      return [...prev, serviceKey];
    });
  };

  /**
   * Get requirements for current service
   */
  /**
   * Get all document types needed for a service category.
   * Returns { allDocs: [...docType], required: [...], anyOneOf: [...], optional: [...] }
   */
  const getServiceRequirements = (serviceKey) => {
    const category = categories.find(c => c.key === serviceKey);
    const reqs = category?.requirements;
    if (reqs && reqs.required) {
      // New structure: { required, anyOneOf, optional }
      return {
        required: reqs.required || [],
        anyOneOf: reqs.anyOneOf || [],
        optional: reqs.optional || [],
        allDocs: [...(reqs.required || []), ...(reqs.anyOneOf || []), ...(reqs.optional || [])],
      };
    }
    // Legacy fallback: flat array (old backend)
    const flat = category?.requiredDocuments || [];
    return { required: flat, anyOneOf: [], optional: [], allDocs: flat };
  };

  const getCurrentServiceRequirements = () => {
    return getServiceRequirements(selectedServices[currentServiceIndex]).allDocs;
  };

  /**
   * Pick document
   */
  const pickDocument = async (serviceCategory, documentType) => {
    dialog(
      'Upload Document',
      'Choose upload method',
      [
        { text: 'Camera', onPress: () => captureFromCamera(serviceCategory, documentType) },
        { text: 'Gallery', onPress: () => pickFromGallery(serviceCategory, documentType) },
        { text: 'PDF File', onPress: () => pickPDF(serviceCategory, documentType) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const captureFromCamera = async (serviceCategory, documentType) => {
    try {
      const granted = await requestCameraPermission(dialog);
      if (!granted) return;

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (!result.didCancel && result.assets?.[0]) {
        stageDocument(serviceCategory, documentType, result.assets[0]);
      }
    } catch (error) {
      dialog('Error', 'Failed to capture image');
    }
  };

  const pickFromGallery = async (serviceCategory, documentType) => {
    try {
      const granted = await requestGalleryPermission(dialog);
      if (!granted) return;

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (!result.didCancel && result.assets?.[0]) {
        stageDocument(serviceCategory, documentType, result.assets[0]);
      }
    } catch (error) {
      dialog('Error', 'Failed to pick image');
    }
  };

  const pickPDF = async (serviceCategory, documentType) => {
    // iOS modal-in-modal prevention: this function is called from a dialog's
    // onPress handler. When the user taps "PDF File", the dialog starts
    // dismissing (animating out, ~300ms). Meanwhile, the document picker
    // (UIDocumentPickerViewController) tries to present its own modal — iOS
    // rejects this because only one modal can be presented/dismissed at a time.
    // Result: picker fails silently, dialog just closes, user sees nothing.
    // Fix: wait for the dialog's dismiss animation to complete before opening
    // the picker. 400ms = dialog fade-out (~300ms) + safety margin.
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    try {
      const result = await pick({ type: [types.pdf] });

      if (result?.[0]) {
        let fileUri = result[0].uri;
        const fileName = result[0].name || 'document.pdf';

        // iOS: Copy the picked file into the app's cache directory.
        // iOS document picker returns a security-scoped URL that's only valid
        // inside the picker callback window. Storing it in state and using it
        // later (on submit) fails because the scope has expired, leading to a
        // misleading "Network request failed" / "No internet" error at upload.
        // keepLocalCopy gives us a sandbox-local URI safe to use anytime.
        if (Platform.OS === 'ios') {
          try {
            const copies = await keepLocalCopy({
              files: [{ uri: result[0].uri, fileName }],
              destination: 'cachesDirectory',
            });
            if (copies?.[0]?.status === 'success' && copies[0].localUri) {
              fileUri = copies[0].localUri;
            } else {
              console.warn('[RSAS] iOS keepLocalCopy failed, using original URI:', copies?.[0]);
            }
          } catch (copyErr) {
            console.warn('[RSAS] iOS keepLocalCopy threw, using original URI:', copyErr);
          }
        }

        stageDocument(serviceCategory, documentType, {
          uri: fileUri,
          fileName,
          type: 'application/pdf',
          fileSize: result[0].size,
        });
      }
    } catch (error) {
      // Cancel detection — v12 uses OPERATION_CANCELED; older library used DOCUMENT_PICKER_CANCELED
      const isCancel =
        error?.code === 'DOCUMENT_PICKER_CANCELED' ||
        error?.code === 'OPERATION_CANCELED' ||
        /cancel/i.test(error?.message || '');
      if (!isCancel) {
        console.error('[RSAS] pickPDF error:', error?.code, error?.message, error);
        dialog('Error', 'Failed to pick PDF');
      }
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const stageDocument = (serviceCategory, documentType, asset) => {
    const fileSize = asset.fileSize || asset.size || 0;

    // Frontend file size validation — fail fast instead of waiting for backend
    if (fileSize > MAX_FILE_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      dialog(
        'File Too Large',
        `This file is ${sizeMB} MB. Maximum allowed size is 10 MB. Please choose a smaller file or compress it.`,
      );
      return;
    }

    setDocuments(prev => ({
      ...prev,
      [serviceCategory]: {
        ...prev[serviceCategory],
        [documentType]: {
          localUri: asset.uri,
          fileName: asset.fileName || asset.name || 'document',
          fileType: asset.type || 'image/jpeg',
          fileSize,
          isStaged: true,
        },
      },
    }));
  };

  const removeDocument = (serviceCategory, documentType) => {
    setDocuments(prev => ({
      ...prev,
      [serviceCategory]: {
        ...prev[serviceCategory],
        [documentType]: null,
      },
    }));
  };

  /**
   * Upload to Cloudinary
   */
  const uploadToCloudinary = async (file, serviceCategory, documentType) => {
    try {
      const data = await uploadDocument({
        uri: file.localUri,
        type: file.fileType || 'image/jpeg',
        fileName: file.fileName || `document_${Date.now()}.jpg`,
        context: 'service_approvals',
        serviceCategory,
      });

      return {
        documentType,
        fileUrl: data.secure_url,
        publicId: data.public_id,
        fileName: file.fileName,
        fileType: data.format || file.fileType,
        fileSize: file.fileSize,
      };
    } catch (error) {
      console.error('[RSAS] Upload error:', error);
      const msg = error.name === 'AbortError'
        ? 'Upload timed out. Please check your internet connection and try again.'
        : error.message?.includes('Network')
          ? 'No internet connection. Please check your network and try again.'
          : `Upload failed. Please try again.`;
      throw new Error(msg);
    }
  };

  /**
   * Check if a specific service has all required documents
   */
  const isServiceComplete = (serviceKey) => {
    const { required, anyOneOf } = getServiceRequirements(serviceKey);
    const serviceDocs = documents[serviceKey] || {};
    const hasDoc = (docType) => serviceDocs[docType]?.localUri || serviceDocs[docType]?.fileUrl;

    // All required docs must be present
    const allRequiredMet = required.length > 0 && required.every(hasDoc);
    // At least one from anyOneOf must be present (if the group is non-empty)
    const anyOneOfMet = anyOneOf.length === 0 || anyOneOf.some(hasDoc);

    return allRequiredMet && anyOneOfMet;
  };

  /**
   * Check if current service is complete
   */
  const isCurrentServiceComplete = () => isServiceComplete(selectedServices[currentServiceIndex]);

  /**
   * Check if ALL selected services have all required documents uploaded
   */
  const areAllServicesComplete = () => {
    return selectedServices.every(svc => submittedServices.has(svc) || isServiceComplete(svc));
  };

  /**
   * Find first incomplete service (for navigation after error)
   */
  const findFirstIncompleteService = () => {
    return selectedServices.findIndex(svc => !submittedServices.has(svc) && !isServiceComplete(svc));
  };

  /**
   * Handle next/submit
   */
  const handleNext = async () => {
    if (currentServiceIndex < selectedServices.length - 1) {
      setCurrentServiceIndex(prev => prev + 1);
    } else {
      // On the last service — check ALL services before submitting
      if (!areAllServicesComplete()) {
        const incompleteIdx = findFirstIncompleteService();
        if (incompleteIdx >= 0) {
          const incompleteLabel = SERVICE_LABELS[selectedServices[incompleteIdx]] || selectedServices[incompleteIdx];
          dialog(
            'Missing Documents',
            `Please upload all required documents for ${incompleteLabel} before submitting.`,
            [{
              text: 'Go There',
              onPress: () => setCurrentServiceIndex(incompleteIdx),
            }]
          );
        }
        return;
      }
      await handleSubmit();
    }
  };

  /**
   * Submit all documents
   */
  const submitLockRef = useRef(false);

  const handleSubmit = async () => {
    // Prevent duplicate submissions from rapid taps
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setSubmitting(true);
    setUploading(true);

    // Only submit services that haven't been successfully submitted yet
    const pendingServices = selectedServices.filter(svc => !submittedServices.has(svc));
    const total = pendingServices.length;
    let failedService = null;

    try {
      const tokens = await getTokens();

      for (let i = 0; i < total; i++) {
        const serviceCategory = pendingServices[i];
        const serviceLabel = SERVICE_LABELS[serviceCategory] || serviceCategory;
        const serviceDocs = documents[serviceCategory] || {};
        const uploadedDocs = [];
        failedService = serviceCategory;

        // Upload staged documents
        setSubmitProgress(`Uploading ${serviceLabel} (${i + 1}/${total})...`);

        for (const [docType, doc] of Object.entries(serviceDocs)) {
          if (doc?.isStaged && doc?.localUri) {
            const uploaded = await uploadToCloudinary(doc, serviceCategory, docType);
            uploadedDocs.push(uploaded);
          } else if (doc?.fileUrl) {
            uploadedDocs.push({
              documentType: docType,
              fileUrl: doc.fileUrl,
              publicId: doc.publicId,
              fileName: doc.fileName,
              fileType: doc.fileType,
              fileSize: doc.fileSize,
            });
          }
        }

        // Submit to backend
        setSubmitProgress(`Submitting ${serviceLabel} (${i + 1}/${total})...`);

        const response = await fetchWithRetry(
          `${API_BASE_URL}/api/verification/${providerId}/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens?.accessToken}`,
            },
            body: JSON.stringify({
              serviceCategory,
              documents: uploadedDocs,
            }),
          },
          2,
          30000
        );

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Submission failed for ${serviceLabel}`);
        }

        // Mark this service as successfully submitted (locked for this session)
        setSubmittedServices(prev => new Set([...prev, serviceCategory]));
        failedService = null;
      }

      dialog(
        'Success',
        'Your documents have been submitted for review. We will notify you once verified.',
        [{ text: 'OK' }]
      );

      refreshProfile?.();
      fetchData();
      setStep('list');
    } catch (error) {
      // Navigate to the failed service so user can fix and retry
      if (failedService) {
        const failedIdx = selectedServices.indexOf(failedService);
        if (failedIdx >= 0) {
          setCurrentServiceIndex(failedIdx);
        }
      }
      const successCount = submittedServices.size;
      const msg = successCount > 0
        ? `${error.message}\n\n${successCount} service(s) were submitted successfully. Please fix the issue and retry the remaining.`
        : (error.message || 'Failed to submit. Please try again.');
      dialog('Submission Error', msg);
    } finally {
      setSubmitting(false);
      setUploading(false);
      setSubmitProgress('');
      submitLockRef.current = false;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ScreenShimmer type="serviceApproval" />
      </View>
    );
  }

  // List View
  if (step === 'list') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Service Approvals</Text>
            <Text style={styles.headerSubtitle}>RSAS</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={startNewRequest}>
            <MaterialIcon name="add" size={22} color={BRAND.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Banner */}
        {services.length > 0 && (
          <StatsBanner
            approved={stats.approved}
            pending={stats.pending}
            rejected={stats.rejected}
          />
        )}

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabsContainer}
          contentContainerStyle={styles.filterTabsContent}
        >
          {FILTER_TABS.map(tab => (
            <FilterTab
              key={tab.key}
              tab={tab}
              isActive={activeFilter === tab.key}
              onPress={() => setActiveFilter(tab.key)}
              count={getFilterCount(tab.key)}
            />
          ))}
        </ScrollView>

        {/* Service List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredServices.length === 0 ? (
            <EmptyState filter={activeFilter} onAddService={startNewRequest} />
          ) : (
            filteredServices.map(service => (
              <ServiceRequestCard
                key={service.serviceCategory}
                service={service.serviceCategory}
                status={service.status}
                documents={service.documents}
                rejectionReason={service.rejectionReason}
                submittedAt={service.submittedAt}
                reviewedAt={service.reviewedAt}
                onViewDetails={() => handleViewDetails(service)}
                onResubmit={() => handleResubmit(service)}
                onCancel={() => handleCancelRequest(service.serviceCategory)}
              />
            ))
          )}
        </ScrollView>

        {/* FAB */}
        {services.length > 0 && (
          <TouchableOpacity
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            onPress={startNewRequest}
          >
            <MaterialIcon name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Document Preview Modal */}
        {selectedServiceForModal && (
          <DocumentPreviewModal
            visible={detailModalVisible}
            service={selectedServiceForModal.serviceCategory}
            documents={selectedServiceForModal.documents}
            status={selectedServiceForModal.status}
            rejectionReason={selectedServiceForModal.rejectionReason}
            onClose={() => {
              setDetailModalVisible(false);
              setSelectedServiceForModal(null);
            }}
          />
        )}
      </View>
    );
  }

  // Select Services View
  if (step === 'select') {
    const existingServiceKeys = services.map(s => s.serviceCategory);

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep('list')}>
            <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Services</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.instructionCard}>
            <MaterialIcon name="info" size={24} color={BRAND.secondary} />
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>How it works</Text>
              <Text style={styles.instructionText}>
                Select services you want to offer, upload required documents, and our team will verify within 3-5 business days.
              </Text>
            </View>
          </View>

          {categories.map(category => {
            const existingService = services.find(s => s.serviceCategory === category.key);
            const isSelected = selectedServices.includes(category.key);
            const isDisabled =
              existingService?.status === 'approved' ||
              existingService?.status === 'pending' ||
              existingService?.status === 'under_review';

            return (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.selectServiceCard,
                  isSelected && styles.selectServiceCardSelected,
                  isDisabled && styles.selectServiceCardDisabled,
                ]}
                onPress={() => !isDisabled && toggleService(category.key)}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <View style={styles.selectServiceLeft}>
                  <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxSelected]}>
                    {isSelected && <MaterialIcon name="check" size={16} color="#FFFFFF" />}
                  </View>
                  <View>
                    <Text style={styles.selectServiceText}>
                      {SERVICE_LABELS[category.key] || category.key}
                    </Text>
                    <Text style={styles.selectServiceDocs}>
                      {(() => {
                        const r = category?.requirements;
                        const count = r?.required ? (r.required.length + (r.anyOneOf?.length > 0 ? 1 : 0)) : (category?.requiredDocuments?.length || 0);
                        return `${count} document${count !== 1 ? 's' : ''} required`;
                      })()}
                    </Text>
                  </View>
                </View>
                {existingService && (
                  <View
                    style={[
                      styles.selectServiceStatus,
                      { backgroundColor: STATUS_CONFIG[existingService.status]?.bgColor },
                    ]}
                  >
                    <MaterialIcon
                      name={STATUS_CONFIG[existingService.status]?.icon}
                      size={14}
                      color={STATUS_CONFIG[existingService.status]?.color}
                    />
                    <Text
                      style={[
                        styles.selectServiceStatusText,
                        { color: STATUS_CONFIG[existingService.status]?.color },
                      ]}
                    >
                      {STATUS_CONFIG[existingService.status]?.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { bottom: 0, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, selectedServices.length === 0 && styles.buttonDisabled]}
            onPress={() => setStep('upload')}
            disabled={selectedServices.length === 0}
          >
            <Text style={styles.primaryButtonText}>
              Continue ({selectedServices.length} selected)
            </Text>
            <MaterialIcon name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Upload Documents View
  const currentService = selectedServices[currentServiceIndex];
  const requirements = getCurrentServiceRequirements();
  const serviceDocs = documents[currentService] || {};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentServiceIndex > 0) {
              setCurrentServiceIndex(prev => prev - 1);
            } else {
              setStep('select');
            }
          }}
        >
          <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Documents</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {currentServiceIndex + 1}/{selectedServices.length}
          </Text>
        </View>
      </View>

      {/* Service Navigation Pills — tap to switch between selected services */}
      {selectedServices.length > 1 && (
        <View style={styles.servicePillsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicePillsContainer}
          >
            {selectedServices.map((svc, idx) => {
              const svcDocs = documents[svc] || {};
              const { allDocs: svcReqs } = getServiceRequirements(svc);
              const uploaded = Object.values(svcDocs).filter(d => d?.localUri || d?.fileUrl).length;
              const complete = isServiceComplete(svc);
              const isActive = idx === currentServiceIndex;

              return (
                <TouchableOpacity
                  key={svc}
                  style={[styles.servicePill, isActive && styles.servicePillActive, complete && !isActive && styles.servicePillComplete]}
                  onPress={() => setCurrentServiceIndex(idx)}
                  activeOpacity={0.7}
                >
                  {submittedServices.has(svc) ? (
                    <MaterialIcon name="lock" size={14} color="#16A34A" style={{ marginRight: 5 }} />
                  ) : complete && !isActive ? (
                    <MaterialIcon name="check-circle" size={14} color="#22C55E" style={{ marginRight: 5 }} />
                  ) : null}
                  <Text style={[styles.servicePillText, isActive && styles.servicePillTextActive]} numberOfLines={1}>
                    {SERVICE_LABELS[svc] || svc}
                  </Text>
                  {!complete && (
                    <View style={[styles.servicePillBadge, isActive && styles.servicePillBadgeActive]}>
                      <Text style={[styles.servicePillCount, isActive && styles.servicePillCountActive]}>
                        {uploaded}/{svcReqs.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Service Header */}
        <View style={styles.uploadServiceHeader}>
          <View style={styles.uploadServiceIcon}>
            <MaterialIcon name="build" size={24} color={BRAND.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadServiceTitle}>
              {SERVICE_LABELS[currentService] || currentService}
            </Text>
            <Text style={styles.uploadServiceSubtitle}>
              Upload required documents
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: requirements.length > 0
                    ? `${(Object.values(serviceDocs).filter(d => d?.localUri || d?.fileUrl).length / requirements.length) * 100}%`
                    : '0%',
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Object.values(serviceDocs).filter(d => d?.localUri || d?.fileUrl).length} of {requirements.length} documents
          </Text>
        </View>

        {/* Document Cards */}
        {(() => {
          const { required: reqDocs, anyOneOf: anyDocs, optional: optDocs } = getServiceRequirements(currentService);
          const allDocTypes = [
            ...reqDocs.map(d => ({ type: d, rule: 'required' })),
            ...anyDocs.map(d => ({ type: d, rule: 'anyOneOf' })),
            ...optDocs.map(d => ({ type: d, rule: 'optional' })),
          ];

          // Check if anyOneOf is satisfied (at least one uploaded)
          const anyOneOfSatisfied = anyDocs.length === 0 || anyDocs.some(d => {
            const doc = serviceDocs[d];
            return doc?.localUri || doc?.fileUrl;
          });

          return allDocTypes.map(({ type: docType, rule }) => {
          const doc = serviceDocs[docType];
          const hasDoc = doc?.localUri || doc?.fileUrl;
          const isImage = doc?.fileType?.includes('image') ||
            ['jpg', 'jpeg', 'png', 'webp'].some(t => doc?.fileType?.includes(t));
          const isLocked = submittedServices.has(currentService);

          const ruleLabel = isLocked ? 'Submitted'
            : rule === 'required' ? 'Required'
            : rule === 'anyOneOf' ? (anyOneOfSatisfied && !hasDoc ? 'Upload any one (satisfied)' : 'Upload at least one')
            : 'Optional';
          const ruleColor = rule === 'optional' ? '#94A3B8' : rule === 'anyOneOf' ? '#F59E0B' : undefined;

          return (
            <View key={docType} style={[styles.uploadDocCard, isLocked && { opacity: 0.7 }]}>
              <View style={styles.uploadDocHeader}>
                <View style={styles.uploadDocHeaderLeft}>
                  <MaterialIcon
                    name={isLocked ? 'lock' : hasDoc ? 'check-circle' : 'upload-file'}
                    size={24}
                    color={isLocked ? '#16A34A' : hasDoc ? '#22C55E' : '#9CA3AF'}
                  />
                  <View>
                    <Text style={styles.uploadDocTitle}>
                      {DOCUMENT_LABELS[docType] || docType}
                    </Text>
                    <Text style={[styles.uploadDocRequired, ruleColor && { color: ruleColor }]}>{ruleLabel}</Text>
                  </View>
                </View>
                {hasDoc && !isLocked && (
                  <TouchableOpacity
                    style={styles.uploadDocRemove}
                    onPress={() => removeDocument(currentService, docType)}
                  >
                    <MaterialIcon name="delete" size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>

              {hasDoc ? (
                <View style={styles.uploadDocPreview}>
                  {isImage ? (
                    <Image
                      source={{ uri: doc.localUri || doc.fileUrl }}
                      style={styles.uploadDocImage}
                    />
                  ) : (
                    <View style={styles.uploadDocPdf}>
                      <MaterialIcon name="picture-as-pdf" size={40} color="#EF4444" />
                      <Text style={styles.uploadDocPdfName} numberOfLines={1}>
                        {doc.fileName}
                      </Text>
                    </View>
                  )}
                  <View style={styles.uploadDocStatus}>
                    <MaterialIcon
                      name={doc.isStaged ? 'hourglass-empty' : 'cloud-done'}
                      size={14}
                      color={doc.isStaged ? '#F59E0B' : '#22C55E'}
                    />
                    <Text
                      style={[
                        styles.uploadDocStatusText,
                        { color: doc.isStaged ? '#F59E0B' : '#22C55E' },
                      ]}
                    >
                      {doc.isStaged ? 'Ready to upload' : 'Uploaded'}
                    </Text>
                  </View>
                </View>
              ) : !isLocked ? (
                <TouchableOpacity
                  style={styles.uploadDocButton}
                  onPress={() => pickDocument(currentService, docType)}
                >
                  <MaterialIcon name="cloud-upload" size={28} color={BRAND.secondary} />
                  <Text style={styles.uploadDocButtonText}>Tap to Upload</Text>
                  <Text style={styles.uploadDocButtonHint}>PDF, JPG, PNG (Max 5MB)</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
          });
        })()}
      </ScrollView>

      {/* Uploading/Submitting Overlay */}
      {(uploading || submitting) && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.uploadingText}>{submitProgress || 'Processing...'}</Text>
          <Text style={styles.uploadingHint}>Please don't close the app</Text>
        </View>
      )}

      <View style={[styles.footer, { bottom: 0, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        {submittedServices.has(currentService) ? (
          // This service is already submitted — show locked state
          <View style={styles.lockedServiceBanner}>
            <MaterialIcon name="lock" size={18} color="#16A34A" />
            <Text style={styles.lockedServiceText}>Submitted successfully</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!isCurrentServiceComplete() || submitting) && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={!isCurrentServiceComplete() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {currentServiceIndex < selectedServices.length - 1
                    ? 'Next Service'
                    : 'Submit for Approval'}
                </Text>
                <MaterialIcon name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },

  // Header - Refined with gradient-like effect
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 8,
    fontWeight: '700',
    color: BRAND.primary,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.8,
    overflow: 'hidden',
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246, 124, 22, 0.15)',
  },

  // Stats Banner - Ultra-compact elegant design
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 14,
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  statIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: -1,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#F0F0F0',
  },

  // Filter Tabs - Ultra-compact sleek pills
  filterTabsContainer: {
    backgroundColor: 'transparent',
    maxHeight: 38,
  },
  filterTabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 6,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    paddingTop: 10,
    paddingBottom: 120,
  },

  // Service Request Card - Refined with subtle depth
  serviceRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statusBar: {
    height: 3,
  },
  serviceRequestContent: {
    padding: 12,
  },
  serviceRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceRequestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceRequestInfo: {
    flex: 1,
  },
  serviceRequestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 10,
    color: '#9CA3AF',
  },

  // Rejection Alert - Refined
  rejectionAlert: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#EF4444',
  },
  rejectionAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  rejectionAlertTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectionAlertText: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  reviewedAtText: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Document Count - Refined
  documentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
  },
  documentCountText: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  viewDocsText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.secondary,
  },

  // Action Buttons - Refined
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  resubmitButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelRequestButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Empty State - Refined
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptyStateDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // FAB - Sleek brand button
  fab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 3,
  },
  modalStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalRejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#DC2626',
    padding: 16,
  },
  modalRejectionContent: {
    flex: 1,
  },
  modalRejectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalRejectionText: {
    fontSize: 13,
    color: '#FEE2E2',
    lineHeight: 18,
  },
  documentTabs: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    maxHeight: 42,
  },
  documentTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    alignItems: 'center',
  },
  documentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F7',
    marginRight: 4,
  },
  documentTabActive: {
    backgroundColor: BRAND.secondary,
  },
  documentTabText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    maxWidth: 80,
  },
  documentTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  documentPreviewContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  documentPreviewImage: {
    width: SCREEN_WIDTH - 24,
    height: '100%',
    borderRadius: 6,
  },
  pdfPreviewContainer: {
    alignItems: 'center',
    padding: 28,
  },
  pdfFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 14,
    textAlign: 'center',
  },
  pdfHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },
  openPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#F0F7FF',
    borderRadius: 6,
  },
  openPdfButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  documentInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  documentInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  documentInfoText: {
    fontSize: 11,
    color: '#6B7280',
  },

  // Select Services - Refined
  instructionCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0F7FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: BRAND.secondary,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  instructionText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  selectServiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  selectServiceCardSelected: {
    borderColor: BRAND.secondary,
    backgroundColor: '#F7FAFF',
  },
  selectServiceCardDisabled: {
    opacity: 0.5,
  },
  selectServiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCheckboxSelected: {
    backgroundColor: BRAND.secondary,
    borderColor: BRAND.secondary,
  },
  selectServiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  selectServiceDocs: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  selectServiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectServiceStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },

  // Upload - Refined
  stepBadge: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  uploadServiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  uploadServiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadServiceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  uploadServiceSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right',
  },
  uploadDocCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  uploadDocHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  uploadDocHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  uploadDocTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  uploadDocRequired: {
    fontSize: 9,
    color: '#EF4444',
    marginTop: 1,
  },
  uploadDocRemove: {
    padding: 3,
  },
  uploadDocPreview: {
    alignItems: 'center',
  },
  uploadDocImage: {
    width: '100%',
    height: 140,
    borderRadius: 6,
  },
  uploadDocPdf: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  uploadDocPdfName: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    maxWidth: 180,
  },
  uploadDocStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  uploadDocStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  uploadDocButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  uploadDocButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.secondary,
    marginTop: 6,
  },
  uploadDocButtonHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Uploading Overlay
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  uploadingText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '600',
  },
  uploadingHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },
  // Service navigation pills
  servicePillsBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  servicePillsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  servicePillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND.secondary,
  },
  servicePillComplete: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  servicePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 18,
  },
  servicePillTextActive: {
    color: BRAND.secondary,
  },
  servicePillBadge: {
    marginLeft: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  servicePillBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  servicePillCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    lineHeight: 14,
  },
  servicePillCountActive: {
    color: BRAND.secondary,
  },

  // Zoomable Image Viewer
  zoomableContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  zoomableImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  // Fullscreen Image Gallery - Sleek
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  imageCounter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 100,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
  },
  fullscreenInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  fullscreenDocName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  fullscreenHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },

  // Image Loading & Hints - Refined
  imageLoadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  imageLoadingText: {
    marginTop: 8,
    fontSize: 11,
    color: '#6B7280',
  },
  tapToZoomHint: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tapToZoomText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },

  // Footer - Refined
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  lockedServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  lockedServiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND.primary,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});

export default ServiceApprovalsScreen;
