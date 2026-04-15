import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import * as bookingsApi from '../../api/bookings';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, shadows, borderRadius } from '../../styles/colors';
import { formatCurrency, getImageSource } from '../../utils/helpers';

const SuccessModal = ({ visible, onClose }) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const checkmarkAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      checkmarkAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.successIconContainer}>
            <Animated.Text style={[styles.successIcon, { opacity: checkmarkAnim }]}>
              ✅
            </Animated.Text>
          </View>
          <Text style={styles.modalTitle}>Request Sent!</Text>
          <Text style={styles.modalMessage}>
            Your booking request has been sent to the vendor. You'll be notified once they respond.
          </Text>
          <Button
            title="Done"
            onPress={onClose}
            fullWidth
            variant="primary"
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const CreateBookingScreen = ({ navigation, route }) => {
  const { listing } = route.params || {};
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bookingCreated, setBookingCreated] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const imageSource = listing 
    ? getImageSource(listing.images?.[0]?.image_url || listing.image_url)
    : null;

  const handleBook = async () => {
    if (bookingCreated) return;

    const newErrors = {};
    if (!eventDate) newErrors.eventDate = 'Please select an event date';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      let formattedEventDate = eventDate;
      if (eventDate && !eventDate.includes('T')) {
        formattedEventDate = `${eventDate}T00:00:00Z`;
      }
      
      let formattedEndDate = null;
      if (endDate) {
        formattedEndDate = endDate.includes('T') ? endDate : `${endDate}T00:00:00Z`;
      }

      await bookingsApi.createBooking({
        listing_id: listing?.id,
        event_date: formattedEventDate,
        end_date: formattedEndDate,
        special_request: specialRequest,
      });
      
      setBookingCreated(true);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('[CreateBookingScreen] Booking error:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to create booking';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {listing && (
          <View style={styles.listingSection}>
            {imageSource && (
              <Image source={imageSource} style={styles.listingImage} />
            )}
            <View style={styles.listingDetails}>
              <Text style={styles.listingTitle}>{listing.title}</Text>
              {listing.location && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.listingLocation}>{listing.location}</Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.listingPrice}>{formatCurrency(listing.price)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          
          <Input
            label="Event Date"
            value={eventDate}
            onChangeText={setEventDate}
            placeholder="YYYY-MM-DD"
            error={errors.eventDate}
            editable={!bookingCreated && !loading}
          />

          <Input
            label="End Date (Optional)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            editable={!bookingCreated && !loading}
          />

          <Input
            label="Special Requests"
            value={specialRequest}
            onChangeText={setSpecialRequest}
            placeholder="Any special requirements, dietary restrictions, etc..."
            multiline
            numberOfLines={4}
            editable={!bookingCreated && !loading}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.priceFooter}>
          <Text style={styles.footerPriceLabel}>Total</Text>
          <Text style={styles.footerPrice}>
            {formatCurrency(listing?.price || 0)}
          </Text>
        </View>
        <Button
          title={bookingCreated ? 'Requested' : 'Book Now'}
          onPress={handleBook}
          loading={loading}
          disabled={bookingCreated}
          fullWidth
          variant={bookingCreated ? 'success' : 'primary'}
          size="large"
        />
      </View>

      <SuccessModal 
        visible={showSuccessModal} 
        onClose={handleSuccessClose}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  listingSection: {
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  listingImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surfaceLight,
  },
  listingDetails: {
    padding: 20,
  },
  listingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  listingLocation: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 16,
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  listingPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  formSection: {
    padding: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  footer: {
    backgroundColor: colors.surface,
    padding: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    ...shadows.medium,
  },
  priceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerPriceLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footerPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});

export default CreateBookingScreen;