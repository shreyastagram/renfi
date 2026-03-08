/**
 * SavedAddresses Component
 *
 * Displays and manages saved addresses like Ola/Uber
 * - View all saved addresses
 * - Add new address
 * - Edit existing address
 * - Delete address
 * - Set default address
 *
 * Premium Design Language
 *
 * @version 2.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useDialog } from '../context/DialogContext';
import {
  getSavedAddresses,
  deleteAddress as deleteAddressApi,
  setDefaultAddress as setDefaultApi,
  formatShortAddress,
  getAddressLabel,
} from '../services/addressService';
import AddressForm from './AddressForm';

// Premium Design Tokens
const COLORS = {
  darkHero: '#0F172A',
  background: '#F1F5F9',
  cardWhite: '#FFFFFF',
  primary: '#f67c16',
  secondary: '#2b76bc',
  muted: '#94A3B8',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  iconBg: '#F1F5F9',
  border: '#E2E8F0',
};

const SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    android: {
      elevation: 5,
    },
  }),
  float: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
    },
    android: {
      elevation: 12,
    },
  }),
  header: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
  }),
};

/**
 * Address Card Component with animated press
 */
const AddressCard = ({
  address,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  isDefault,
  selectable = false,
}) => {
  const labelInfo = getAddressLabel(address.label, address.customLabel);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.addressCard, isDefault && styles.addressCardDefault]}
        onPress={() => (selectable ? onSelect?.(address) : onEdit?.(address))}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.addressIconContainer,
            isDefault && { backgroundColor: COLORS.secondary + '15' },
          ]}
        >
          <MaterialIcon
            name={labelInfo.icon}
            size={22}
            color={isDefault ? COLORS.secondary : COLORS.muted}
          />
        </View>

        <View style={styles.addressContent}>
          <View style={styles.addressHeader}>
            <Text
              style={[
                styles.addressLabel,
                isDefault && styles.addressLabelDefault,
              ]}
            >
              {labelInfo.text}
            </Text>
            {isDefault && (
              <View style={styles.defaultBadge}>
                <MaterialIcon name="star" size={10} color={COLORS.secondary} />
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>

          <Text style={styles.addressLine1} numberOfLines={1}>
            {address.addressLine1}
          </Text>

          <Text style={styles.addressDetails} numberOfLines={1}>
            {[address.landmark, address.city, address.pincode]
              .filter(Boolean)
              .join(', ')}
          </Text>
        </View>

        <View style={styles.addressActions}>
          {!isDefault && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onSetDefault?.(address._id)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcon name="star-border" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit?.(address)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcon name="edit" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.dangerLight }]}
            onPress={() => onDelete?.(address._id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcon name="delete-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Empty State Component
 */
const EmptyState = ({ onAddNew }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
    }).start();

  const onPressOut = () =>
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <View style={styles.emptyIconInner}>
          <MaterialIcon name="location-off" size={48} color={COLORS.muted} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>No Saved Addresses</Text>
      <Text style={styles.emptySubtitle}>
        Save your frequently used addresses for quick and easy booking
      </Text>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddNew}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.85}
        >
          <MaterialIcon name="add-location-alt" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

/**
 * Section Header with accent bar
 */
const SectionHeaderBar = ({ title, count }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccentBar} />
    <Text style={styles.sectionTitle}>{title}</Text>
    {count > 0 && (
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    )}
  </View>
);

/**
 * SavedAddresses Component
 *
 * @param {string} userId - MongoDB user ID
 * @param {Function} onSelectAddress - Callback when address is selected (for booking flow)
 * @param {boolean} selectable - Whether addresses can be selected (booking mode)
 * @param {Function} onClose - Callback to close the component
 */
const SavedAddresses = ({
  userId,
  onSelectAddress,
  selectable = false,
  onClose,
  showHeader = true,
}) => {
  const insets = useSafeAreaInsets();
  const { dialog } = useDialog();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  /**
   * Load saved addresses
   */
  const loadAddresses = useCallback(async (showLoader = true) => {
    if (!userId) return;

    if (showLoader) setLoading(true);

    try {
      const result = await getSavedAddresses(userId);
      if (result.success) {
        setAddresses(result.addresses);
      } else {
        console.error('Failed to load addresses:', result.error);
      }
    } catch (error) {
      console.error('Load addresses error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Load addresses on mount
  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAddresses(false);
  }, [loadAddresses]);

  /**
   * Handle add new address
   */
  const handleAddNew = useCallback(() => {
    setEditingAddress(null);
    setShowAddressForm(true);
  }, []);

  /**
   * Handle edit address
   */
  const handleEdit = useCallback((address) => {
    setEditingAddress(address);
    setShowAddressForm(true);
  }, []);

  /**
   * Handle delete address
   */
  const handleDelete = useCallback(async (addressId) => {
    dialog(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAddressApi(userId, addressId);
              if (result.success) {
                loadAddresses(false);
              } else {
                dialog('Error', result.error || 'Failed to delete address');
              }
            } catch (error) {
              dialog('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  }, [userId, loadAddresses]);

  /**
   * Handle set default address
   */
  const handleSetDefault = useCallback(async (addressId) => {
    try {
      const result = await setDefaultApi(userId, addressId);
      if (result.success) {
        loadAddresses(false);
      } else {
        dialog('Error', result.error || 'Failed to set default address');
      }
    } catch (error) {
      dialog('Error', 'Failed to set default address');
    }
  }, [userId, loadAddresses]);

  /**
   * Handle address form save
   */
  const handleFormSave = useCallback((savedAddress) => {
    setShowAddressForm(false);
    setEditingAddress(null);
    loadAddresses(false);

    // If in selectable mode and adding new address, select it
    if (selectable && !editingAddress && onSelectAddress) {
      onSelectAddress(savedAddress);
    }
  }, [selectable, editingAddress, onSelectAddress, loadAddresses]);

  /**
   * Handle address selection (booking flow)
   */
  const handleSelect = useCallback((address) => {
    if (onSelectAddress) {
      onSelectAddress(address);
    }
  }, [onSelectAddress]);

  /**
   * Render address item
   */
  const renderAddressItem = useCallback(({ item }) => (
    <AddressCard
      address={item}
      onSelect={handleSelect}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onSetDefault={handleSetDefault}
      isDefault={item.isDefault}
      selectable={selectable}
    />
  ), [handleSelect, handleEdit, handleDelete, handleSetDefault, selectable]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Loading addresses...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8 },
          ]}
        >
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcon name="arrow-back-ios" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Saved Addresses</Text>
            {addresses.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{addresses.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleAddNew} style={styles.addIconButton}>
            <MaterialIcon name="add" size={22} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {addresses.length === 0 ? (
        <EmptyState onAddNew={handleAddNew} />
      ) : (
        <>
          <FlatList
            data={addresses}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContainer}
            ListHeaderComponent={
              <SectionHeaderBar
                title="Your Addresses"
                count={addresses.length}
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[COLORS.secondary]}
                tintColor={COLORS.secondary}
              />
            }
            showsVerticalScrollIndicator={false}
          />

          {/* Floating Add Button */}
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={handleAddNew}
            activeOpacity={0.8}
          >
            <MaterialIcon name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Address Form Modal */}
      <Modal
        visible={showAddressForm}
        animationType="slide"
        onRequestClose={() => {
          setShowAddressForm(false);
          setEditingAddress(null);
        }}
      >
        <AddressForm
          userId={userId}
          address={editingAddress}
          onSave={handleFormSave}
          onClose={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
          }}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.cardWhite,
    ...SHADOWS.header,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkHero,
    letterSpacing: -0.3,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: COLORS.secondary + '15',
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.secondary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    paddingHorizontal: 40,
    paddingVertical: 32,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.muted,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionAccentBar: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkHero,
    letterSpacing: -0.2,
  },
  sectionCountBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sectionCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 22,
    marginBottom: 12,
    ...SHADOWS.card,
  },
  addressCardDefault: {
    borderWidth: 1.5,
    borderColor: COLORS.secondary + '40',
  },
  addressIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  addressContent: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  addressLabelDefault: {
    color: COLORS.secondary,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.secondary + '15',
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressLine1: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 3,
    lineHeight: 20,
  },
  addressDetails: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },
  addressActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...SHADOWS.card,
  },
  emptyIconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkHero,
    marginTop: 20,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 23,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: COLORS.secondary,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.secondary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.secondary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
});

export default SavedAddresses;
