"use client";

import { createContext, useContext } from "react";

type SurveyProviderValue = {
  jobId: string;
  surveyId?: string;
};

const SurveyContext = createContext<SurveyProviderValue | null>(null);

type Props = SurveyProviderValue & {
  children: React.ReactNode;
};

export function SurveyProvider({ children, jobId, surveyId }: Props) {
  return <SurveyContext.Provider value={{ jobId, surveyId }}>{children}</SurveyContext.Provider>;
}

export function useSurveyContext() {
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error("useSurveyContext must be used inside SurveyProvider.");
  }
  return context;
}
