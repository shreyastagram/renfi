import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const BookServicesScreen = ({ navigation }) => {
  const handleStartBooking = () => {
    // Navigate to location screen to start the new flow
    navigation.navigate('UserLocation');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book Our Services</Text>
      <Text style={styles.subtitle}>Available Services:</Text>
      
      <View style={styles.servicesList}>
        <Text style={styles.service}>🔧 Plumber</Text>
        <Text style={styles.service}>⚡ Electrician</Text>
        <Text style={styles.service}>🔨 Carpenter</Text>
        <Text style={styles.service}>🎨 Painter</Text>
        <Text style={styles.service}>❄️ AC Repair</Text>
        <Text style={styles.service}>🧹 Cleaning</Text>
      </View>
      
      <TouchableOpacity style={styles.startButton} onPress={handleStartBooking}>
        <Text style={styles.startButtonText}>Start Booking Process</Text>
      </TouchableOpacity>
      
      <Text style={styles.flowDescription}>
        You'll be guided through:
        1. Setting your location
        2. Selecting a service
        3. Sending your request
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    color: '#666',
  },
  servicesList: {
    marginBottom: 32,
    alignItems: 'center',
  },
  service: {
    fontSize: 18,
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  flowDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});

export default BookServicesScreen;
