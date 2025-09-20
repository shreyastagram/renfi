import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';

const SERVICES = [
  {
    id: 'plumber',
    name: 'Plumber',
    icon: '🔧',
    description: 'Pipe repairs, installations, leak fixing',
    color: '#007AFF',
  },
  {
    id: 'electrician',
    name: 'Electrician',
    icon: '⚡',
    description: 'Wiring, electrical repairs, installations',
    color: '#FF9500',
  },
  {
    id: 'carpenter',
    name: 'Carpenter',
    icon: '🔨',
    description: 'Wood work, furniture repair, installations',
    color: '#8E4B00',
  },
  {
    id: 'painter',
    name: 'Painter',
    icon: '🎨',
    description: 'Wall painting, touch-ups, decorations',
    color: '#34C759',
  },
  {
    id: 'ac_repair',
    name: 'AC Repair',
    icon: '❄️',
    description: 'AC maintenance, repairs, installations',
    color: '#5AC8FA',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: '🧹',
    description: 'House cleaning, deep cleaning services',
    color: '#AF52DE',
  },
];

const ServiceSelectionScreen = ({ navigation }) => {
  const handleServiceSelect = (service) => {
    console.log('Service selected:', service);
    // Navigate back to MapScreen with selected service
    navigation.navigate('MapScreen', { selectedService: service });
  };

  const renderServiceCard = ({ item }) => (
    <TouchableOpacity
      style={[styles.serviceCard, { borderLeftColor: item.color }]}
      onPress={() => handleServiceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.serviceIconContainer}>
        <Text style={styles.serviceIcon}>{item.icon}</Text>
      </View>
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceDescription}>{item.description}</Text>
      </View>
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select a Service</Text>
        <Text style={styles.subtitle}>Choose the type of service you need</Text>
      </View>
      
      <FlatList
        data={SERVICES}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C6C70',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderLeftWidth: 4,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#F2F2F7',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceIcon: {
    fontSize: 24,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6C6C70',
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: 12,
  },
  arrow: {
    fontSize: 24,
    color: '#C7C7CC',
    fontWeight: '300',
  },
});

export default ServiceSelectionScreen;