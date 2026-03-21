/**
 * AddressAutocomplete — Mapbox-powered address search
 * 
 * Production-grade address picker with:
 * - Real-time search-as-you-type using Mapbox Geocoding API
 * - Auto-fills address, city, pincode in one tap
 * - Debounced API calls (300ms) to avoid rate limits
 * - India-focused results (country bias)
 * - Works for both user and provider profiles
 * - Handles partial/misspelled queries (Mapbox fuzzy matching)
 * - Zero external dependencies beyond Mapbox token already in project
 * 
 * Usage:
 *   <AddressAutocomplete
 *     value={formData.address}
 *     onSelectAddress={({ address, city, pincode, state, fullAddress }) => {
 *       setFormData(prev => ({ ...prev, address: fullAddress, city, pincode }));
 *     }}
 *     placeholder="Search address..."
 *   />
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView
} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { MAPBOX_ACCESS_TOKEN } from '../config/mapbox';

// Mapbox Geocoding API v5 (free with any Mapbox token, 100k requests/month)
const GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// India bounding box for biased results
const INDIA_BBOX = '68.1766451354,6.747139,97.4025614766,35.4940095078';

// Debounce delay
const DEBOUNCE_MS = 300;

/**
 * Parse Mapbox place context into structured address components
 */
const parseMapboxContext = (feature) => {
  const context = feature.context || [];
  const properties = feature.properties || {};

  // Extract components from context array
  let city = '';
  let state = '';
  let pincode = '';
  let district = '';

  context.forEach((ctx) => {
    const id = ctx.id || '';
    if (id.startsWith('postcode')) {
      pincode = ctx.text || '';
    } else if (id.startsWith('place')) {
      city = ctx.text || '';
    } else if (id.startsWith('district')) {
      district = ctx.text || '';
    } else if (id.startsWith('region')) {
      state = ctx.text || '';
    } else if (id.startsWith('locality')) {
      // Locality can be a neighborhood or subarea
      if (!city) city = ctx.text || '';
    }
  });

  // If the feature itself is a place (city), use it
  if (feature.place_type?.includes('place')) {
    city = feature.text || city;
  }

  // Fallback: if no city found, use district
  if (!city && district) {
    city = district;
  }

  // Build full address string
  const fullAddress = feature.place_name || '';
  // Short address = feature text (the main part, before the city/state)
  const shortAddress = feature.text || '';

  return {
    address: shortAddress,
    fullAddress,
    city,
    state,
    pincode,
    district,
    coordinates: feature.center ? {
      longitude: feature.center[0],
      latitude: feature.center[1],
    } : null,
  };
};

const AddressAutocomplete = ({
  value = '',
  onSelectAddress,
  placeholder = 'Search for your address...',
  label = 'Address',
  editable = true,
  style,
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external value changes (e.g., from "Detect My Location")
  useEffect(() => {
    if (!showSuggestions) {
      setQuery(value || '');
    }
  }, [value]);

  /**
   * Fetch address suggestions from Mapbox Geocoding API
   */
  const fetchSuggestions = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    try {
      const encoded = encodeURIComponent(searchText.trim());
      const url = `${GEOCODING_BASE}/${encoded}.json?` +
        `access_token=${MAPBOX_ACCESS_TOKEN}` +
        `&country=IN` +
        `&bbox=${INDIA_BBOX}` +
        `&types=address,poi,place,locality,neighborhood,postcode` +
        `&limit=6` +
        `&language=en` +
        `&autocomplete=true` +
        `&fuzzyMatch=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const parsed = data.features.map((feature) => ({
          id: feature.id,
          ...parseMapboxContext(feature),
          raw: feature,
        }));
        setSuggestions(parsed);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(searchText.length >= 3); // Show "no results" only after 3 chars
      }
    } catch (error) {
      console.error('[AddressAutocomplete] Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle text input with debounce
   */
  const handleTextChange = (text) => {
    setQuery(text);
    setSelectedAddress(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, DEBOUNCE_MS);
  };

  /**
   * Handle suggestion selection
   */
  const handleSelect = async (suggestion) => {
    setQuery(suggestion.fullAddress);
    setSelectedAddress(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();

    let { pincode } = suggestion;

    // If pincode is missing and we have coordinates, do a reverse geocode to find it
    if (!pincode && suggestion.coordinates) {
      try {
        const { longitude, latitude } = suggestion.coordinates;
        const revUrl = `${GEOCODING_BASE}/${longitude},${latitude}.json?` +
          `access_token=${MAPBOX_ACCESS_TOKEN}&types=postcode&limit=1&country=IN`;
        const revRes = await fetch(revUrl);
        const revData = await revRes.json();
        if (revData.features?.[0]?.text) {
          pincode = revData.features[0].text;
        }
      } catch (e) {
        // Pincode lookup failed — continue without it
      }
    }

    if (onSelectAddress) {
      onSelectAddress({
        address: suggestion.fullAddress,
        city: suggestion.city,
        pincode: pincode || '',
        state: suggestion.state,
        district: suggestion.district,
        coordinates: suggestion.coordinates,
        fullAddress: suggestion.fullAddress,
      });
    }
  };

  /**
   * Clear input
   */
  const handleClear = () => {
    setQuery('');
    setSelectedAddress(null);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  /**
   * Render a single suggestion row
   */
  const renderSuggestion = ({ item }) => {
    // Determine icon based on type
    const getIcon = () => {
      if (item.raw?.place_type?.includes('poi')) return 'place';
      if (item.raw?.place_type?.includes('address')) return 'home';
      if (item.raw?.place_type?.includes('locality')) return 'location-city';
      if (item.raw?.place_type?.includes('place')) return 'location-city';
      return 'location-on';
    };

    // Build subtitle parts
    const subtitleParts = [item.city, item.state, item.pincode].filter(Boolean);
    const subtitle = subtitleParts.join(', ');

    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
      >
        <View style={styles.suggestionIcon}>
          <MaterialIcon name={getIcon()} size={20} color="#6B7280" />
        </View>
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionTitle} numberOfLines={1}>
            {item.address || item.fullAddress}
          </Text>
          {subtitle ? (
            <Text style={styles.suggestionSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {item.pincode ? (
            <Text style={styles.suggestionPincode}>PIN: {item.pincode}</Text>
          ) : null}
        </View>
        <MaterialIcon name="north-west" size={16} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Search Input */}
      <View style={styles.inputContainer}>
        <MaterialIcon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          editable={editable}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color="#FF6B00" style={styles.loader} />
        )}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <MaterialIcon name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected address indicator */}
      {selectedAddress && (
        <View style={styles.selectedInfo}>
          <MaterialIcon name="check-circle" size={14} color="#10B981" />
          <Text style={styles.selectedText} numberOfLines={1}>
            {selectedAddress.city}{selectedAddress.pincode ? ` • ${selectedAddress.pincode}` : ''}
            {selectedAddress.state ? ` • ${selectedAddress.state}` : ''}
          </Text>
        </View>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {suggestions.length > 0 ? (
            <ScrollView
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {suggestions.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.separator} />}
                  {renderSuggestion({ item })}
                </React.Fragment>
              ))}
            </ScrollView>
          ) : !loading && query.length >= 3 ? (
            <View style={styles.noResults}>
              <MaterialIcon name="search-off" size={24} color="#D1D5DB" />
              <Text style={styles.noResultsText}>No addresses found</Text>
              <Text style={styles.noResultsHint}>Try a different search term</Text>
            </View>
          ) : null}

          {/* Mapbox attribution (required by ToS) */}
          <View style={styles.attribution}>
            <Text style={styles.attributionText}>Powered by Mapbox</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    elevation: 999,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  loader: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  selectedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  suggestionsContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 320,
    zIndex: 1000,
    elevation: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  suggestionsList: {
    maxHeight: 260,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
    marginRight: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  suggestionPincode: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  noResultsHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  attribution: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  attributionText: {
    fontSize: 10,
    color: '#D1D5DB',
    textAlign: 'right',
  },
});

export default AddressAutocomplete;
