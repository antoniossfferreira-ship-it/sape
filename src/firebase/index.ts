"use client";

import type { ReactNode } from "react";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Query,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import firebaseConfig from "./config";

type FirebaseContextValue = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
};

const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const FirebaseContext = createContext<FirebaseContextValue>({
  app: firebaseApp,
  auth,
  firestore,
  storage,
});

export function FirebaseClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      app: firebaseApp,
      auth,
      firestore,
      storage,
    }),
    []
  );

  return createElement(FirebaseContext.Provider, { value }, children);
}

export function useFirestore() {
  return useContext(FirebaseContext).firestore;
}

export function useAuth() {
  return useContext(FirebaseContext).auth;
}

export function useStorage() {
  return useContext(FirebaseContext).storage;
}

export function useUser() {
  const firebaseAuth = useAuth();
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setIsUserLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseAuth]);

  return { user, isUserLoading };
}

export function useMemoFirebase<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

export function useDoc<T = DocumentData>(ref: DocumentReference | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!ref);

  useEffect(() => {
    if (!ref) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setData(snapshot.exists() ? (snapshot.data() as T) : null);
        setIsLoading(false);
      },
      (error) => {
        console.error("useDoc error:", error);
        setData(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading };
}

export function useCollection<T = DocumentData>(queryRef: Query | null) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(!!queryRef);

  useEffect(() => {
    if (!queryRef) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        setData(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as T[]
        );
        setIsLoading(false);
      },
      (error) => {
        console.error("useCollection error:", error);
        setData([]);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryRef]);

  return { data, isLoading };
}

export { firebaseApp as app, auth, firestore, storage };
