import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as vendorsApi from '../../api/vendors';
import * as listingsApi from '../../api/listings';
import { FontAwesome5 } from '@expo/vector-icons';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';
import { formatCurrency } from '../../utils/helpers';

const VendorDashboardScreen = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [vendorProfile, setVendorProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVendorProfile = async () => {
    try {
      const data = await vendorsApi.getVendorProfile();
      setVendorProfile(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch vendor profile:', error);
      return null;
    }
  };

  const fetchDashboard = async () => {
    try {
      const data = await vendorsApi.getVendorDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'vendor') {
        fetchVendorProfile().then(() => fetchDashboard());
      } else {
        setLoading(false);
      }
    }, [user?.role])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVendorProfile().then(() => fetchDashboard());
  };

  const StatCard = ({ title, value, icon, color }) => (
    <Card style={styles.statCard}>
      <View style={styles.statHeader}>
        <FontAwesome5 name={icon} size={16} color={color} style={styles.statIcon} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </Card>
  );

  const ActionCard = ({ title, subtitle, icon, onPress }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <FontAwesome5 name={icon} size={20} color={colors.primary} style={styles.actionIcon} />
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={20} color={colors.textSecondary} style={styles.actionArrow} />
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={styles.container} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
    }>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
      </View>

      {dashboard && (
        <>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Bookings"
              value={dashboard.total_bookings || 0}
              icon="calendar-alt"
              color={colors.primary}
            />
            <StatCard
              title="Confirmed"
              value={dashboard.confirmed_bookings || 0}
              icon="check-circle"
              color={colors.success}
            />
            <StatCard
              title="Pending"
              value={dashboard.pending_bookings || 0}
              icon="hourglass-half"
              color={colors.warning}
            />
            <StatCard
              title="Revenue"
              value={formatCurrency(dashboard.revenue || 0)}
              icon="coins"
              color={colors.success}
            />
          </View>

          {dashboard.pending_bookings > 0 && (
            <Card style={styles.alertCard}>
              <Text style={styles.alertText}>
                You have {dashboard.pending_bookings} pending booking(s) waiting for approval.
              </Text>
              <Button
                title="View Pending"
                size="small"
                onPress={() => navigation.navigate('VendorBookings')}
              />
            </Card>
          )}
        </>
      )}

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <ActionCard
          title="Create Listing"
          subtitle="Add a new listing"
          icon="plus"
          onPress={() => navigation.navigate('CreateListing')}
        />
        <ActionCard
          title="My Listings"
          subtitle="Manage your listings"
          icon="home"
          onPress={() => navigation.navigate('MyListings')}
        />
        <ActionCard
          title="Bookings"
          subtitle="View all bookings"
          icon="clipboard-list"
          onPress={() => navigation.navigate('VendorBookings')}
        />
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    padding: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    marginRight: 8,
  },
  statTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  alertCard: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.surfaceLight,
  },
  alertText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  actionsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionArrow: {
  },
  bottomPadding: {
    height: 24,
  },
});

export default VendorDashboardScreen;