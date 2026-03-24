'use client';

import { AgentType, AutonomyLevel } from '@bemindlabs/unicore-shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import React from 'react';

import type { WizardAction, WizardState } from '@/types/wizard';

const initialState: WizardState = {
  currentStep: 0,
  bootstrapSecret: '',
  business: {
    name: '',
    template: 'custom',
    locale: 'en',
    currency: 'USD',
    timezone: 'America/New_York',
  },
  admin: {
    name: '',
    email: '',
    password: '',
  },
  team: [],
  agents: Object.values(AgentType).map((type) => ({
    type,
    enabled: type === AgentType.Router,
    autonomy: AutonomyLevel.Suggest,
    channels: ['web'],
  })),
  erp: {
    contacts: true,
    orders: true,
    inventory: true,
    invoicing: true,
    expenses: true,
    reports: true,
  },
  integrations: [],
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_BOOTSTRAP_SECRET':
      return { ...state, bootstrapSecret: action.secret };
    case 'UPDATE_BUSINESS':
      return { ...state, business: { ...state.business, ...action.data } };
    case 'UPDATE_ADMIN':
      return { ...state, admin: { ...state.admin, ...action.data } };
    case 'SET_TEAM':
      return { ...state, team: action.team };
    case 'ADD_TEAM_MEMBER':
      return { ...state, team: [...state.team, action.member] };
    case 'REMOVE_TEAM_MEMBER':
      return { ...state, team: state.team.filter((_, i) => i !== action.index) };
    case 'UPDATE_AGENTS':
      return { ...state, agents: action.agents };
    case 'TOGGLE_AGENT':
      return {
        ...state,
        agents: state.agents.map((a, i) =>
          i === action.agentIndex ? { ...a, enabled: !a.enabled } : a,
        ),
      };
    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: state.agents.map((a, i) =>
          i === action.agentIndex ? { ...a, ...action.data } : a,
        ),
      };
    case 'UPDATE_ERP':
      return { ...state, erp: { ...state.erp, ...action.modules } };
    case 'SET_INTEGRATIONS':
      return { ...state, integrations: action.integrations };
    case 'TOGGLE_INTEGRATION': {
      const integrations = [...state.integrations];
      integrations[action.index] = {
        ...integrations[action.index],
        enabled: !integrations[action.index].enabled,
      };
      return { ...state, integrations };
    }
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const nextStep = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: Math.min(state.currentStep + 1, 5) });
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: Math.max(state.currentStep - 1, 0) });
  }, [state.currentStep]);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: 'SET_STEP', step: Math.max(0, Math.min(step, 5)) });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, nextStep, prevStep, goToStep }),
    [state, dispatch, nextStep, prevStep, goToStep],
  );

  return React.createElement(WizardContext.Provider, { value }, children);
}

export function useWizardState() {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizardState must be used within a WizardProvider');
  }
  return ctx;
}
