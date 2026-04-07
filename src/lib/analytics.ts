'use client';

import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

export type ResearchEventType = 
  | 'AUTH_SIGNUP'
  | 'AUTH_LOGIN'
  | 'CONTEXT_SAVED'
  | 'ASSESSMENT_SAVED'
  | 'RECOMMENDATIONS_VIEWED'
  | 'RECOMMENDATION_FEEDBACK'
  | 'COURSE_COMPLETED_ADDED'
  | 'COURSE_COMPLETED_DELETED'
  | 'USABILITY_FORM_OPENED'
  | 'MICROLEARNING_VIEWED'
  | 'MICROLEARNING_ACTION_CLICKED';

interface LogEventOptions {
  uid: string;
  eventType: ResearchEventType;
  metadata?: Record<string, any>;
  contextSnapshot?: {
    unidadeId?: string;
    setorId?: string;
    cargo?: string;
  };
}

/**
 * Remove recursivamente chaves com valores 'undefined' ou 'null' de um objeto.
 */
function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(sanitize).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
      const value = sanitize(obj[key]);
      if (value !== undefined) {
        sanitized[key] = value;
      }
    });
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
  return obj;
}

/**
 * Registra um evento de pesquisa no Firestore.
 * IMPORTANTE: Grava sempre dentro da subcoleção do usuário para respeitar as rules.
 */
export function logResearchEvent(db: Firestore, options: LogEventOptions) {
  if (!db || !options.uid) {
    return;
  }

  // Grava em /users/{uid}/researchEvents para garantir permissão isOwner
  const eventsRef = collection(db, 'users', options.uid, 'researchEvents');
  
  const eventData = sanitize({
    uid: options.uid,
    eventType: options.eventType,
    timestamp: serverTimestamp(),
    contextSnapshot: options.contextSnapshot || {},
    metadata: options.metadata || {}
  });

  if (!eventData) return;

  addDoc(eventsRef, eventData).catch(err => {
    console.warn('Analytics silent fail:', err?.message);
  });
}
