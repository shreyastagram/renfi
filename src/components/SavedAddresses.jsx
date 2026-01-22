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
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import {
  getSavedAddresses,
  deleteAddress as deleteAddressApi,
  setDefaultAddress as setDefaultApi,
  formatShortAddress,
  getAddressLabel,
} from '../services/addressService';
import AddressForm from './AddressForm';

// Brand colors - User side uses blue as accent
const BRAND = {
  primary: '#f67c16', // Orange
  secondary: '#2b76bc', // Blue - user side accent
  background: '#faf7f7',
  white: '#FFFFFF',
  neutral: '#6B7280',
};

/**
 * Address Card Component
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
  
  return (
    <TouchableOpacity
      style={[styles.addressCard, isDefault && styles.addressCardDefault]}
      onPress={() => selectable ? onSelect?.(address) : onEdit?.(address)}
      activeOpacity={0.7}
    >
      <View style={[styles.addressIconContainer, isDefault && { backgroundColor: BRAND.secondary + '15' }]}>
        <MaterialIcon 
          name={labelInfo.icon} 
          size={24} 
          color={isDefault ? BRAND.secondary : BRAND.neutral} 
        />
      </View>
      
      <View style={styles.addressContent}>
        <View style={styles.addressHeader}>
          <Text style={[styles.addressLabel, isDefault && styles.addressLabelDefault]}>
            {labelInfo.text}
          </Text>
          {isDefault && (
            <View style={styles.defaultBadge}>
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
          >
            <MaterialIcon name="star-border" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit?.(address)}
        >
          <MaterialIcon name="edit" size={20} color="#6B7280" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDelete?.(address._id)}
        >
          <MaterialIcon name="delete-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Empty State Component
 */
const EmptyState = ({ onAddNew }) => (
  <View style={styles.emptyState}>
    <MaterialIcon name="location-off" size={64} color="#D1D5DB" />
    <Text style={styles.emptyTitle}>No saved addresses</Text>
    <Text style={styles.emptySubtitle}>
      Save your frequently used addresses for quick booking
    </Text>
    <TouchableOpacity style={styles.addButton} onPress={onAddNew}>
      <MaterialIcon name="add" size={20} color="#FFFFFF" />
      <Text style={styles.addButtonText}>Add New Address</Text>
    </TouchableOpacity>
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
    Alert.alert(
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
                Alert.alert('Error', result.error || 'Failed to delete address');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete address');
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
        Alert.alert('Error', result.error || 'Failed to set default address');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set default address');
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
        <ActivityIndicator size="large" color={BRAND.secondary} />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcon name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Saved Addresses</Text>
          <TouchableOpacity onPress={handleAddNew} style={styles.addIconButton}>
            <MaterialIcon name="add" size={24} color={BRAND.secondary} />
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[BRAND.secondary]}
                tintColor={BRAND.secondary}
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
    backgroundColor: BRAND.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: BRAND.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.secondary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: BRAND.neutral,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.white,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  addressCardDefault: {
    borderColor: BRAND.secondary,
    borderWidth: 2,
    backgroundColor: BRAND.secondary + '08',
  },
  addressIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
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
    marginBottom: 6,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  addressLabelDefault: {
    color: BRAND.secondary,
  },
  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: BRAND.secondary + '20',
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressLine1: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 3,
    lineHeight: 20,
  },
  addressDetails: {
    fontSize: 12,
    color: BRAND.neutral,
    lineHeight: 18,
  },
  addressActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: BRAND.neutral,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: BRAND.secondary,
    borderRadius: 14,
    shadowColor: BRAND.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.white,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
});

export default SavedAddresses;
