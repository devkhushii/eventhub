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
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import * as bookingsApi from '../../api/bookings';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, shadows, borderRadius } from '../../styles/colors';
import { formatCurrency, getImageSource } from '../../utils/helpers';
import { FontAwesome5 } from '@expo/vector-icons';

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
            <Animated.View style={{ opacity: checkmarkAnim }}>
              <FontAwesome5 name="check" size={40} color={colors.success} />
            </Animated.View>
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState('start');
  const insets = useSafeAreaInsets();

  const imageSource = listing 
    ? getImageSource(listing.images?.[0]?.image_url || listing.image_url)
    : null;

  const calculateTotalDays = (start, end) => {
    if (!start || !end) {
      return 1;
    }
    try {
      const startDate = new Date(start);
      const endDateObj = new Date(end);
      if (isNaN(startDate.getTime())) {
        return 1;
      }
      if (isNaN(endDateObj.getTime())) {
        return 1;
      }
      if (endDateObj < startDate) {
        return 1;
      }
      const diffTime = endDateObj.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateTotalDays(eventDate, endDate);
  const perDayPrice = listing?.price || 0;
  const calculatedTotal = perDayPrice * totalDays;

  const handleBook = async () => {
    if (bookingCreated) return;

    const newErrors = {};
    if (!eventDate) newErrors.eventDate = 'Please select an event date';

    if (eventDate && endDate) {
      try {
        const startD = new Date(eventDate);
        const endD = new Date(endDate);
        if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
          if (endD < startD) {
            newErrors.endDate = 'End date cannot be before start date';
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    let newBooking = null;
    try {
      let formattedEventDate = eventDate;
      if (eventDate && !eventDate.includes('T')) {
        formattedEventDate = `${eventDate}T00:00:00Z`;
      }
      
      let formattedEndDate = null;
      if (endDate) {
        formattedEndDate = endDate.includes('T') ? endDate : `${endDate}T00:00:00Z`;
      }

      newBooking = await bookingsApi.createBooking({
        listing_id: listing?.id,
        event_date: formattedEventDate,
        end_date: formattedEndDate,
        special_request: specialRequest,
      });
      
      console.log('[CreateBookingScreen] Booking created - Backend response:', {
        id: newBooking?.id,
        totalPrice: newBooking?.total_price,
        totalDays: newBooking?.total_days,
        advanceAmount: newBooking?.advance_amount,
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
                  <FontAwesome5 name="map-marker-alt" size={14} color={colors.textSecondary} style={styles.locationIcon} />
                  <Text style={styles.listingLocation}>{listing.location}</Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price per day</Text>
                <Text style={styles.listingPrice}>{formatCurrency(listing.price)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <TouchableOpacity 
            onPress={() => { setCalendarMode('start'); setShowCalendar(true); }}
            disabled={bookingCreated || loading}
          >
            <View pointerEvents="none">
              <Input
                label="Event Date"
                value={eventDate}
                placeholder="Select Event Date"
                error={errors.eventDate}
                rightIcon={<FontAwesome5 name="calendar-alt" size={16} color={colors.textSecondary} />}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setCalendarMode('end'); setShowCalendar(true); }}
            disabled={bookingCreated || loading}
          >
            <View pointerEvents="none">
              <Input
                label="End Date (Optional)"
                value={endDate}
                placeholder="Select End Date"
                rightIcon={<FontAwesome5 name="calendar-alt" size={16} color={colors.textSecondary} />}
              />
            </View>
          </TouchableOpacity>

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

      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom) }]}>
        <View style={styles.priceBreakdown}>
          <View style={styles.priceRowCalc}>
            <Text style={styles.priceLabelCalc}>
              {perDayPrice ? `${formatCurrency(perDayPrice)} x ${totalDays} day${totalDays > 1 ? 's' : ''}` : 'Total'}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.footerPriceLabel}>Total</Text>
            <Text style={styles.footerPrice}>
              {formatCurrency(calculatedTotal)}
            </Text>
          </View>
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

      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {calendarMode === 'start' ? 'Select Event Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <FontAwesome5 name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={calendarMode === 'start' ? eventDate : (endDate || eventDate || undefined)}
              minDate={calendarMode === 'end' && eventDate ? eventDate : new Date().toISOString().split('T')[0]}
              onDayPress={(day) => {
                if (calendarMode === 'start') {
                  setEventDate(day.dateString);
                  if (endDate && day.dateString > endDate) {
                    setEndDate('');
                  }
                } else {
                  setEndDate(day.dateString);
                }
                setShowCalendar(false);
              }}
              theme={{
                todayTextColor: colors.primary,
                selectedDayBackgroundColor: colors.primary,
                arrowColor: colors.primary,
              }}
              markedDates={{
                [calendarMode === 'start' ? eventDate : endDate]: { selected: true, selectedColor: colors.primary },
              }}
            />
          </View>
        </View>
      </Modal>
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
    color: colors.success,
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
  priceBreakdown: {
    marginBottom: 12,
  },
  priceRowCalc: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabelCalc: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: colors.success,
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
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  calendarModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: 20,
    ...shadows.large,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
});

export default CreateBookingScreen;