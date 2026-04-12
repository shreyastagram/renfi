/**
 * Document Verification Screen
 * 
 * Allows providers to:
 * - Select services they want to offer
 * - Upload required documents for each service
 * - View verification status
 * - Resubmit if rejected
 * 
 * Supported formats: PDF, JPG, JPEG, PNG, WEBP, IMG
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar
} from 'react-native';
import TouchableOpacity from '../components/TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { requestCameraPermission, requestGalleryPermission } from '../utils/permissions';
import { pick, types, keepLocalCopy } from '@react-native-documents/picker';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { Icon } from '../components';
import GraphBackground from '../components/GraphBackground';
import { NODE_BASE_URL as API_BASE_URL } from '../config/api';
import { getTokens } from '../utils/storage';

import { uploadDocument } from '../services/cloudinaryService';

/**
 * Document type labels for display
 */
const DOCUMENT_LABELS = {
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
  // Legacy
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
 * Status colors and icons
 */
const STATUS_CONFIG = {
  not_submitted: { color: '#6B7280', icon: 'help-outline', label: 'Not Submitted' },
  pending: { color: '#F59E0B', icon: 'schedule', label: 'Pending Review' },
  under_review: { color: '#3B82F6', icon: 'visibility', label: 'Under Review' },
  approved: { color: '#22C55E', icon: 'check-circle', label: 'Approved' },
  rejected: { color: '#EF4444', icon: 'cancel', label: 'Rejected' },
};

/**
 * Service Selection Card
 */
const ServiceCard = ({ service, selected, onToggle, verificationStatus }) => {
  const statusConfig = STATUS_CONFIG[verificationStatus] || STATUS_CONFIG.not_submitted;
  
  return (
    <TouchableOpacity
      style={[styles.serviceCard, selected && styles.serviceCardSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.serviceCardLeft}>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <MaterialIcon name="check" size={16} color="#FFFFFF" />}
        </View>
        <Text style={styles.serviceCardText}>{SERVICE_LABELS[service] || service}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}15` }]}>
        <MaterialIcon name={statusConfig.icon} size={14} color={statusConfig.color} />
        <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Document Upload Card
 */
const DocumentUploadCard = ({ documentType, document, onUpload, onRemove, required = true }) => {
  // Check if document has either local URI (staged) or fileUrl (uploaded)
  const hasDocument = !!(document?.localUri || document?.fileUrl);
  const isStaged = document?.isStaged && !document?.fileUrl;
  const status = document?.status || 'not_uploaded';
  // Use local URI for staged docs, otherwise use fileUrl
  const imageUri = document?.localUri || document?.fileUrl;
  const isImage = document?.fileType?.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'image/jpeg', 'image/png', 'image/webp'].some(t => document?.fileType?.includes(t));
  
  return (
    <View style={styles.documentCard}>
      <View style={styles.documentCardHeader}>
        <View style={styles.documentCardLeft}>
          <MaterialIcon 
            name={hasDocument ? 'description' : 'upload-file'} 
            size={24} 
            color={hasDocument ? '#22C55E' : '#6B7280'} 
          />
          <View>
            <Text style={styles.documentTypeLabel}>
              {DOCUMENT_LABELS[documentType] || documentType}
            </Text>
            {required && <Text style={styles.requiredTag}>Required</Text>}
          </View>
        </View>
        {hasDocument && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <MaterialIcon name="close" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      
      {hasDocument ? (
        <View style={styles.documentPreview}>
          {isImage ? (
            <Image source={{ uri: imageUri }} style={styles.documentImage} />
          ) : (
            <View style={styles.pdfPreview}>
              <MaterialIcon name="picture-as-pdf" size={32} color="#EF4444" />
              <Text style={styles.pdfFileName} numberOfLines={1}>{document.fileName}</Text>
            </View>
          )}
          <Text style={[styles.uploadedText, isStaged && { color: '#F59E0B' }]}>
            {isStaged ? '📎 Selected (will upload on submit)' : '✓ Uploaded'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadButton} onPress={onUpload}>
          <MaterialIcon name="cloud-upload" size={24} color="#3B82F6" />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
          <Text style={styles.uploadHint}>PDF, JPG, PNG • Max 5MB</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Document Verification Screen
 */
const DocumentVerificationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();
  
  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  const [documents, setDocuments] = useState({}); // { [serviceCategory]: { [docType]: docData } }
  const [verificationStatus, setVerificationStatus] = useState({});
  const [step, setStep] = useState('select'); // 'select' | 'upload' | 'status'
  const [uploading, setUploading] = useState(false);
  
  /**
   * Fetch with timeout and retry logic
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
        console.log(`[DocumentVerification] Fetch attempt ${attempt + 1}/${retries + 1} failed:`, error.message);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  };

  /**
   * Fetch service categories and provider's verification status
   */
  useEffect(() => {
    fetchData();
  }, [providerId]);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[DocumentVerification] Fetching from:', `${API_BASE_URL}/api/verification/categories`);
      
      // Fetch all categories with retry
      const categoriesResponse = await fetchWithRetry(`${API_BASE_URL}/api/verification/categories`);
      const categoriesData = await categoriesResponse.json();
      
      if (categoriesData.success) {
        setCategories(categoriesData.categories);
      } else {
        throw new Error(categoriesData.error || 'Failed to fetch service categories');
      }
      
      // Fetch provider's current verification status
      if (providerId) {
        try {
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
          
          if (statusData.success) {
            // Build verification status map
            const statusMap = {};
            statusData.verification.services?.forEach(s => {
              statusMap[s.serviceCategory] = s.status;
              // Restore documents
              if (s.documents) {
                setDocuments(prev => ({
                  ...prev,
                  [s.serviceCategory]: s.documents.reduce((acc, doc) => {
                    acc[doc.documentType] = doc;
                    return acc;
                  }, {})
                }));
              }
            });
            setVerificationStatus(statusMap);
            
            // If provider has pending/approved services, show status
            if (statusData.verification.overallStatus !== 'not_started') {
              setStep('status');
            }
          }
        } catch (statusError) {
          console.warn('[DocumentVerification] Failed to fetch status:', statusError.message);
          // Continue with empty status - user can still browse services
        }
      }
    } catch (error) {
      console.error('[DocumentVerification] Error fetching data:', error);
      dialog(
        t('documentVerification.connectionIssue'),
        t('documentVerification.connectionIssueMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.retry'), onPress: () => fetchData() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Toggle service selection
   */
  const toggleService = (serviceKey) => {
    const status = verificationStatus[serviceKey];
    
    // Don't allow selecting services that are pending or under review
    if (status === 'pending' || status === 'under_review') {
      dialog(
        'Under Review',
        'This service is currently under review. Please wait for the verification to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setSelectedServices(prev => {
      if (prev.includes(serviceKey)) {
        return prev.filter(s => s !== serviceKey);
      }
      return [...prev, serviceKey];
    });
  };
  
  /**
   * Pick document (image or PDF)
   */
  const pickDocument = async (serviceCategory, documentType) => {
    dialog(
      'Upload Document',
      'Choose how you want to upload',
      [
        {
          text: 'Camera',
          onPress: () => captureFromCamera(serviceCategory, documentType),
        },
        {
          text: 'Gallery',
          onPress: () => pickFromGallery(serviceCategory, documentType),
        },
        {
          text: 'PDF File',
          onPress: () => pickPDF(serviceCategory, documentType),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  /**
   * Capture from camera
   */
  const captureFromCamera = async (serviceCategory, documentType) => {
    const granted = await requestCameraPermission(dialog);
    if (!granted) return;

    try {
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
      console.error('Camera error:', error);
      dialog('Error', 'Failed to capture image');
    }
  };

  /**
   * Pick from gallery
   */
  const pickFromGallery = async (serviceCategory, documentType) => {
    const granted = await requestGalleryPermission(dialog);
    if (!granted) return;

    try {
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
      console.error('Gallery error:', error);
      dialog('Error', 'Failed to pick image');
    }
  };
  
  /**
   * Pick PDF file
   */
  const pickPDF = async (serviceCategory, documentType) => {
    // iOS modal-in-modal prevention: called from a dialog onPress handler.
    // iOS UIDocumentPickerViewController fails to present while the previous
    // dialog modal is still dismissing. Wait for the dialog to fade out first.
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    try {
      const result = await pick({
        type: [types.pdf],
      });

      if (result?.[0]) {
        let fileUri = result[0].uri;
        const fileName = result[0].name || 'document.pdf';

        // iOS: Copy the picked file into the app's cache directory to escape
        // the iOS security-scoped URL which expires outside the picker callback.
        // Without this, submit fails with "Network request failed" on iOS.
        if (Platform.OS === 'ios') {
          try {
            const copies = await keepLocalCopy({
              files: [{ uri: result[0].uri, fileName }],
              destination: 'cachesDirectory',
            });
            if (copies?.[0]?.status === 'success' && copies[0].localUri) {
              fileUri = copies[0].localUri;
            } else {
              console.warn('[DocumentVerification] iOS keepLocalCopy failed, using original URI:', copies?.[0]);
            }
          } catch (copyErr) {
            console.warn('[DocumentVerification] iOS keepLocalCopy threw, using original URI:', copyErr);
          }
        }

        stageDocument(serviceCategory, documentType, {
          uri: fileUri,
          fileName,
          type: result[0].type || 'application/pdf',
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
        console.error('[DocumentVerification] pickPDF error:', error?.code, error?.message, error);
        dialog('Error', 'Failed to pick document');
      }
    }
  };
  
  /**
   * Stage document locally (don't upload until submit)
   */
  const stageDocument = (serviceCategory, documentType, file) => {
    setDocuments(prev => ({
      ...prev,
      [serviceCategory]: {
        ...prev[serviceCategory],
        [documentType]: {
          documentType,
          localUri: file.uri,
          fileName: file.fileName || file.name || 'document',
          fileType: file.type || 'image/jpeg',
          fileSize: file.fileSize || file.size,
          isStaged: true, // Mark as not yet uploaded
        },
      },
    }));
  };
  
  /**
   * Upload to Cloudinary (called only on submit)
   */
  const uploadToCloudinary = async (serviceCategory, documentType, doc) => {
    const data = await uploadDocument({
      uri: doc.localUri,
      type: doc.fileType || 'image/jpeg',
      fileName: doc.fileName || 'document.jpg',
      context: 'documents',
      serviceCategory,
    });

    return {
      documentType,
      fileUrl: data.secure_url,
      publicId: data.public_id,
      fileName: doc.fileName || data.original_filename,
      fileType: data.format || doc.fileType?.split('/')[1],
      fileSize: doc.fileSize || data.bytes,
    };
  };
  
  /**
   * Remove document
   */
  const removeDocument = (serviceCategory, documentType) => {
    setDocuments(prev => {
      const updated = { ...prev };
      if (updated[serviceCategory]) {
        delete updated[serviceCategory][documentType];
      }
      return updated;
    });
  };
  
  /**
   * Get required documents for current service
   */
  const getCurrentServiceRequirements = () => {
    if (currentServiceIndex >= selectedServices.length) return [];
    
    const currentService = selectedServices[currentServiceIndex];
    const category = categories.find(c => c.key === currentService);
    return category?.requiredDocuments || [];
  };
  
  /**
   * Check if current service has all required documents
   */
  const isCurrentServiceComplete = () => {
    const currentService = selectedServices[currentServiceIndex];
    const requirements = getCurrentServiceRequirements();
    const serviceDocs = documents[currentService] || {};
    
    // Check if each required doc has either a staged local file or already uploaded
    return requirements.every(docType => serviceDocs[docType]?.localUri || serviceDocs[docType]?.fileUrl);
  };
  
  /**
   * Move to next service or submit
   */
  const handleNext = () => {
    if (!isCurrentServiceComplete()) {
      dialog('Missing Documents', 'Please upload all required documents before proceeding.');
      return;
    }
    
    if (currentServiceIndex < selectedServices.length - 1) {
      setCurrentServiceIndex(prev => prev + 1);
    } else {
      // All services complete, submit
      handleSubmit();
    }
  };
  
  /**
   * Submit all documents for verification
   */
  const handleSubmit = async () => {
    setSubmitting(true);
    setUploading(true);
    
    try {
      const tokens = await getTokens();
      
      // First, upload all staged documents to Cloudinary
      for (const serviceCategory of selectedServices) {
        const serviceDocs = documents[serviceCategory] || {};
        
        for (const [docType, doc] of Object.entries(serviceDocs)) {
          // Only upload if it's staged locally and not yet uploaded
          if (doc.isStaged && doc.localUri && !doc.fileUrl) {
            console.log(`[DocumentVerification] Uploading ${docType} for ${serviceCategory}...`);
            const uploadedDoc = await uploadToCloudinary(serviceCategory, docType, doc);
            
            // Update document with uploaded URL
            setDocuments(prev => ({
              ...prev,
              [serviceCategory]: {
                ...prev[serviceCategory],
                [docType]: {
                  ...uploadedDoc,
                  isStaged: false, // Mark as uploaded
                },
              },
            }));
            
            // Update local reference for submission
            serviceDocs[docType] = uploadedDoc;
          }
        }
      }
      
      setUploading(false);
      
      // Now submit documents to backend for each selected service
      for (const serviceCategory of selectedServices) {
        const serviceDocs = documents[serviceCategory] || {};
        const docsArray = Object.values(serviceDocs).map(doc => ({
          documentType: doc.documentType,
          fileUrl: doc.fileUrl,
          publicId: doc.publicId,
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
        }));
        
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
              documents: docsArray,
            }),
          },
          2, // retries
          15000 // 15 second timeout
        );
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Submission failed');
        }
      }
      
      dialog(
        'Documents Submitted',
        'Your documents have been submitted for verification.\n\n' +
        'Verification usually takes 3-5 business days.\n\n' +
        'Contact support for any queries.',
        [
          {
            text: 'OK',
            onPress: () => {
              refreshProfile?.();
              setStep('status');
              fetchData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('[DocumentVerification] Submit error:', error.message);
      setUploading(false);
      dialog(
        'Submission Failed', 
        'Couldn\'t submit your documents. Please try again.',
        [
          { text: 'Retry', onPress: () => handleSubmit() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };
  
  /**
   * Proceed to upload step
   */
  const proceedToUpload = () => {
    if (selectedServices.length === 0) {
      dialog('No Services Selected', 'Please select at least one service to proceed.');
      return;
    }
    setCurrentServiceIndex(0);
    setStep('upload');
  };
  
  /**
   * Start new verification
   */
  const startNewVerification = () => {
    setSelectedServices([]);
    setCurrentServiceIndex(0);
    setStep('select');
  };
  
  /**
   * Cancel verification for a service
   */
  const cancelVerification = async (serviceCategory) => {
    dialog(
      'Cancel Verification',
      `Are you sure you want to cancel verification for ${SERVICE_LABELS[serviceCategory]}? You will need to resubmit documents if you want to verify this service later.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Verification',
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
                dialog('Success', 'Verification cancelled successfully.');
                refreshProfile?.();
                fetchData();
              } else {
                throw new Error(result.error || 'Failed to cancel verification');
              }
            } catch (error) {
              console.error('[DocumentVerification] Cancel error:', error.message);
              dialog('Error', error.message || 'Failed to cancel verification. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading service data...</Text>
      </View>
    );
  }
  
  // Render verification status view
  if (step === 'status') {
    const hasPending = Object.values(verificationStatus).some(s => s === 'pending' || s === 'under_review');
    const hasRejected = Object.values(verificationStatus).some(s => s === 'rejected');
    
    return (
      <View style={styles.container}>
        <GraphBackground />
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Approvals</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Status Overview */}
          <View style={styles.statusOverview}>
            {hasPending && (
              <View style={[styles.statusCard, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcon name="schedule" size={32} color="#F59E0B" />
                <Text style={styles.statusCardTitle}>Under Review</Text>
                <Text style={styles.statusCardText}>
                  Verification usually takes 3-5 business days.{'\n'}Contact support for queries.
                </Text>
              </View>
            )}
          </View>
          
          {/* Services Status List */}
          <Text style={styles.sectionTitle}>Your Services</Text>
          
          {categories
            .filter(c => verificationStatus[c.key])
            .map(category => {
              const status = verificationStatus[category.key];
              const config = STATUS_CONFIG[status];
              const canCancel = status !== 'approved';
              
              return (
                <View key={category.key} style={styles.statusItem}>
                  <View style={styles.statusItemLeft}>
                    <MaterialIcon name={config.icon} size={24} color={config.color} />
                    <View>
                      <Text style={styles.statusItemTitle}>
                        {SERVICE_LABELS[category.key]}
                      </Text>
                      <Text style={[styles.statusItemStatus, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusItemRight}>
                    {status === 'approved' ? (
                      <View style={styles.verifiedBadge}>
                        <MaterialIcon name="verified" size={20} color="#22C55E" />
                      </View>
                    ) : canCancel && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => cancelVerification(category.key)}
                      >
                        <MaterialIcon name="close" size={18} color="#EF4444" />
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          
          {/* Add More Services Button */}
          {!hasPending && (
            <TouchableOpacity style={styles.addMoreButton} onPress={startNewVerification}>
              <MaterialIcon name="add" size={24} color="#3B82F6" />
              <Text style={styles.addMoreText}>Add More Services</Text>
            </TouchableOpacity>
          )}
          
          {/* Resubmit Button for Rejected */}
          {hasRejected && (
            <TouchableOpacity 
              style={[styles.addMoreButton, { backgroundColor: '#FEE2E2' }]} 
              onPress={startNewVerification}
            >
              <MaterialIcon name="refresh" size={24} color="#EF4444" />
              <Text style={[styles.addMoreText, { color: '#EF4444' }]}>
                Resubmit Rejected Documents
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }
  
  // Render service selection
  if (step === 'select') {
    return (
      <View style={styles.container}>
        <GraphBackground />
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Service Approval</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.instruction}>
            Select the services you want to offer. You'll need to upload documents for each service.
          </Text>
          
          {categories.map(category => (
            <ServiceCard
              key={category.key}
              service={category.key}
              selected={selectedServices.includes(category.key)}
              onToggle={() => toggleService(category.key)}
              verificationStatus={verificationStatus[category.key]}
            />
          ))}
        </ScrollView>
        
        <View style={[styles.footer, { bottom: 0, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, selectedServices.length === 0 && styles.buttonDisabled]}
            onPress={proceedToUpload}
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
  
  // Render document upload
  const currentService = selectedServices[currentServiceIndex];
  const requirements = getCurrentServiceRequirements();
  const serviceDocs = documents[currentService] || {};
  
  return (
    <View style={styles.container}>
      <GraphBackground />
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
        <Text style={styles.stepIndicator}>
          {currentServiceIndex + 1}/{selectedServices.length}
        </Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceTitle}>{SERVICE_LABELS[currentService]}</Text>
          <Text style={styles.serviceSubtitle}>
            Upload the following documents for verification
          </Text>
        </View>
        
        {requirements.map(docType => (
          <DocumentUploadCard
            key={docType}
            documentType={docType}
            document={serviceDocs[docType]}
            onUpload={() => pickDocument(currentService, docType)}
            onRemove={() => removeDocument(currentService, docType)}
          />
        ))}
        
        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={[styles.footer, { bottom: 0, paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
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
                {currentServiceIndex < selectedServices.length - 1 ? 'Next Service' : 'Submit for Verification'}
              </Text>
              <MaterialIcon name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  instruction: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  
  // Service Card
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  serviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  serviceCardText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Document Card
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  documentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  documentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  documentTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  requiredTag: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  documentPreview: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  documentImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  pdfPreview: {
    alignItems: 'center',
    padding: 20,
  },
  pdfFileName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  uploadedText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 8,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  
  // Service Header
  serviceHeader: {
    marginBottom: 20,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  serviceSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Status View
  statusOverview: {
    marginBottom: 20,
  },
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
  },
  statusCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
  },
  statusCardText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusItemStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    padding: 8,
    borderRadius: 20,
  },
  statusItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  
  // Uploading overlay
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    fontSize: 16,
    color: '#3B82F6',
    marginTop: 12,
  },
});

export default DocumentVerificationScreen;
