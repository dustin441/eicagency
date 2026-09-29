'use client';

import { createContext, useContext } from 'react';

export const SpartacoPdfContext = createContext(false);
export const useSpartacoPdf = () => useContext(SpartacoPdfContext);
