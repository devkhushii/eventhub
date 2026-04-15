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
import * as adminApi from '../../api/admin';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';

const AdminListingsScreen = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchListings = async (pageNum = 1) => {
    try {
      console.log('[AdminListings] Fetching page:', pageNum);
      const data = await adminApi.getAllListings(pageNum, 20);
      console.log('[AdminListings] Response:', data);
      
      if (pageNum === 1) {
        setListings(data?.data || []);
      } else {
        setListings(prev => [...prev, ...(data?.data || [])]);
      }
      setHasMore(data?.data?.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('[AdminListings] Failed to fetch listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchListings(1);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings(1);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchListings(page + 1);
    }
  };

  const handleUpdateStatus = async (listing, newStatus) => {
    try {
      console.log('[AdminListings] Updating listing:', listing.id, newStatus);
      await adminApi.updateListingStatus(listing.id, { status: newStatus });
      Alert.alert('Success', `Listing ${newStatus.toLowerCase()}`);
      fetchListings(1);
    } catch (error) {
      console.error('[AdminListings] Update error:', error);
      Alert.alert('Error', 'Failed to update listing');
    }
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
          {item.status?.toUpperCase() !== 'PUBLISHED' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleUpdateStatus(item, 'PUBLISHED')}
            >
              <Text style={styles.approveText}>Publish</Text>
            </TouchableOpacity>
          )}
          {item.status?.toUpperCase() !== 'ARCHIVED' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.archiveButton]}
              onPress={() => handleUpdateStatus(item, 'ARCHIVED')}
            >
              <Text style={styles.archiveText}>Archive</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, item.is_active ? styles.deactivateButton : styles.activateButton]}
            onPress={() => handleUpdateStatus(item, item.status)}
          >
            <Text style={item.is_active ? styles.deactivateText : styles.activateText}>
              {item.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderFooter = () => {
    if (!refreshing) return null;
    return (
      <View style={styles.footer}>
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  if (loading && page === 1) {
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
            message="No listings found"
          />
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
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
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  approveButton: {
    backgroundColor: colors.success + '20',
  },
  approveText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  archiveButton: {
    backgroundColor: colors.warning + '20',
  },
  archiveText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  activateButton: {
    backgroundColor: colors.success + '20',
  },
  activateText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  deactivateButton: {
    backgroundColor: colors.error + '20',
  },
  deactivateText: {
    color: colors.error,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
  },
});

export default AdminListingsScreen;
