/**
 * Provider Details Modal Component
 * 
 * Industry-grade provider profile modal showing:
 * - Profile picture, name, verification status
 * - Rating with breakdown
 * - Experience and services offered
 * - Recent reviews
 * - Contact options
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Linking,
  Platform
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDialog } from '../context/DialogContext';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getProviderDetails } from '../services/traditionalServiceService';
import { formatExperience } from '../utils/experience';
import ImageViewerModal from './ImageViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  star: '#F59E0B',
  success: '#10B981',
  white: '#FFFFFF',
  background: '#F9FAFB',
};

// Service labels
const SERVICE_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  carpenter: 'Carpenter',
  painter: 'Painter',
  welder: 'Welder',
  electronics_technician: 'Electronics',
  solar_repairing: 'Solar',
  salon: 'Salon',
  driver: 'Driver',
  mason_tiler: 'Mason & Tiler',
  vehicle_cleaning: 'Vehicle Cleaning',
  ac_repair: 'AC Repair',
};

const formatServiceName = (service) => {
  return SERVICE_LABELS[service] || service?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || service;
};

const RatingBar = ({ value, maxValue, label }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <View style={styles.ratingBarContainer}>
      <Text style={styles.ratingBarLabel}>{label}</Text>
      <View style={styles.ratingBarTrack}>
        <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
      </View>
      <Text style={styles.ratingBarCount}>{value}</Text>
    </View>
  );
};

const ReviewCard = ({ review }) => {
  const date = review.date ? new Date(review.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) : '';

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewUserAvatar}>
          <Text style={styles.reviewUserInitial}>
            {review.userName?.charAt(0)?.toUpperCase() || 'C'}
          </Text>
        </View>
        <View style={styles.reviewUserInfo}>
          <Text style={styles.reviewUserName}>{review.userName}</Text>
          <Text style={styles.reviewService}>{formatServiceName(review.serviceType)}</Text>
        </View>
        <View style={styles.reviewRating}>
          <MaterialIcon name="star" size={14} color={BRAND.star} />
          <Text style={styles.reviewRatingText}>{review.rating}</Text>
        </View>
      </View>
      {review.review && (
        <Text style={styles.reviewText}>{review.review}</Text>
      )}
      <Text style={styles.reviewDate}>{date}</Text>
    </View>
  );
};

const ProviderDetailsModal = ({
  visible,
  onClose,
  providerId,
  onCall,
  onBook,
  hasContacted = false,
}) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // In-app image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // Smooth animated backdrop
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;
  const isDismissing = useRef(false);

  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      setModalVisible(true);
      sheetTranslateY.setValue(800);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const animatedClose = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: 800, useNativeDriver: true, tension: 50, friction: 7, overshootClamping: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

  const fetchDetails = useCallback(async () => {
    if (!providerId) {
      console.error('[ProviderDetailsModal] No provider ID provided');
      setError('Provider ID is missing');
      setLoading(false);
      return;
    }
    
    console.log('[ProviderDetailsModal] Fetching details for providerId:', providerId);
    setLoading(true);
    setError(null);

    try {
      const result = await getProviderDetails(providerId);
      console.log('[ProviderDetailsModal] API Result:', JSON.stringify({
        success: result.success,
        hasProvider: !!result.provider,
        providerKeys: result.provider ? Object.keys(result.provider) : [],
        providerName: result.provider?.name,
        profilePicture: result.provider?.profilePicture,
        error: result.error
      }, null, 2));
      
      if (result.success && result.provider) {
        console.log('[ProviderDetailsModal] Provider loaded successfully:', {
          id: result.provider.id,
          name: result.provider.name,
          rating: result.provider.rating,
          experience: result.provider.experience,
          memberSince: result.provider.memberSince,
          hasProfilePicture: !!result.provider.profilePicture?.url,
          reviewCount: result.provider.ratings?.total,
          servicesCount: result.provider.verifiedServiceCategories?.length
        });
        setProvider(result.provider);
      } else {
        console.error('[ProviderDetailsModal] Failed to load:', result.error);
        setError(result.error || 'Couldn\'t load provider details. Please try again.');
      }
    } catch (err) {
      console.error('[ProviderDetailsModal] Exception:', err);
      setError(err.message || 'Couldn\'t load provider details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (visible && providerId) {
      fetchDetails();
    } else if (visible && !providerId) {
      setError('Provider ID is missing');
      setLoading(false);
    }
    
    // Reset state when modal closes
    if (!visible) {
      setProvider(null);
      setError(null);
      setLoading(true);
    }
  }, [visible, providerId, fetchDetails]);

  const handleCall = () => {
    // Direct phone call to provider - robustly resolve phone from all available fields
    if (onCall && provider) {
      const resolvedPhone = provider.phone || provider.verifiedPhone || provider.mobileNumber || '';
      onCall(resolvedPhone);
    }
  };

  const handleBook = () => {
    if (!onBook || !provider) return;

    if (Platform.OS === 'ios') {
      // iOS modal-in-modal deadlock prevention: this Modal must fully unmount
      // BEFORE the parent opens its confirmation dialog, otherwise iOS freezes
      // because two <Modal> components would be mounted simultaneously.
      // Use animatedClose() to run the close animation + set internal modalVisible=false,
      // then defer onBook() until after the animation completes (~350ms).
      const providerToBook = provider;
      animatedClose();
      setTimeout(() => onBook(providerToBook), 350);
    } else {
      // Android: original behavior (identical to Play build 5 — do not change).
      // Android handles concurrent Modals permissively; no freeze risk.
      onBook(provider);
      onClose();
    }
  };

  const handleOpenLink = (url) => {
    if (!url) return;
    
    // Ensure URL has protocol
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }
    
    Linking.openURL(finalUrl).catch((err) => {
      console.error('Failed to open URL:', err);
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<MaterialIcon key={i} name="star" size={16} color={BRAND.star} />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<MaterialIcon key={i} name="star-half" size={16} color={BRAND.star} />);
      } else {
        stars.push(<MaterialIcon key={i} name="star-border" size={16} color="#D1D5DB" />);
      }
    }
    return stars;
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={animatedClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.6)', opacity: overlayOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={animatedClose} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', transform: [{ translateY: sheetTranslateY }] }]}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={animatedClose}>
              <MaterialIcon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.title}>Provider Details</Text>
            <View style={styles.closeButton} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND.secondary} />
              <Text style={styles.loadingText}>Loading provider details...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcon name="error-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchDetails}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : provider ? (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Profile Section */}
              <View style={styles.profileSection}>
                {provider.profilePicture?.url ? (
                  <Image
                    source={{ uri: provider.profilePicture.url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileInitial}>
                      {provider.name?.charAt(0)?.toUpperCase() || 'P'}
                    </Text>
                  </View>
                )}
                
                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>{provider.name}</Text>
                    {provider.isVerified && (
                      <MaterialIcon name="verified" size={18} color={BRAND.success} />
                    )}
                  </View>
                  
                  <View style={styles.ratingRow}>
                    {renderStars(provider.rating || 0)}
                    <Text style={styles.ratingText}>
                      {(provider.rating || 0).toFixed(1)} ({provider.ratings?.total || 0} reviews)
                    </Text>
                  </View>

                  {(() => {
                    const expText = formatExperience(provider.experienceStartDate, provider.experience);
                    return expText ? (
                      <View style={styles.experienceRow}>
                        <MaterialIcon name="work" size={14} color="#6B7280" />
                        <Text style={styles.experienceText}>{expText} experience</Text>
                      </View>
                    ) : null;
                  })()}

                  {provider.memberSince && (
                    <View style={styles.experienceRow}>
                      <MaterialIcon name="calendar-today" size={14} color="#6B7280" />
                      <Text style={styles.experienceText}>Member since {provider.memberSince}</Text>
                    </View>
                  )}

                  <View style={styles.locationRow}>
                    <MaterialIcon name="location-on" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                      {provider.city || provider.address || 'Location not specified'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{provider.stats?.completedRequests || 0}</Text>
                  <Text style={styles.statLabel}>Jobs Done</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{provider.ratings?.total || 0}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: provider.isOnline ? BRAND.success : '#9CA3AF' }]}>
                    {provider.isOnline ? 'Online' : 'Offline'}
                  </Text>
                  <Text style={styles.statLabel}>Status</Text>
                </View>
              </View>

              {/* Services Section */}
              {provider.verifiedServiceCategories?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Services Offered</Text>
                  <View style={styles.servicesGrid}>
                    {provider.verifiedServiceCategories.map((service) => (
                      <View key={service} style={styles.serviceChip}>
                        <MaterialIcon name="check-circle" size={14} color={BRAND.success} />
                        <Text style={styles.serviceChipText}>{formatServiceName(service)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Rating Breakdown */}
              {provider.ratings?.total > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Rating Breakdown</Text>
                  <View style={styles.ratingBreakdown}>
                    <View style={styles.ratingOverview}>
                      <Text style={styles.ratingBig}>{(provider.rating || 0).toFixed(1)}</Text>
                      <View style={styles.ratingStarsSmall}>{renderStars(provider.rating || 0)}</View>
                      <Text style={styles.totalReviews}>{provider.ratings?.total} reviews</Text>
                    </View>
                    <View style={styles.ratingBars}>
                      {[5, 4, 3, 2, 1].map((star) => (
                        <RatingBar
                          key={star}
                          label={star.toString()}
                          value={provider.ratings?.breakdown?.[star] || 0}
                          maxValue={provider.ratings?.total || 1}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Recent Reviews */}
              {provider.recentReviews?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent Reviews</Text>
                  {provider.recentReviews.map((review, index) => (
                    <ReviewCard key={index} review={review} />
                  ))}
                </View>
              )}

              {/* Bio Section */}
              {provider.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <View style={styles.bioContainer}>
                    <Text style={styles.bioText}>{provider.bio}</Text>
                  </View>
                </View>
              )}

              {/* Specializations Section */}
              {provider.specializations?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Specializations</Text>
                  <View style={styles.specializationsGrid}>
                    {provider.specializations.map((spec, index) => (
                      <View key={index} style={styles.specializationChip}>
                        <MaterialIcon name="auto-awesome" size={14} color="#7C3AED" />
                        <Text style={styles.specializationChipText}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Portfolio Links Section */}
              {provider.portfolioLinks && Object.keys(provider.portfolioLinks).filter(k => provider.portfolioLinks[k]).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Portfolio & Social Media</Text>
                  <View style={styles.portfolioLinksGrid}>
                    {provider.portfolioLinks.website && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.website)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#E0F2FE' }]}>
                          <MaterialIcon name="language" size={22} color="#0284C7" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>Website</Text>
                      </TouchableOpacity>
                    )}
                    {provider.portfolioLinks.instagram && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.instagram)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#FCE7F3' }]}>
                          <MaterialIcon name="camera-alt" size={22} color="#DB2777" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>Instagram</Text>
                      </TouchableOpacity>
                    )}
                    {provider.portfolioLinks.youtube && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.youtube)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#FEE2E2' }]}>
                          <MaterialIcon name="play-circle-filled" size={22} color="#DC2626" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>YouTube</Text>
                      </TouchableOpacity>
                    )}
                    {provider.portfolioLinks.facebook && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.facebook)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#DBEAFE' }]}>
                          <MaterialIcon name="facebook" size={22} color="#2563EB" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>Facebook</Text>
                      </TouchableOpacity>
                    )}
                    {provider.portfolioLinks.tiktok && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.tiktok)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#F3E8FF' }]}>
                          <MaterialIcon name="music-note" size={22} color="#7C3AED" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>TikTok</Text>
                      </TouchableOpacity>
                    )}
                    {provider.portfolioLinks.twitter && (
                      <TouchableOpacity 
                        style={styles.portfolioLinkCard}
                        onPress={() => handleOpenLink(provider.portfolioLinks.twitter)}
                      >
                        <View style={[styles.portfolioLinkIcon, { backgroundColor: '#E0F7FA' }]}>
                          <MaterialIcon name="alternate-email" size={22} color="#0EA5E9" />
                        </View>
                        <Text style={styles.portfolioLinkLabel}>Twitter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Portfolio Gallery Section */}
              {provider.portfolioGallery?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Portfolio Gallery</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.galleryScrollView}
                    contentContainerStyle={styles.galleryContent}
                  >
                    {provider.portfolioGallery.map((image, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.galleryImageContainer}
                        onPress={() => {
                          setImageViewerIndex(index);
                          setImageViewerVisible(true);
                        }}
                      >
                        <Image 
                          source={{ uri: image.url || image }} 
                          style={styles.galleryImage}
                          resizeMode="cover"
                        />
                        {image.caption && (
                          <Text style={styles.galleryCaption} numberOfLines={1}>
                            {image.caption}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  {/* In-App Image Viewer */}
                  <ImageViewerModal
                    visible={imageViewerVisible}
                    images={provider.portfolioGallery}
                    initialIndex={imageViewerIndex}
                    onClose={() => setImageViewerVisible(false)}
                  />
                </View>
              )}
            </ScrollView>
          ) : null}

          {/* Action Buttons */}
          {provider && !loading && !error && (
            <View style={[styles.actionButtons, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <MaterialIcon name="phone" size={22} color={BRAND.success} />
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={handleBook}
              >
                <MaterialIcon name="send" size={20} color={BRAND.white} />
                <Text style={styles.bookButtonText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 48,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: BRAND.secondary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: BRAND.white,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: BRAND.secondary,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: BRAND.white,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  experienceText: {
    fontSize: 13,
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: BRAND.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  serviceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  ratingBreakdown: {
    flexDirection: 'row',
    backgroundColor: BRAND.background,
    borderRadius: 12,
    padding: 16,
  },
  ratingOverview: {
    alignItems: 'center',
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  ratingBig: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingStarsSmall: {
    flexDirection: 'row',
    marginTop: 4,
  },
  totalReviews: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  ratingBars: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBarLabel: {
    width: 16,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: BRAND.star,
    borderRadius: 3,
  },
  ratingBarCount: {
    width: 24,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  reviewCard: {
    backgroundColor: BRAND.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewUserInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.white,
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewService: {
    fontSize: 12,
    color: '#6B7280',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  reviewRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.star,
  },
  reviewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 6,
  },
  reviewDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  // Bio styles
  bioContainer: {
    backgroundColor: BRAND.background,
    borderRadius: 12,
    padding: 16,
  },
  bioText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  // Specializations styles
  specializationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specializationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  specializationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C3AED',
  },
  // Portfolio links styles
  portfolioLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  portfolioLinkCard: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - 80) / 4,
  },
  portfolioLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  portfolioLinkLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  // Portfolio gallery styles
  galleryScrollView: {
    marginHorizontal: -16,
  },
  galleryContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  galleryImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: BRAND.background,
    marginRight: 12,
  },
  galleryImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  galleryCaption: {
    fontSize: 12,
    color: '#6B7280',
    padding: 8,
    maxWidth: 160,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.success,
  },
  bookButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.white,
  },
});

export default ProviderDetailsModal;
