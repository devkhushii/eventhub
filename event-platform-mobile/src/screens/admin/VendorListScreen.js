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

const VendorListScreen = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(null);

  const fetchVendors = async () => {
    try {
      console.log('[VendorList] Fetching with filter:', filter);
      const data = await adminApi.getAllVendors(filter);
      console.log('[VendorList] Vendors:', data);
      setVendors(data || []);
    } catch (error) {
      console.error('[VendorList] Failed to fetch vendors:', error);
      setVendors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVendors();
    }, [filter])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVendors();
  };

  const handleApprove = async (vendor) => {
    try {
      console.log('[VendorList] Approving vendor:', vendor.id);
      await adminApi.verifyVendor(vendor.id, { approve: true, rejection_reason: null });
      Alert.alert('Success', 'Vendor has been approved');
      fetchVendors();
    } catch (error) {
      console.error('[VendorList] Approve error:', error);
      Alert.alert('Error', 'Failed to approve vendor');
    }
  };

  const handleReject = (vendor) => {
    Alert.prompt(
      'Reject Vendor',
      'Enter rejection reason (optional)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
            try {
              console.log('[VendorList] Rejecting vendor:', vendor.id, reason);
              await adminApi.verifyVendor(vendor.id, { approve: false, rejection_reason: reason });
              Alert.alert('Success', 'Vendor has been rejected');
              fetchVendors();
            } catch (error) {
              console.error('[VendorList] Reject error:', error);
              Alert.alert('Error', 'Failed to reject vendor');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return { text: 'Approved', style: styles.approvedBadge };
      case 'PENDING':
        return { text: 'Pending', style: styles.pendingBadge };
      case 'REJECTED':
        return { text: 'Rejected', style: styles.rejectedBadge };
      default:
        return { text: status || 'Unknown', style: styles.unknownBadge };
    }
  };

  const renderVendor = ({ item }) => {
    const status = getStatusBadge(item.verification_status);
    return (
      <Card style={styles.vendorCard}>
        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>{item.business_name || 'Vendor'}</Text>
          <Text style={styles.vendorEmail}>{item.user?.email || 'No email'}</Text>
          <View style={styles.vendorMeta}>
            <Text style={[styles.statusBadge, status.style]}>
              {status.text}
            </Text>
          </View>
        </View>
        <View style={styles.vendorActions}>
          {item.verification_status?.toUpperCase() === 'PENDING' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(item)}
              >
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(item)}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Card>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, !filter && styles.filterChipActive]}
          onPress={() => setFilter(null)}
        >
          <Text style={[styles.filterText, !filter && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'PENDING' && styles.filterChipActive]}
          onPress={() => setFilter('PENDING')}
        >
          <Text style={[styles.filterText, filter === 'PENDING' && styles.filterTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'APPROVED' && styles.filterChipActive]}
          onPress={() => setFilter('APPROVED')}
        >
          <Text style={[styles.filterText, filter === 'APPROVED' && styles.filterTextActive]}>Approved</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'REJECTED' && styles.filterChipActive]}
          onPress={() => setFilter('REJECTED')}
        >
          <Text style={[styles.filterText, filter === 'REJECTED' && styles.filterTextActive]}>Rejected</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={vendors}
        renderItem={renderVendor}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        ListEmptyComponent={
          <EmptyState
            title="No Vendors"
            message="No vendors found"
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
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  filterTextActive: {
    color: colors.textLight,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  vendorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  vendorEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  vendorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  approvedBadge: {
    backgroundColor: colors.success + '20',
    color: colors.success,
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
    color: colors.warning,
  },
  rejectedBadge: {
    backgroundColor: colors.error + '20',
    color: colors.error,
  },
  unknownBadge: {
    backgroundColor: colors.surfaceLight,
    color: colors.textMuted,
  },
  vendorActions: {
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 4,
  },
  approveButton: {
    backgroundColor: colors.success + '20',
  },
  rejectButton: {
    backgroundColor: colors.error + '20',
  },
  approveText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  rejectText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default VendorListScreen;
