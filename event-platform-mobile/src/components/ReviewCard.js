import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';

const ReviewCard = ({ review }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {review.user?.name?.charAt(0) || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{review.user?.name || 'Anonymous'}</Text>
            <Text style={styles.date}>
              {new Date(review.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={styles.rating}>
          <Text style={styles.ratingText}>★ {review.rating}/5</Text>
        </View>
      </View>
      {review.comment && <Text style={styles.comment}>{review.comment}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
  rating: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ratingText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  comment: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ReviewCard;
