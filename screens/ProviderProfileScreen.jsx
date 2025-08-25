import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

const SERVICE_CATEGORIES = [
  'Plumber',
  'Electrician',
  'Carpenter',
  'Painter',
  'AC Repair',
  // Add more as needed
];

const ProviderProfileScreen = ({ navigation }) => {
  const [serviceCategory, setServiceCategory] = useState('Plumber');
  const [serviceTypes, setServiceTypes] = useState(['']);

  const handleServiceTypeChange = (text, idx) => {
    const updated = [...serviceTypes];
    updated[idx] = text;
    setServiceTypes(updated);
  };

  const addServiceTypeField = () => {
    setServiceTypes([...serviceTypes, '']);
  };

  const handleSubmit = () => {
    // For now, just log the values. Later, send to backend.
    console.log({ serviceCategory, serviceTypes });
    // Navigate to ManageAccountScreen after submitting profile
    navigation.replace('ManageAccount');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Complete Your Provider Profile</Text>
      <Text style={styles.label}>Select Service Category</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={serviceCategory}
          onValueChange={setServiceCategory}
          style={styles.picker}
        >
          {SERVICE_CATEGORIES.map(cat => (
            <Picker.Item key={cat} label={cat} value={cat} />
          ))}
        </Picker>
      </View>
      <Text style={styles.label}>
        Service Types (e.g., Tap Repair, Installation)
      </Text>
      {serviceTypes.map((type, idx) => (
        <TextInput
          key={idx}
          style={styles.input}
          value={type}
          onChangeText={text => handleServiceTypeChange(text, idx)}
          placeholder={`Service Type #${idx + 1}`}
        />
      ))}
      <Button title="Add Another Service Type" onPress={addServiceTypeField} />
      <View style={{ height: 24 }} />
      <Button title="Submit" onPress={handleSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  label: {
    fontSize: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginBottom: 20,
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    width: '100%',
    height: 44,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 12,
    width: '100%',
    maxWidth: 350,
  },
});

export default ProviderProfileScreen;
