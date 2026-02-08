/**
 * Hook for Phone & Email Link Authentication
 * 
 * Provides methods for passwordless authentication
 */

import { useCallback, useState } from 'react';
import { 
  auth,
  sendSignInLinkToEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  isSignInWithEmailLink,
  signInWithEmailLink,
  ensureUserProfile
} from '@/lib/firebase';

export function usePasswordlessAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Phone Auth: Send SMS with code
  const sendPhoneOTP = useCallback(async (phoneNumber) => {
    setLoading(true);
    setError(null);
    
    try {
      // Initialize reCAPTCHA verifier if not already done
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          }
        });
      }

      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      
      setLoading(false);
      return { success: true, verificationId: result.verificationId };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  // Phone Auth: Verify SMS code
  const verifyPhoneOTP = useCallback(async (verificationId, code) => {
    setLoading(true);
    setError(null);
    
    try {
      const credential = window.PhoneAuthProvider.credential(verificationId, code);
      const result = await window.auth.signInWithCredential(credential);
      
      // Ensure profile exists
      await ensureUserProfile(result.user.uid, {
        name: result.user.phoneNumber || 'Guest',
        avatar: '📱'
      });
      
      setLoading(false);
      return { success: true, user: result.user };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  // Email Link Auth: Send magic link to email
  const sendEmailLink = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/email-link`,
        handleCodeInApp: true
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      
      // Save email to localStorage for later verification
      window.localStorage.setItem('emailForSignIn', email);
      
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  // Email Link Auth: Complete sign-in after clicking link
  const verifyEmailLink = useCallback(async (email = null) => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if user is signing in with email link
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error('Invalid email link');
      }

      // Get email from parameter or localStorage
      let emailToUse = email;
      if (!emailToUse) {
        emailToUse = window.localStorage.getItem('emailForSignIn');
      }
      
      if (!emailToUse) {
        throw new Error('Email not found. Please try again.');
      }

      // Complete sign-in
      const result = await signInWithEmailLink(auth, emailToUse, window.location.href);
      
      // Clear localStorage
      window.localStorage.removeItem('emailForSignIn');
      
      // Ensure profile exists
      await ensureUserProfile(result.user.uid, {
        name: emailToUse.split('@')[0], // Use first part of email as name
        avatar: '📧'
      });
      
      setLoading(false);
      return { success: true, user: result.user };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    loading,
    error,
    sendPhoneOTP,
    verifyPhoneOTP,
    sendEmailLink,
    verifyEmailLink
  };
}

export default usePasswordlessAuth;
