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
import * as adminApi from '../../api/admin';
import Card from '../../components/Card';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';

const AdminDashboardScreen = ({ navigation }) => {
  const { logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const data = await adminApi.getDashboard();
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
      fetchDashboard();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return <LoadingScreen />;
  }

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
        <Text style={styles.title}>Admin Dashboard</Text>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboard?.total_users || 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboard?.total_vendors || 0}</Text>
            <Text style={styles.statLabel}>Total Vendors</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={[styles.statNumber, styles.pendingNumber]}>
              {dashboard?.pending_vendors || 0}
            </Text>
            <Text style={styles.statLabel}>Pending Vendors</Text>
          </Card>

          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{dashboard?.active_vendors || 0}</Text>
            <Text style={styles.statLabel}>Active Vendors</Text>
          </Card>
        </View>

        <Button
          title="Logout"
          variant="error"
          onPress={() => {
            Alert.alert(
              'Logout',
              'Are you sure you want to logout?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout },
              ]
            );
          }}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  pendingNumber: {
    color: colors.warning,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  logoutButton: {
    marginTop: 24,
  },
});

export default AdminDashboardScreen;
