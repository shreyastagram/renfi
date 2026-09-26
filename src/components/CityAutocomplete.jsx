/**
 * CityAutocomplete — Mapbox-powered city search
 * 
 * Lightweight city-only autocomplete:
 * - User types "Y" → sees "Yavatmal", "Yadgir", etc.
 * - User types "Sat" → sees "Satara", "Satna", etc.
 * - India-focused, fuzzy matching
 * - Auto-fills city and optionally pincode
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
import {
  useThemedStyles,
  useThemeColors,
} from '../theme';

const GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const INDIA_BBOX = '68.1766451354,6.747139,97.4025614766,35.4940095078';
const DEBOUNCE_MS = 250;

const CityAutocomplete = ({
  value = '',
  onSelectCity,
  placeholder = 'Search city...',
  label = 'City',
  editable = true,
  style,
}) => {
  const styles = useThemedStyles(makeStyles);
  const C = makeC(useThemeColors());
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && !showSuggestions) {
      setQuery(value);
    }
  }, [value]);

  const fetchCities = useCallback(async (searchText) => {
    if (!searchText || searchText.length < 1) {
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
        `&types=place,district,locality` +
        `&limit=6` +
        `&language=en` +
        `&autocomplete=true` +
        `&fuzzyMatch=true`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const cities = data.features.map((feature) => {
          const context = feature.context || [];
          let state = '';
          let pincode = '';
          context.forEach((ctx) => {
            if (ctx.id?.startsWith('region')) state = ctx.text || '';
            if (ctx.id?.startsWith('postcode')) pincode = ctx.text || '';
          });

          return {
            id: feature.id,
            name: feature.text || '',
            fullName: feature.place_name || '',
            state,
            pincode,
          };
        });
        setSuggestions(cities);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(searchText.length >= 2);
      }
    } catch (error) {
      console.error('[CityAutocomplete] Error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCities(text), DEBOUNCE_MS);
  };

  const handleSelect = (city) => {
    setQuery(city.name);
    setShowSuggestions(false);
    setSuggestions([]);
    Keyboard.dismiss();

    if (onSelectCity) {
      onSelectCity({
        city: city.name,
        state: city.state,
        pincode: city.pincode,
      });
    }
  };

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.6}
    >
      <MaterialIcon name="location-city" size={18} color={C.textSecondary} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cityName}>{item.name}</Text>
        {item.state ? (
          <Text style={styles.stateName}>{item.state}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
      selectionColor={C.primary}
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          editable={editable}
          autoCorrect={false}
          returnKeyType="done"
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
        />
        {loading && <ActivityIndicator size="small" color={C.brandOrangeInk} />}
      </View>

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
          ) : !loading && query.length >= 2 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No cities found</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

const makeC = (c) => ({
  brandOrangeInk: c.brandOrangeInk,
  primary: c.brandOrange,
  onPrimary: c.onBrandOrange,
  secondary: c.brandBlue,
  onSecondary: c.onBrandBlue,
  white: c.surface,
  sunken: c.surfaceSunken,
  hairline: c.bg,
  line: c.borderNeutral,
  lineSlate: c.border,
  borderMedium: c.borderMediumNeutral,
  text: c.textStrongNeutral,
  textDark: c.textPrimary,
  textBody: c.textBodyNeutral,
  textSecondary: c.textSecondary,
  muted: c.textMuted,
  success: c.success,
  successBg: c.successContainer,
  danger: c.danger,
  dangerBg: c.dangerContainer,
  warning: c.warning,
  warningBg: c.warningContainer,
  info: c.info,
  infoBg: c.infoContainer,
  indigo: c.altBlueIndigo,
  overlay: c.overlay,
  shadow: c.shadow,
});

const makeStyles = (theme) => {
  const C = makeC(theme.colors);
  return StyleSheet.create({
  container: {
    zIndex: 998,
    elevation: 998,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textBody,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.sunken,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.lineSlate,
    paddingHorizontal: 12,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  suggestionsContainer: {
    marginTop: 4,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    maxHeight: 240,
    zIndex: 1000,
    overflow: 'hidden',
    elevation: 10,
    ...Platform.select({
      ios: {
        shadowColor: C.shadow,
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
    maxHeight: 190,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  stateName: {
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: C.sunken,
    marginHorizontal: 14,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noResultsText: {
    fontSize: 13,
    color: C.muted,
  },
  });
};

export default CityAutocomplete;
