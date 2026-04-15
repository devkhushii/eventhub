import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as listingsApi from '../../api/listings';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';

const MyListingsScreen = ({ navigation }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchListings = async () => {
    try {
      console.log('[MyListings] Fetching...');
      const data = await listingsApi.getMyListings();
      console.log('[MyListings] Response:', data);
      
      const listingsData = Array.isArray(data) 
        ? data 
        : data?.data || [];
      setListings(listingsData);
    } catch (error) {
      console.error('[MyListings] Failed to fetch:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleDelete = (listing) => {
    Alert.alert(
      'Delete Listing',
      `Are you sure you want to delete "${listing.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[MyListings] Deleting:', listing.id);
              await listingsApi.deleteListing(listing.id);
              Alert.alert('Success', 'Listing deleted');
              fetchListings();
            } catch (error) {
              console.error('[MyListings] Delete error:', error);
              Alert.alert('Error', 'Failed to delete listing');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'PUBLISHED':
        return { text: 'Published', style: styles.publishedBadge };
      case 'DRAFT':
        return { text: 'Draft', style: styles.draftBadge };
      case 'ARCHIVED':
        return { text: 'Archived', style: styles.archivedBadge };
      default:
        return { text: status || 'Unknown', style: styles.unknownBadge };
    }
  };

  const renderListing = ({ item }) => {
    const status = getStatusBadge(item.status);
    return (
      <Card style={styles.listingCard}>
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle}>{item.title || 'Untitled'}</Text>
          <Text style={styles.listingPrice}>${item.price || 0}</Text>
          <Text style={styles.listingType}>{item.listing_type || 'N/A'}</Text>
          {item.location && (
            <Text style={styles.listingLocation}>{item.location}</Text>
          )}
          <View style={styles.listingMeta}>
            <Text style={[styles.statusBadge, status.style]}>
              {status.text}
            </Text>
            <Text style={styles.activeText}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.listingActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditListing', { listing: item })}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('UploadImages', { listingId: item.id })}
          >
            <Text style={styles.actionText}>Images</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        ListEmptyComponent={
          <EmptyState
            title="No Listings"
            message="You haven't created any listings yet"
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  listingCard: {
    marginBottom: 12,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  listingType: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  listingLocation: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  publishedBadge: {
    backgroundColor: colors.success + '20',
    color: colors.success,
  },
  draftBadge: {
    backgroundColor: colors.warning + '20',
    color: colors.warning,
  },
  archivedBadge: {
    backgroundColor: colors.textMuted + '20',
    color: colors.textMuted,
  },
  unknownBadge: {
    backgroundColor: colors.surfaceLight,
    color: colors.textMuted,
  },
  activeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listingActions: {
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    marginBottom: 4,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
  },
  deleteText: {
    color: colors.error,
    fontSize: 12,
  },
});

export default MyListingsScreen;
