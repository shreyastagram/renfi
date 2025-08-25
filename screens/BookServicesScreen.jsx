import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BookServicesScreen = () => {
  console.log('BookServicesScreen rendered');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book Our Services</Text>
      <Text style={styles.service}>Plumber</Text>
      <Text style={styles.service}>Electrician</Text>
      <Text style={styles.service}>Carpenter</Text>
      <Text style={styles.service}>Painter</Text>
      <Text style={styles.service}>AC Repair</Text>
      {/* Add more services as needed */}
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  service: {
    fontSize: 18,
    marginBottom: 16,
    color: '#333',
  },
});

export default BookServicesScreen;
