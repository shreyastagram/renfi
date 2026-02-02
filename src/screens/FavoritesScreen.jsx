/**
 * Favorites Screen
 * 
 * Displays user's favorite providers organized by service category
 * Allows removing from favorites and quick access to book
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { getFavorites, removeFromFavorites } from '../services/favoritesService';

// Brand colors
const BRAND = {
  primary: '#f67c16',
  secondary: '#2b76bc',
  background: '#faf7f7',
  white: '#FFFFFF',
  success: '#10B981',
  danger: '#DC2626',
  neutral: '#6B7280',
};

// Service category labels
const SERVICE_CATEGORY_LABELS = {
  electrician: 'Electrician',
  plumber: 'Plumber',
  electronics_technician: 'Electronics Technician',
  carpenter: 'Carpenter',
  painter: 'Painter',
  solar_repairing: 'Solar Repairing',
  welder: 'Welder',
  salon: 'Salon',
  vehicle_cleaning: 'Vehicle Cleaning',
  mason_tiler: 'Mason & Tiler',
  driver: 'Driver',
  ac_repair: 'AC Repair',
  cleaning: 'Cleaning',
  photographer: 'Photographer',
  influencer: 'Influencer',
  snake_catcher: 'Snake Catcher',
  private_ambulance: 'Private Ambulance',
  mortuary_van: 'Mortuary Van',
};

// Service category icons - MaterialIcon names for production-grade UI
const SERVICE_ICONS = {
  electrician: 'flash-on',
  plumber: 'plumbing',
  electronics_technician: 'tv',
  carpenter: 'handyman',
  painter: 'format-paint',
  solar_repairing: 'wb-sunny',
  welder: 'build',
  salon: 'content-cut',
  vehicle_cleaning: 'local-car-wash',
  mason_tiler: 'view-module',
  driver: 'drive-eta',
  ac_repair: 'ac-unit',
  cleaning: 'cleaning-services',
  photographer: 'camera-alt',
  influencer: 'star',
  snake_catcher: 'pest-control',
  private_ambulance: 'local-hospital',
  mortuary_van: 'airport-shuttle',
};

/**
 * Provider Card Component
 */
const ProviderCard = ({ provider, onCall, onRemove, onBook }) => (
  <View style={styles.providerCard}>
    <View style={styles.providerHeader}>
      <View style={styles.providerAvatar}>
        <Text style={styles.providerInitial}>
          {provider.name?.charAt(0)?.toUpperCase() || 'P'}
        </Text>
      </View>
      
      <View style={styles.providerInfo}>
        <View style={styles.providerNameRow}>
          <Text style={styles.providerName}>{provider.name}</Text>
          {provider.verified && (
            <MaterialIcon name="verified" size={16} color="#2563EB" />
          )}
        </View>
        
        {(provider.rating > 0 || provider.ratings?.average > 0) && (
          <View style={styles.ratingRow}>
            <MaterialIcon name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {(provider.ratings?.average || provider.rating || 0).toFixed(1)}
            </Text>
          </View>
        )}
        
        {provider.lastServiceDate && (
          <Text style={styles.lastServiceText}>
            Last service: {new Date(provider.lastServiceDate).toLocaleDateString()}
          </Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => onRemove(provider)}
      >
        <MaterialIcon name="favorite" size={24} color={BRAND.danger} />
      </TouchableOpacity>
    </View>
    
    {provider.notes && (
      <View style={styles.notesContainer}>
        <MaterialIcon name="notes" size={14} color="#9CA3AF" />
        <Text style={styles.notesText}>{provider.notes}</Text>
      </View>
    )}
    
    <View style={styles.providerActions}>
      <TouchableOpacity 
        style={styles.callButton}
        onPress={() => onCall(provider.phone)}
      >
        <MaterialIcon name="phone" size={18} color={BRAND.white} />
        <Text style={styles.callButtonText}>Call</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.bookButton}
        onPress={() => onBook(provider)}
      >
        <MaterialIcon name="calendar-today" size={18} color={BRAND.white} />
        <Text style={styles.bookButtonText}>Book Now</Text>
      </TouchableOpacity>
    </View>
  </View>
);

/**
 * Section Header Component - Using MaterialIcon instead of emoji
 */
const SectionHeader = ({ category, count }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconContainer}>
      <MaterialIcon 
        name={SERVICE_ICONS[category] || 'star'} 
        size={22} 
        color={BRAND.secondary} 
      />
    </View>
    <Text style={styles.sectionTitle}>
      {SERVICE_CATEGORY_LABELS[category] || category}
    </Text>
    <View style={styles.countBadge}>
      <Text style={styles.countText}>{count}</Text>
    </View>
  </View>
);

const FavoritesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile } = useApp();
  
  // User ID
  const userId = user?.mongoId || profile?.mongoId || user?._id || profile?._id;
  
  // State
  const [favorites, setFavorites] = useState([]);
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  /**
   * Fetch favorites
   */
  const fetchFavorites = useCallback(async (refresh = false) => {
    if (!userId) return;
    
    if (refresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    const result = await getFavorites(userId);
    
    if (result.success) {
      const favs = result.data?.favorites || result.data || [];
      setFavorites(favs);
      
      // Organize by category for section list
      const byCategory = {};
      favs.forEach(fav => {
        const category = fav.serviceCategory || 'other';
        if (!byCategory[category]) {
          byCategory[category] = [];
        }
        byCategory[category].push({
          ...fav.provider,
          serviceCategory: category,
          notes: fav.notes,
          lastServiceDate: fav.lastServiceDate,
          addedAt: fav.addedAt,
        });
      });
      
      const sectionData = Object.entries(byCategory).map(([category, data]) => ({
        category,
        data,
      }));
      
      setSections(sectionData);
    }
    
    setIsLoading(false);
    setRefreshing(false);
  }, [userId]);
  
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);
  
  /**
   * Handle call provider
   */
  const handleCallProvider = (phone) => {
    if (!phone) {
      Alert.alert('Error', 'Provider phone number not available');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };
  
  /**
   * Handle remove from favorites
   */
  const handleRemoveFavorite = (provider) => {
    Alert.alert(
      'Remove Favorite',
      `Remove ${provider.name} from your favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFromFavorites(
              userId,
              provider._id,
              provider.serviceCategory
            );
            
            if (result.success) {
              // Remove from local state
              setSections(prev => 
                prev.map(section => ({
                  ...section,
                  data: section.data.filter(p => 
                    !(p._id === provider._id && p.serviceCategory === provider.serviceCategory)
                  ),
                })).filter(section => section.data.length > 0)
              );
            } else {
              Alert.alert('Error', result.error || 'Failed to remove from favorites');
            }
          },
        },
      ]
    );
  };
  
  /**
   * Handle book provider
   */
  const handleBookProvider = (provider) => {
    const category = provider.serviceCategory;
    
    // Determine which screen to navigate to
    if (['photographer', 'influencer'].includes(category)) {
      navigation.navigate('EventServices');
    } else if (['snake_catcher', 'private_ambulance', 'mortuary_van'].includes(category)) {
      navigation.navigate('EmergencyServices');
    } else {
      // Traditional service - go to home with service pre-selected
      navigation.navigate('HomeTab', {
        preSelectedService: category,
      });
    }
  };
  
  /**
   * Render header
   */
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <MaterialIcon name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>My Favorites</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
  
  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcon name="favorite-border" size={64} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>No Favorites Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your favorite providers will appear here after you complete a service and add them to favorites
      </Text>
      <View style={styles.emptyHintContainer}>
        <MaterialIcon name="info-outline" size={18} color="#9CA3AF" />
        <Text style={styles.emptyHintText}>
          After completing a service, tap the heart icon to save the provider
        </Text>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      ) : sections.length === 0 ? (
        renderEmptyState()
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item._id}-${item.serviceCategory}-${index}`}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onCall={handleCallProvider}
              onRemove={handleRemoveFavorite}
              onBook={handleBookProvider}
            />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader 
              category={section.category} 
              count={section.data.length}
            />
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFavorites(true)}
              colors={[BRAND.primary]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  emptyHintText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  
  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  
  // Provider Card
  providerCard: {
    backgroundColor: BRAND.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND.white,
  },
  providerInfo: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 4,
  },
  lastServiceText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  
  // Notes
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
    lineHeight: 18,
  },
  
  // Actions
  providerActions: {
    flexDirection: 'row',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.white,
    marginLeft: 6,
  },
  bookButton: {
    flex: 2,
    flexDirection: 'row',
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.white,
    marginLeft: 6,
  },
});

export default FavoritesScreen;
