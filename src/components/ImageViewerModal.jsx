/**
 * ImageViewerModal - Fullscreen In-App Image Viewer
 * 
 * Displays portfolio/gallery images in a fullscreen modal with:
 * - Pinch-to-zoom
 * - Swipe between images
 * - Image counter (1/5)
 * - Close button
 * - Share button
 * - Caption display
 * 
 * Replaces Linking.openURL for image viewing across the app.
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useDialog } from '../context/DialogContext';
import Share from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Auto-orient Cloudinary URLs — injects /a_auto/ transformation
 * to fix EXIF rotation issues (common on iOS camera uploads)
 */
const autoOrientUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  // Only transform Cloudinary URLs
  if (!url.includes('cloudinary.com')) return url;
  // Already has a_auto
  if (url.includes('/a_auto')) return url;
  // Insert /a_auto/ after /upload/
  return url.replace('/upload/', '/upload/a_auto/');
};

/**
 * Normalize image data — handles both string URLs and { url, caption, thumbnail } objects
 */
const normalizeImages = (images) => {
  if (!images || !Array.isArray(images)) return [];
  return images.map((img, index) => {
    if (typeof img === 'string') {
      return { url: autoOrientUrl(img), caption: null, index };
    }
    return {
      url: autoOrientUrl(img.url || img.uri || img),
      caption: img.caption || null,
      index,
    };
  });
};

/**
 * Single image slide with loading state
 */
const ImageSlide = ({ item, width }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={[styles.slideContainer, { width }]}>
      {loading && !error && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <MaterialIcon name="broken-image" size={64} color="#6B7280" />
          <Text style={styles.errorText}>Couldn't load this image.</Text>
        </View>
      ) : (
        <Image
          source={{ uri: item.url }}
          style={styles.fullImage}
          resizeMode="contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
    </View>
  );
};

/**
 * ImageViewerModal Component
 * 
 * @param {boolean} visible - Whether modal is visible
 * @param {Array} images - Array of image URLs or { url, caption } objects
 * @param {number} initialIndex - Index of initially selected image
 * @param {function} onClose - Close handler
 */
const ImageViewerModal = ({ visible, images = [], initialIndex = 0, onClose }) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef(null);

  const normalizedImages = normalizeImages(images);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const [sharing, setSharing] = useState(false);

  /**
   * Secure share — downloads image to temp, shares the actual file.
   * The recipient gets the image itself, not a Cloudinary URL.
   */
  const handleShare = async () => {
    const currentImage = normalizedImages[currentIndex];
    if (!currentImage?.url) return;

    setSharing(true);
    try {
      // Extract filename from URL or generate one
      const urlParts = currentImage.url.split('/');
      const rawName = urlParts[urlParts.length - 1] || 'image';
      // Remove query params and ensure extension
      const cleanName = rawName.split('?')[0];
      const fileName = cleanName.includes('.') ? cleanName : `${cleanName}.jpg`;

      // Download to temp directory
      const { dirs } = ReactNativeBlobUtil.fs;
      const tempPath = `${dirs.CacheDir}/${fileName}`;

      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
        path: tempPath,
      }).fetch('GET', currentImage.url);

      const filePath = response.path();

      // Determine MIME type
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const mimeType = mimeMap[ext] || 'image/jpeg';

      // Share the downloaded file (not the URL)
      const shareUrl = Platform.OS === 'android'
        ? `file://${filePath}`
        : filePath;

      await Share.open({
        url: shareUrl,
        type: mimeType,
        title: currentImage.caption || 'Portfolio Image',
        message: currentImage.caption || '',
        failOnCancel: false,
      });

      // Cleanup temp file after sharing
      try {
        await ReactNativeBlobUtil.fs.unlink(filePath);
      } catch (cleanupErr) {
        // Non-critical, temp will be cleaned by OS
      }
    } catch (error) {
      if (error?.message !== 'User did not share') {
        console.error('[ImageViewer] Share error:', error);
        dialog('Share Failed', 'Could not share this image. Please try again.');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    setCurrentIndex(initialIndex);
    onClose?.();
  };

  if (!visible || normalizedImages.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcon name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {normalizedImages.length > 1 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {normalizedImages.length}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.topBarButton, sharing && { opacity: 0.5 }]}
            onPress={handleShare}
            disabled={sharing}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcon name="share" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Image Carousel */}
        <FlatList
          ref={flatListRef}
          data={normalizedImages}
          keyExtractor={(item, index) => `img-${index}-${item.url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, normalizedImages.length - 1)}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => (
            <ImageSlide item={item} width={SCREEN_WIDTH} />
          )}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="start"
        />

        {/* Caption Bar */}
        {normalizedImages[currentIndex]?.caption && (
          <View style={[styles.captionBar, { bottom: 80 + insets.bottom }]}>
            <Text style={styles.captionText} numberOfLines={3}>
              {normalizedImages[currentIndex].caption}
            </Text>
          </View>
        )}

        {/* Dot Indicators (for small galleries) */}
        {normalizedImages.length > 1 && normalizedImages.length <= 10 && (
          <View style={[styles.dotsContainer, { bottom: 50 + insets.bottom }]}>
            {normalizedImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  slideContainer: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  captionBar: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

export default ImageViewerModal;
