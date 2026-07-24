import React, { useEffect, useState } from 'react';
import { fetchSdpStateDimensions } from '../../api/stateDomesticProductApi';
import StateSearchSelect from '../sdp/StateSearchSelect';
import SdpProfileSection from './SdpProfileSection';
import PriceWagesProfileSection from './PriceWagesProfileSection';
import BankingProfileSection from './BankingProfileSection';
import FiscalProfileSection from './FiscalProfileSection';
import HealthProfileSection from './HealthProfileSection';
import SocialProfileSection from './SocialProfileSection';
import './StateProfilePage.css';

const DEFAULT_STATE = 'Karnataka';

const StateProfilePage: React.FC = () => {
  const [states, setStates] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>(DEFAULT_STATE);
  const [statesError, setStatesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSdpStateDimensions()
      .then((dims: { dimension_id?: number; id?: number; dimension_name?: string; name?: string }[]) => {
        if (cancelled) return;
        const names = Array.from(
          new Set(dims.map((d) => d.dimension_name ?? d.name).filter((n): n is string => Boolean(n)))
        ).sort((a, b) => a.localeCompare(b));
        setStates(names);
        setSelectedState((prev) => (names.includes(prev) ? prev : names.includes(DEFAULT_STATE) ? DEFAULT_STATE : names[0] ?? DEFAULT_STATE));
      })
      .catch(() => {
        if (cancelled) return;
        setStatesError('Unable to load the list of states.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="state-profile-page">
      <div className="state-profile-header">
        <div>
          <h1 className="state-profile-page-title">State Profile</h1>
          <p className="state-profile-page-desc">
            Every tracked indicator for one state, pulled from all six RBI datasets in this dashboard.
          </p>
        </div>
        <div className="state-profile-page-control">
          <span className="state-profile-page-control-label">State</span>
          <StateSearchSelect
            states={states.length ? states : [DEFAULT_STATE]}
            value={selectedState}
            onChange={setSelectedState}
          />
        </div>
      </div>

      {statesError && <div className="state-profile-page-error">{statesError}</div>}

      <SdpProfileSection state={selectedState} />
      <PriceWagesProfileSection state={selectedState} />
      <BankingProfileSection state={selectedState} />
      <FiscalProfileSection state={selectedState} />
      <HealthProfileSection state={selectedState} />
      <SocialProfileSection state={selectedState} />
    </div>
  );
};

export default StateProfilePage;
