import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

MapboxGL.setAccessToken('pk.eyJ1IjoiZml4aG9taSIsImEiOiJjbWY2Zjg1MTUwMnhmMm1zNnQxaTdkcmtnIn0.AtF-wG4vaenzSf0Ff9aYBg');

const MapScreen = () => {
  useEffect(() => {
    MapboxGL.requestAndroidLocationPermissions();
  }, []);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map}>
        <MapboxGL.Camera
          zoomLevel={14}
          centerCoordinate={[77.5946, 12.9716]} // Example: Bangalore
        />
        <MapboxGL.UserLocation visible={true} />
      </MapboxGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapScreen;
