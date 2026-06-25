import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getVendorPaymentHistory } from '../../api/payments';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { formatCurrency } from '../../utils/helpers';
import { FontAwesome5 } from '@expo/vector-icons';

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'RELEASED', label: 'Released' },
];

const VendorPaymentHistoryScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');

  const fetchHistory = async () => {
    try {
      console.log('[VendorPaymentHistory] Fetching history from API...');
      const response = await getVendorPaymentHistory();
      setData(response);
    } catch (error) {
      console.error('[VendorPaymentHistory] Failed to fetch payment history:', error);
      Alert.alert('Error', 'Failed to load vendor payment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const getFilteredTransactions = () => {
    if (!data?.transactions) return [];
    if (activeTab === 'ALL') return data.transactions;

    return data.transactions.filter((tx) => {
      const type = tx.transaction_type;
      if (activeTab === 'RECEIVED') {
        return type === 'ADVANCE_PAYMENT' || type === 'FINAL_PAYMENT';
      }
      if (activeTab === 'REFUNDED') {
        return type === 'REFUND';
      }
      if (activeTab === 'PENDING') {
        return type === 'PENDING_SETTLEMENT';
      }
      if (activeTab === 'RELEASED') {
        return type === 'SETTLEMENT_RELEASED';
      }
      return true;
    });
  };

  const getTransactionConfig = (type, status) => {
    switch (type) {
      case 'ADVANCE_PAYMENT':
        return {
          title: 'Advance Payment Received',
          icon: 'arrow-down',
          iconColor: colors.success,
          bgColor: colors.success + '15',
          prefix: '+',
          textColor: colors.success,
          badgeLabel: 'Received',
          badgeColor: colors.success,
        };
      case 'FINAL_PAYMENT':
        return {
          title: 'Final Payment Received',
          icon: 'arrow-down',
          iconColor: colors.success,
          bgColor: colors.success + '15',
          prefix: '+',
          textColor: colors.success,
          badgeLabel: 'Received',
          badgeColor: colors.success,
        };
      case 'REFUND':
        return {
          title: 'Refund Processed',
          icon: 'arrow-up',
          iconColor: colors.error,
          bgColor: colors.error + '15',
          prefix: '-',
          textColor: colors.error,
          badgeLabel: 'Refunded',
          badgeColor: colors.error,
        };
      case 'SETTLEMENT_RELEASED':
        return {
          title: 'Settlement Released',
          icon: 'check-circle',
          iconColor: colors.success,
          bgColor: colors.success + '15',
          prefix: '+',
          textColor: colors.success,
          badgeLabel: 'Released',
          badgeColor: colors.success,
        };
      case 'PENDING_SETTLEMENT':
        return {
          title: 'Pending Settlement',
          icon: 'clock',
          iconColor: colors.warning,
          bgColor: colors.warning + '15',
          prefix: '',
          textColor: colors.warning,
          badgeLabel: 'Pending',
          badgeColor: colors.warning,
        };
      default:
        return {
          title: 'Transaction',
          icon: 'money-bill',
          iconColor: colors.textSecondary,
          bgColor: '#eee',
          prefix: '',
          textColor: colors.text,
          badgeLabel: status,
          badgeColor: colors.textMuted,
        };
    }
  };

  const formatTxDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Format: 25 Jun 2026 • 3:18 PM
      const day = date.getDate();
      const monthNames = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      return `${day} ${month} ${year} • ${hours}:${minStr} ${ampm}`;
    } catch (e) {
      return dateString;
    }
  };

  const renderTransactionCard = ({ item }) => {
    const config = getTransactionConfig(item.transaction_type, item.status);
    
    return (
      <Card style={styles.txnCard}>
        <View style={styles.txnRow}>
          {/* Left Arrow Circular Badge */}
          <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
            <FontAwesome5 name={config.icon} size={15} color={config.iconColor} />
          </View>

          {/* Details Column */}
          <View style={styles.detailsCol}>
            <Text style={styles.txnTitle}>{config.title}</Text>
            <Text style={styles.bookingId}>Booking ID: {item.booking_display_id}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.customer_name}</Text>
              <Text style={styles.metaBullet}>•</Text>
              <Text style={styles.metaText} numberOfLines={1}>{item.listing_title}</Text>
            </View>
            <Text style={styles.dateText}>{formatTxDate(item.created_at)}</Text>
          </View>

          {/* Right Amount + Badge Column */}
          <View style={styles.amountCol}>
            <Text style={[styles.amountText, { color: config.textColor }]}>
              {config.prefix}{formatCurrency(item.amount)}
            </Text>
            <View style={[styles.badge, { backgroundColor: config.badgeColor + '15' }]}>
              <Text style={[styles.badgeText, { color: config.badgeColor }]}>
                {config.badgeLabel}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  if (loading && !data) {
    return <LoadingScreen />;
  }

  const summary = data?.summary || {
    total_received: 0,
    total_refunded: 0,
    total_pending_release: 0,
    total_earned: 0,
  };

  const filteredTransactions = getFilteredTransactions();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={{ width: 18 }} />
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* Filter Tabs */}
            <View style={styles.tabContainer}>
              <FlatList
                horizontal
                data={FILTER_TABS}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.tabButton,
                      activeTab === item.id && styles.activeTabButton,
                    ]}
                    onPress={() => setActiveTab(item.id)}
                  >
                    <Text
                      style={[
                        styles.tabLabel,
                        activeTab === item.id && styles.activeTabLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Summary Cards Grid */}
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryHeader}>Summary</Text>
              
              <View style={styles.gridRow}>
                <View style={styles.gridCell}>
                  <Text style={styles.gridValLabel}>Total Received</Text>
                  <Text style={[styles.gridValue, { color: colors.success }]}>
                    {formatCurrency(summary.total_received)}
                  </Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.gridCell}>
                  <Text style={styles.gridValLabel}>Total Refunded</Text>
                  <Text style={[styles.gridValue, { color: colors.error }]}>
                    {formatCurrency(summary.total_refunded)}
                  </Text>
                </View>
              </View>

              <View style={styles.horizontalDivider} />

              <View style={styles.gridRow}>
                <View style={styles.gridCell}>
                  <Text style={styles.gridValLabel}>Pending Release</Text>
                  <Text style={[styles.gridValue, { color: colors.warning }]}>
                    {formatCurrency(summary.total_pending_release)}
                  </Text>
                </View>
                <View style={styles.verticalDivider} />
                <View style={styles.gridCell}>
                  <Text style={styles.gridValLabel}>Net Earnings</Text>
                  <Text style={[styles.gridValue, { color: colors.text }]}>
                    {formatCurrency(summary.total_earned)}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No Transactions"
            message={`No payment history entries match the filter "${activeTab.toLowerCase()}".`}
            icon="receipt"
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  tabContainer: {
    marginVertical: 12,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeTabButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  tabLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  summaryHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridCell: {
    flex: 1,
    paddingVertical: 4,
  },
  gridValLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  verticalDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginVertical: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  txnCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailsCol: {
    flex: 1,
    marginRight: 12,
  },
  txnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  bookingId: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  metaBullet: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: '45%',
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default VendorPaymentHistoryScreen;
