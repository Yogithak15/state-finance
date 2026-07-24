import React, { useEffect, useState } from 'react';
import { CATEGORIES, CategoryId } from '../types';
import { fetchSdpSummaryStats } from '../api/stateDomesticProductApi';
import { fetchPwSummaryStats } from '../api/priceWagesApi';
import { fetchBankingSummaryStats } from '../api/bankingApi';
import { SdpSummaryStats } from './SdpStats';
import { PwSummaryStats } from './priceWages/PriceWagesStats';
import { BankingSummaryStats } from './banking/BankingStats';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CategoryPanel from './CategoryPanel';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryId>(CATEGORIES[0].id);
  const category = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0];

  const [sdpStats, setSdpStats] = useState<SdpSummaryStats | null>(null);
  const [sdpError, setSdpError] = useState<string | null>(null);
  const [pwStats, setPwStats] = useState<PwSummaryStats | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [bankingStats, setBankingStats] = useState<BankingSummaryStats | null>(null);
  const [bankingError, setBankingError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCategory !== 'sdp') return;
    let cancelled = false;
    setSdpError(null);
    fetchSdpSummaryStats()
      .then((data) => {
        if (!cancelled) setSdpStats(data);
      })
      .catch(() => {
        if (!cancelled) setSdpError('Unable to load State Domestic Product data.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory !== 'prices-wages') return;
    let cancelled = false;
    setPwError(null);
    fetchPwSummaryStats()
      .then((data) => {
        if (!cancelled) setPwStats(data);
      })
      .catch(() => {
        if (!cancelled) setPwError('Unable to load Price and Wages data.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory !== 'banking') return;
    let cancelled = false;
    setBankingError(null);
    fetchBankingSummaryStats()
      .then((data) => {
        if (!cancelled) setBankingStats(data);
      })
      .catch(() => {
        if (!cancelled) setBankingError('Unable to load Banking data.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  return (
    <div className="dashboard">
      <Sidebar activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
      <main className="dashboard-main">
        <Topbar category={category} />
        <CategoryPanel
          category={category}
          sdpStats={sdpStats}
          sdpError={sdpError}
          pwStats={pwStats}
          pwError={pwError}
          bankingStats={bankingStats}
          bankingError={bankingError}
        />
      </main>
    </div>
  );
};

export default Dashboard;
