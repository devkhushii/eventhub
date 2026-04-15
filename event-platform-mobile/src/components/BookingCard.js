import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, shadows, borderRadius } from '../styles/colors';
import StatusBadge from './StatusBadge';
import { formatDate, formatCurrency, getImageSource } from '../utils/helpers';

const BookingCard = ({ booking, onPress, variant = 'user' }) => {
  if (!booking) {
    return null;
  }

  const imageSource = getImageSource(
    booking.listing?.image_url || booking.listing?.images?.[0]?.image_url
  );
  const title = booking.listing?.title || 'Event Booking';
  const eventDate = booking.event_date ? formatDate(booking.event_date) : 'Date not set';
  const price = booking.total_price || booking.listing?.price;

  return (
    <TouchableOpacity
      style={[styles.card, shadows.medium]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {imageSource && (
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <StatusBadge status={booking.status} size="small" />
        </View>
        
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <Text style={styles.detailText}>{eventDate}</Text>
            {booking.end_date && (
              <Text style={styles.detailText}> - {formatDate(booking.end_date)}</Text>
            )}
          </View>
          
          {booking.user && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>👤</Text>
              <Text style={styles.detailText}>
                {booking.user.full_name || booking.user.email}
              </Text>
            </View>
          )}
          
          {booking.special_request && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📝</Text>
              <Text style={styles.detailText} numberOfLines={1}>
                {booking.special_request}
              </Text>
            </View>
          )}
        </View>
        
        {price && (
          <View style={styles.footer}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>{formatCurrency(price)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceLight,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginRight: 12,
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default BookingCard;