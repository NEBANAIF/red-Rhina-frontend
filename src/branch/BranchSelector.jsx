import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { isManufacturingPath, MANUFACTURING_DASHBOARD_PATH, branchTypeOfRole } from '../navigation.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBranchScope } from './BranchContext.jsx';
import Icon from '../components/Icon.jsx';
import ElegantSelect from '../components/ElegantSelect.jsx';

/** Spec section 37: ADMINISTRATOR gets All Branches/All Stores/All Warehouses/Specific; everyone else just sees their own branch name, no dropdown. */
export default function BranchSelector() {
  const { user } = useAuth();
  const { isAdministrator, scope, setScope, specificBranchId, setSpecificBranchId, branches, branchesLoading } =
    useBranchScope();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const manufacturing = isManufacturingPath(pathname);
  const factories = branches.filter((b) => b.type === 'FACTORY');

  // Leaving Manufacturing: a factory scope left over from there would filter the rest of the app by factories, and "All Factories"
  // could not be chosen again (it is already selected). Back to All Branches, so the Manufacturing filter works every time.
  const wasManufacturing = useRef(manufacturing);
  useEffect(() => {
    if (wasManufacturing.current && !manufacturing && isAdministrator) {
      const specificIsFactory = factories.some((b) => b.id === specificBranchId);
      if (scope === 'FACTORIES' || (scope === 'SPECIFIC' && specificIsFactory)) {
        setScope('ALL');
        setSpecificBranchId(null);
      }
    }
    wasManufacturing.current = manufacturing;
  }, [manufacturing]);

  // Inside Manufacturing only factories can be picked: a store / warehouse scope would show nothing.
  useEffect(() => {
    if (!manufacturing || !isAdministrator || branchesLoading) return;
    const specificIsFactory = factories.some((b) => b.id === specificBranchId);
    if (scope === 'STORES' || scope === 'WAREHOUSES' || scope === 'ALL' || (scope === 'SPECIFIC' && !specificIsFactory)) {
      setScope('FACTORIES');
      setSpecificBranchId(null);
    }
  }, [manufacturing, isAdministrator, branchesLoading, scope, specificBranchId, branches]);

  if (!isAdministrator) {
    const factoryUser = branchTypeOfRole(user?.role) === 'FACTORY';
    const label = (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-2.5 py-1.5 text-sm text-ink-700">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-sage-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sage-500" />
        </span>
        <span className="truncate">{user?.branchName || 'Your branch'}</span>
      </div>
    );
    // a factory user's location label opens the Manufacturing Dashboard
    return factoryUser ? (
      <Link to={MANUFACTURING_DASHBOARD_PATH} title="Open the Manufacturing Dashboard" className="block min-w-0">{label}</Link>
    ) : label;
  }

  function handleScopeChange(e) {
    const next = e.target.value;
    setScope(next);
    // The Manufacturing filter opens the Manufacturing Dashboard directly, from wherever the user is.
    if (next === 'FACTORIES') {
      setSpecificBranchId(null);
      navigate(MANUFACTURING_DASHBOARD_PATH);
      return;
    }
    if (next !== 'SPECIFIC') setSpecificBranchId(null);
    else if (!specificBranchId && (manufacturing ? factories : branches).length) setSpecificBranchId((manufacturing ? factories : branches)[0].id);
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="hidden text-ink-400 sm:block" aria-hidden="true">
        <Icon name="building" size={16} />
      </span>
      <ElegantSelect
        value={scope}
        onChange={(v) => handleScopeChange({ target: { value: v } })}
        ariaLabel="Branch scope"
        width="w-auto"
        minWidth={110}
      >
        {!manufacturing && <option value="ALL">All Branches</option>}
        {!manufacturing && <option value="STORES">All Stores</option>}
        {!manufacturing && <option value="WAREHOUSES">All Warehouses</option>}
        {!manufacturing && <option value="SHOWROOMS">All Showrooms</option>}
        <option value="FACTORIES">All Factories</option>
        <option value="SPECIFIC">{manufacturing ? 'Specific Factory' : 'Specific Branch'}</option>
      </ElegantSelect>

      {scope === 'SPECIFIC' && (
        <ElegantSelect
          value={specificBranchId || ''}
          disabled={branchesLoading}
          onChange={(v) => {
            setSpecificBranchId(v);
            if (!manufacturing && factories.some((b) => b.id === v)) navigate(MANUFACTURING_DASHBOARD_PATH);
          }}
          ariaLabel="Branch"
          width="w-auto"
          minWidth={110}
        >
          {(manufacturing ? factories : branches).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </ElegantSelect>
      )}
    </div>
  );
}
