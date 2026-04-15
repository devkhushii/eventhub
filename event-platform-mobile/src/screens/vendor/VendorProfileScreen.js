import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as vendorsApi from '../../api/vendors';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';

const VendorProfileScreen = ({ navigation }) => {
  const { logout, user, refreshUser } = useAuth();
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      if (user?.role === 'vendor') {
        const data = await vendorsApi.getVendorProfile();
        setVendorProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch vendor profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [user?.role])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

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

  const status = getStatusBadge(vendorProfile?.verification_status);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {vendorProfile?.business_name?.charAt(0)?.toUpperCase() || user?.full_name?.charAt(0)?.toUpperCase() || 'V'}
            </Text>
          </View>
          <Text style={styles.businessName}>
            {vendorProfile?.business_name || user?.full_name || 'Vendor'}
          </Text>
          <View style={[styles.statusBadge, status.style]}>
            <Text style={styles.statusText}>{status.text}</Text>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Name</Text>
            <Text style={styles.infoValue}>
              {vendorProfile?.business_name || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendor Type</Text>
            <Text style={styles.infoValue}>
              {vendorProfile?.vendor_type || 'N/A'}
            </Text>
          </View>
          {vendorProfile?.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.infoValue}>{vendorProfile.description}</Text>
            </View>
          )}
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vendorProfile?.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vendorProfile?.total_reviews || 0}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>
        </Card>

        <Button
          title="Logout"
          variant="error"
          onPress={handleLogout}
          style={styles.logoutButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: colors.textLight,
    fontSize: 32,
    fontWeight: 'bold',
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  approvedBadge: {
    backgroundColor: colors.success + '20',
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
  },
  rejectedBadge: {
    backgroundColor: colors.error + '20',
  },
  unknownBadge: {
    backgroundColor: colors.surfaceLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  logoutButton: {
    marginTop: 24,
  },
});

export default VendorProfileScreen;